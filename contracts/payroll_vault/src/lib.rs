#![no_std]
use quipay_common::{QuipayError, require_positive_amount};
use soroban_sdk::{
    Address, BytesN, Env, Symbol, Vec, contract, contractimpl, contracttype, symbol_short, token,
};

#[cfg(test)]
mod test;

#[cfg(test)]
mod cooldown_test;

#[cfg(test)]
mod upgrade_test;

#[cfg(test)]
mod fuzz_test;

#[cfg(kani)]
mod kani_test;

#[cfg(test)]
mod multisig_withdrawal_test;

#[cfg(test)]
mod proptest;

// Storage keys - using separate enums for persistent vs instance storage
#[contracttype]
#[derive(Clone)]
pub enum StateKey {
    // Persistent storage - survives upgrades
    Admin,
    Version,
    AuthorizedContract, // Contract authorized to modify liabilities (e.g., PayrollStream)
    // Multisig Withdrawal Security
    Guardians,
    GuardianThreshold,
    WithdrawalThreshold(Address), // Token -> Threshold
    PendingWithdrawal(u64),
    WithdrawalNonce,
    // Additional state that should persist across upgrades
    TreasuryBalance(Address), // Funds held for payroll (Token -> Amount)
    TotalLiability(Address),  // Amount owed to recipients (Token -> Amount)
    LastWithdrawal(Address),  // Address -> Last Withdrawal Timestamp
    WithdrawalCooldown,       // Configurable cooldown in seconds
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PendingWithdrawal {
    pub amount: i128,
    pub recipient: Address,
    pub token: Address,
    pub proposer: Address,
    pub approvals: Vec<Address>,
    pub proposed_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct VersionInfo {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
    pub upgraded_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum VaultEvent {
    Upgraded(Address, u32, u32, u32, u32, u32, u32),
    Deposited(Address, Address, i128),
    Withdrawn(Address, Address, i128),
    Allocated(Address, i128),
    Released(Address, i128),
    Payout(Address, Address, i128),
}


#[contract]
pub struct PayrollVault;

// Event symbols
const UPGRADED: Symbol = symbol_short!("upgrd");
#[allow(dead_code)]
const VERSION: Symbol = symbol_short!("version");

#[contractimpl]
impl PayrollVault {
    /// Initialize the contract with an admin and initial version
    pub fn initialize(e: Env, admin: Address) -> Result<(), QuipayError> {
        if e.storage().persistent().has(&StateKey::Admin) {
            return Err(QuipayError::AlreadyInitialized);
        }

        // Store admin in persistent storage (survives upgrades)
        e.storage().persistent().set(&StateKey::Admin, &admin);

        // Set initial version (WASM hash tracked separately via upgrade function)
        let initial_version = VersionInfo {
            major: 1,
            minor: 0,
            patch: 0,
            upgraded_at: e.ledger().timestamp(),
        };
        e.storage()
            .persistent()
            .set(&StateKey::Version, &initial_version);

        // Authorized contract starts as None - must be set by admin later
        // No need to initialize balances/liabilities as they are maps
        Ok(())
    }

    /// Upgrade the contract to a new WASM code
    /// Only the admin can call this function
    ///
    /// # Multisig Support
    /// When the admin is a multisig Stellar account (e.g., 2-of-3), the Stellar network
    /// validates that the transaction meets the signature threshold before it reaches
    /// this contract. The `require_auth()` call then verifies the transaction was
    /// properly authorized by the admin account. This enables decentralized governance
    /// for DAOs and enterprise clients.
    pub fn upgrade(
        e: Env,
        new_wasm_hash: BytesN<32>,
        new_version: (u32, u32, u32),
    ) -> Result<(), QuipayError> {
        // Require admin authorization
        // For multisig accounts, Stellar validates threshold signatures before this call
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();

        // Get current version for event
        let current_version = Self::get_version(e.clone())?;

        // Perform the upgrade - this updates the contract's WASM code
        // All persistent storage remains intact
        e.deployer()
            .update_current_contract_wasm(new_wasm_hash.clone());

        // Update version info (WASM hash is passed as parameter, not stored)
        let (major, minor, patch) = new_version;
        let version_info = VersionInfo {
            major,
            minor,
            patch,
            upgraded_at: e.ledger().timestamp(),
        };
        e.storage()
            .persistent()
            .set(&StateKey::Version, &version_info);

        // Emit upgrade event
        #[allow(deprecated)]
        e.events().publish(
            (UPGRADED, admin.clone()),
            (
                current_version.major,
                current_version.minor,
                current_version.patch,
                major,
                minor,
                patch,
            ),
        );
        Ok(())
    }

    /// Get the current version information
    pub fn get_version(e: Env) -> Result<VersionInfo, QuipayError> {
        e.storage()
            .persistent()
            .get(&StateKey::Version)
            .ok_or(QuipayError::VersionNotSet)
    }

    /// Get the current admin address
    pub fn get_admin(e: Env) -> Result<Address, QuipayError> {
        e.storage()
            .persistent()
            .get(&StateKey::Admin)
            .ok_or(QuipayError::NotInitialized)
    }

    /// Transfer admin rights to a new address
    ///
    /// # Multisig Support
    /// Supports transferring admin to another multisig account. The current admin
    /// must authorize the transfer. If the current admin is a multisig, the transaction
    /// must meet its threshold. The new admin can also be a multisig account.
    pub fn transfer_admin(e: Env, new_admin: Address) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();

        e.storage().persistent().set(&StateKey::Admin, &new_admin);
        Ok(())
    }

    pub fn deposit(e: Env, from: Address, token: Address, amount: i128) -> Result<(), QuipayError> {
        from.require_auth();
        require_positive_amount!(amount);

        // Update treasury balance
        let key = StateKey::TreasuryBalance(token.clone());
        let current_balance: i128 = e.storage().persistent().get(&key).unwrap_or(0);
        e.storage()
            .persistent()
            .set(&key, &(current_balance + amount));

        let token_client = token::Client::new(&e, &token);
        token_client.transfer(&from, &e.current_contract_address(), &amount);

        e.events().publish(
            (
                symbol_short!("vault"),
                symbol_short!("deposited"),
                from.clone(),
                token.clone(),
            ),
            (amount),
        );

        Ok(())
    }

    /// Check if the treasury is solvent for a given token after adding `additional_liability`.
    /// Returns true if balance >= current_liability + additional_liability.
    pub fn check_solvency(e: Env, token: Address, additional_liability: i128) -> bool {
        if additional_liability < 0 {
            return false;
        }

        let balance: i128 = e
            .storage()
            .persistent()
            .get(&StateKey::TreasuryBalance(token.clone()))
            .unwrap_or(0);
        let liability: i128 = e
            .storage()
            .persistent()
            .get(&StateKey::TotalLiability(token))
            .unwrap_or(0);

        balance >= liability.saturating_add(additional_liability)
    }

    /// Returns the available balance for a token (balance - liability).
    pub fn get_available_balance(e: Env, token: Address) -> i128 {
        let balance: i128 = e
            .storage()
            .persistent()
            .get(&StateKey::TreasuryBalance(token.clone()))
            .unwrap_or(0);
        let liability: i128 = e
            .storage()
            .persistent()
            .get(&StateKey::TotalLiability(token))
            .unwrap_or(0);
        balance - liability
    }

    /// Withdraw free funds from the treasury.
    /// Enforces `amount <= available_balance(token)`.
    /// Large withdrawals (> threshold) are blocked and must go through proposal flow.
    /// Consecutive withdrawals from the same address are subject to a cooldown period.
    pub fn withdraw(e: Env, to: Address, token: Address, amount: i128) -> Result<(), QuipayError> {
        to.require_auth();
        require_positive_amount!(amount);

        // Check cooldown
        let cooldown = e.storage().persistent().get::<_, u64>(&StateKey::WithdrawalCooldown).unwrap_or(86400);
        let last_withdrawal_key = StateKey::LastWithdrawal(to.clone());
        if let Some(last_ts) = e.storage().persistent().get::<_, u64>(&last_withdrawal_key) {
            if e.ledger().timestamp() < last_ts.saturating_add(cooldown) {
                return Err(QuipayError::WithdrawalCooldownActive);
            }
        }

        // Check if withdrawal threshold is set and exceeded
        let threshold_key = StateKey::WithdrawalThreshold(token.clone());
        if let Some(threshold) = e.storage().persistent().get::<_, i128>(&threshold_key) {
            if amount > threshold {
                return Err(QuipayError::LargeWithdrawalRequiresApproval);
            }
        }

        let available = Self::get_available_balance(e.clone(), token.clone());
        if amount > available {
            return Err(QuipayError::InsufficientBalance);
        }

        let balance_key = StateKey::TreasuryBalance(token.clone());
        let balance: i128 = e.storage().persistent().get(&balance_key).unwrap_or(0);

        // If the invariant holds, this should never underflow.
        e.storage()
            .persistent()
            .set(&balance_key, &(balance - amount));

        let token_client = token::Client::new(&e, &token);
        token_client.transfer(&e.current_contract_address(), &to, &amount);

        // Update last withdrawal timestamp
        e.storage().persistent().set(&last_withdrawal_key, &e.ledger().timestamp());

        e.events().publish(
            (
                symbol_short!("vault"),
                symbol_short!("withdrawn"),
                to.clone(),
                token.clone(),
            ),
            (amount),
        );


        Ok(())
    }

    /// Set the withdrawal cooldown period in seconds
    pub fn set_withdrawal_cooldown(e: Env, admin: Address, seconds: u64) -> Result<(), QuipayError> {
        admin.require_auth();
        let stored_admin = Self::get_admin(e.clone())?;
        if admin != stored_admin {
            return Err(QuipayError::Unauthorized);
        }

        e.storage().persistent().set(&StateKey::WithdrawalCooldown, &seconds);
        Ok(())
    }

    /// Set the guardians and the approval threshold for large withdrawals
    pub fn set_guardians(e: Env, guardians: Vec<Address>, threshold: u32) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();
        
        if threshold == 0 || threshold > guardians.len() {
            return Err(QuipayError::InvalidAmount);
        }

        e.storage().persistent().set(&StateKey::Guardians, &guardians);
        e.storage().persistent().set(&StateKey::GuardianThreshold, &threshold);
        Ok(())
    }

    /// Set the immediate withdrawal threshold for a specific token
    pub fn set_withdrawal_threshold(e: Env, token: Address, threshold: i128) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();
        
        e.storage().persistent().set(&StateKey::WithdrawalThreshold(token), &threshold);
        Ok(())
    }

    /// Propose a large withdrawal that exceeds the threshold
    pub fn propose_withdrawal(e: Env, employer: Address, token: Address, amount: i128, recipient: Address) -> Result<u64, QuipayError> {
        employer.require_auth();
        require_positive_amount!(amount);

        // Verify it exceeds threshold (otherwise they should just use withdraw)
        let threshold_key = StateKey::WithdrawalThreshold(token.clone());
        let threshold = e.storage().persistent().get::<_, i128>(&threshold_key).unwrap_or(i128::MAX);
        if amount <= threshold {
            return Err(QuipayError::InvalidAmount); // Should use normal withdraw
        }

        // Check solvency
        let available = Self::get_available_balance(e.clone(), token.clone());
        if amount > available {
            return Err(QuipayError::InsufficientBalance);
        }

        let nonce_key = StateKey::WithdrawalNonce;
        let id: u64 = e.storage().persistent().get(&nonce_key).unwrap_or(0);
        e.storage().persistent().set(&nonce_key, &(id + 1));

        let pending = PendingWithdrawal {
            amount,
            recipient,
            token,
            proposer: employer,
            approvals: Vec::new(&e),
            proposed_at: e.ledger().timestamp(),
        };

        e.storage().persistent().set(&StateKey::PendingWithdrawal(id), &pending);

        e.events().publish(
            (symbol_short!("vault"), symbol_short!("propose")),
            (id, pending.proposer, pending.amount),
        );

        Ok(id)
    }

    /// Approve a pending withdrawal
    pub fn approve_withdrawal(e: Env, guardian: Address, withdrawal_id: u64) -> Result<(), QuipayError> {
        guardian.require_auth();

        // Verify guardian status
        let guardians: Vec<Address> = e.storage().persistent().get(&StateKey::Guardians).ok_or(QuipayError::NotGuardian)?;
        if !guardians.contains(&guardian) {
            return Err(QuipayError::NotGuardian);
        }

        let key = StateKey::PendingWithdrawal(withdrawal_id);
        let mut pending: PendingWithdrawal = e.storage().persistent().get(&key).ok_or(QuipayError::WithdrawalNotFound)?;

        // Check if already approved by this guardian
        if pending.approvals.contains(&guardian) {
            return Err(QuipayError::AlreadyApproved);
        }

        pending.approvals.push_back(guardian.clone());
        
        let threshold: u32 = e.storage().persistent().get(&StateKey::GuardianThreshold).unwrap_or(0);
        
        if pending.approvals.len() >= threshold {
            // Execute withdrawal
            let available = Self::get_available_balance(e.clone(), pending.token.clone());
            if pending.amount > available {
                return Err(QuipayError::InsufficientBalance);
            }

            let balance_key = StateKey::TreasuryBalance(pending.token.clone());
            let balance: i128 = e.storage().persistent().get(&balance_key).unwrap_or(0);
            e.storage().persistent().set(&balance_key, &(balance - pending.amount));

            let token_client = token::Client::new(&e, &pending.token);
            token_client.transfer(&e.current_contract_address(), &pending.recipient, &pending.amount);

            e.storage().persistent().remove(&key);

            e.events().publish(
                (symbol_short!("vault"), symbol_short!("approved")),
                (withdrawal_id, true),
            );
        } else {
            e.storage().persistent().set(&key, &pending);
            e.events().publish(
                (symbol_short!("vault"), symbol_short!("approved")),
                (withdrawal_id, false),
            );
        }

        Ok(())
    }

    /// Cancel a pending withdrawal
    pub fn cancel_withdrawal(e: Env, employer: Address, withdrawal_id: u64) -> Result<(), QuipayError> {
        employer.require_auth();

        let key = StateKey::PendingWithdrawal(withdrawal_id);
        let pending: PendingWithdrawal = e.storage().persistent().get(&key).ok_or(QuipayError::WithdrawalNotFound)?;

        if pending.proposer != employer {
            return Err(QuipayError::Unauthorized);
        }

        e.storage().persistent().remove(&key);

        e.events().publish(
            (symbol_short!("vault"), symbol_short!("canceled")),
            withdrawal_id,
        );

        Ok(())
    }

    pub fn get_pending_withdrawal(e: Env, withdrawal_id: u64) -> Option<PendingWithdrawal> {
        e.storage().persistent().get(&StateKey::PendingWithdrawal(withdrawal_id))
    }

    /// Adds liability to the vault (e.g., when a stream is created)
    /// Checks if there are enough funds (solvency check)
    ///
    /// # Multisig Support
    /// Requires admin authorization. If admin is a multisig account, the transaction
    /// must meet the signature threshold (e.g., 2-of-3) before reaching this function.
    pub fn allocate_funds(e: Env, token: Address, amount: i128) -> Result<(), QuipayError> {
        let admin: Address = e
            .storage()
            .persistent()
            .get(&StateKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();

        if amount <= 0 {
            // panic!("allocation amount must be positive");
            return Err(QuipayError::InvalidAmount);
        }

        let balance_key = StateKey::TreasuryBalance(token.clone());
        let liability_key = StateKey::TotalLiability(token.clone());

        let balance: i128 = e.storage().persistent().get(&balance_key).unwrap_or(0);
        let liability: i128 = e.storage().persistent().get(&liability_key).unwrap_or(0);

        if balance < liability + amount {
            // panic!("insufficient funds for allocation");
            return Err(QuipayError::InsufficientBalance);
        }

        e.storage()
            .persistent()
            .set(&liability_key, &(liability + amount));

        e.events().publish(
            (
                symbol_short!("vault"),
                symbol_short!("allocated"),
                token.clone(),
                symbol_short!("admin"),
            ),
            (amount),
        );

        Ok(())
    }

    /// Removes liability (e.g., when a stream is cancelled)
    ///
    /// # Multisig Support
    /// Requires admin authorization. Supports multisig admin accounts where the
    /// signature threshold must be met at the Stellar network level.
    pub fn release_funds(e: Env, token: Address, amount: i128) -> Result<(), QuipayError> {
        let admin: Address = e
            .storage()
            .persistent()
            .get(&StateKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();

        if amount <= 0 {
            // panic!("release amount must be positive");
            return Err(QuipayError::InvalidAmount);
        }

        let liability_key = StateKey::TotalLiability(token.clone());
        let liability: i128 = e.storage().persistent().get(&liability_key).unwrap_or(0);

        if amount > liability {
            // panic!("release amount exceeds liability");
            return Err(QuipayError::InvalidAmount); // Or dedicated error
        }

        e.storage()
            .persistent()
            .set(&liability_key, &(liability - amount));

        e.events().publish(
            (
                symbol_short!("vault"),
                symbol_short!("released"),
                token.clone(),
                symbol_short!("admin"),
            ),
            (amount),
        );

        Ok(())
    }

    /// Payout funds to a recipient
    ///
    /// # Multisig Support
    /// Requires admin authorization. When admin is a multisig account (e.g., DAO treasury),
    /// the transaction must meet the signature threshold before execution. This ensures
    /// decentralized control over payroll payouts.
    pub fn payout(e: Env, to: Address, token: Address, amount: i128) -> Result<(), QuipayError> {
        let admin: Address = e
            .storage()
            .persistent()
            .get(&StateKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();

        require_positive_amount!(amount);

        let balance_key = StateKey::TreasuryBalance(token.clone());
        let liability_key = StateKey::TotalLiability(token.clone());

        let balance: i128 = e.storage().persistent().get(&balance_key).unwrap_or(0);
        let liability: i128 = e.storage().persistent().get(&liability_key).unwrap_or(0);

        if amount > balance {
            // panic!("insufficient treasury balance");
            return Err(QuipayError::InsufficientBalance);
        }

        // Payout reduces liability AND balance
        // We assume liability was allocated before.
        // If not allocated, liability could go negative if we subtract blindly.
        // But here we check if liability >= amount?
        // Or maybe payout implies liability reduction.
        // Let's assume payout reduces liability as debt is paid.
        if amount > liability {
            // panic!("payout exceeds liability");
            return Err(QuipayError::InvalidAmount);
        }

        e.storage()
            .persistent()
            .set(&liability_key, &(liability - amount));
        e.storage()
            .persistent()
            .set(&balance_key, &(balance - amount));

        let token_client = token::Client::new(&e, &token);
        token_client.transfer(&e.current_contract_address(), &to, &amount);

        e.events().publish(
            (
                symbol_short!("vault"),
                symbol_short!("payout"),
                to.clone(),
                token.clone(),
            ),
            (amount),
        );

        Ok(())
    }

    pub fn payout_liability(
        e: Env,
        to: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), QuipayError> {
        let authorized: Address = e
            .storage()
            .persistent()
            .get(&StateKey::AuthorizedContract)
            .expect("authorized contract not set");
        authorized.require_auth();

        require_positive_amount!(amount);

        let balance_key = StateKey::TreasuryBalance(token.clone());
        let liability_key = StateKey::TotalLiability(token.clone());

        let balance: i128 = e.storage().persistent().get(&balance_key).unwrap_or(0);
        let liability: i128 = e.storage().persistent().get(&liability_key).unwrap_or(0);

        if amount > balance {
            return Err(QuipayError::InsufficientBalance);
        }

        if amount > liability {
            return Err(QuipayError::InvalidAmount);
        }

        e.storage()
            .persistent()
            .set(&liability_key, &(liability - amount));
        e.storage()
            .persistent()
            .set(&balance_key, &(balance - amount));

        let token_client = token::Client::new(&e, &token);
        token_client.transfer(&e.current_contract_address(), &to, &amount);

        e.events().publish(
            (
                symbol_short!("vault"),
                symbol_short!("payout"),
                to.clone(),
                token.clone(),
            ),
            (amount),
        );

        Ok(())
    }

    pub fn get_balance(e: Env, token: Address) -> i128 {
        let token_client = token::Client::new(&e, &token);
        token_client.balance(&e.current_contract_address())
    }

    /// Set the authorized contract that can modify liabilities
    /// Only the admin can call this function
    ///
    /// # Multisig Support
    /// Requires admin authorization. Supports multisig admin accounts for decentralized
    /// control over which contracts can modify treasury liabilities.
    pub fn set_authorized_contract(e: Env, contract: Address) {
        let admin: Address = e
            .storage()
            .persistent()
            .get(&StateKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        e.storage()
            .persistent()
            .set(&StateKey::AuthorizedContract, &contract);
    }

    /// Get the authorized contract address (if set)
    pub fn get_authorized_contract(e: Env) -> Option<Address> {
        e.storage().persistent().get(&StateKey::AuthorizedContract)
    }

    /// Add liability for a specific token
    /// Only the authorized contract (e.g., PayrollStream) can call this
    pub fn add_liability(e: Env, token: Address, amount: i128) {
        // Require authorization from the authorized contract
        let authorized: Address = e
            .storage()
            .persistent()
            .get(&StateKey::AuthorizedContract)
            .expect("authorized contract not set");
        authorized.require_auth();

        if amount <= 0 {
            panic!("liability amount must be positive");
        }

        if !Self::check_solvency(e.clone(), token.clone(), amount) {
            panic!("insufficient funds for liability");
        }

        let key = StateKey::TotalLiability(token);
        let current: i128 = e.storage().persistent().get(&key).unwrap_or(0);
        e.storage().persistent().set(&key, &(current + amount));
    }

    /// Remove liability for a specific token
    /// Only the authorized contract (e.g., PayrollStream) can call this
    pub fn remove_liability(e: Env, token: Address, amount: i128) {
        // Require authorization from the authorized contract
        let authorized: Address = e
            .storage()
            .persistent()
            .get(&StateKey::AuthorizedContract)
            .expect("authorized contract not set");
        authorized.require_auth();

        if amount <= 0 {
            panic!("removal amount must be positive");
        }

        let key = StateKey::TotalLiability(token);
        let current: i128 = e.storage().persistent().get(&key).unwrap_or(0);
        if amount > current {
            panic!("cannot remove more liability than exists");
        }
        e.storage().persistent().set(&key, &(current - amount));
    }

    /// Get the liability for a specific token
    pub fn get_liability(e: Env, token: Address) -> i128 {
        e.storage()
            .persistent()
            .get(&StateKey::TotalLiability(token))
            .unwrap_or(0)
    }

    /// Get the tracked treasury balance from state
    pub fn get_treasury_balance(e: Env, token: Address) -> i128 {
        e.storage()
            .persistent()
            .get(&StateKey::TreasuryBalance(token))
            .unwrap_or(0)
    }

    /// Get the total liability from state  
    pub fn get_total_liability(e: Env, token: Address) -> i128 {
        e.storage()
            .persistent()
            .get(&StateKey::TotalLiability(token))
            .unwrap_or(0)
    }

    /// Get the current contract address
    pub fn get_contract_address(e: Env) -> Address {
        e.current_contract_address()
    }
}
