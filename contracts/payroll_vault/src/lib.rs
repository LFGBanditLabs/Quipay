#![no_std]
#![allow(unexpected_cfgs)]
use quipay_common::{QuipayError, require_positive_amount};
use soroban_sdk::{
    Address, BytesN, Env, Symbol, Vec, contract, contractimpl, contracttype, symbol_short, token,
};

#[cfg(test)]
mod test;

#[cfg(test)]
mod upgrade_test;

#[cfg(test)]
mod fuzz_test;

#[cfg(kani)]
mod kani_test;

#[cfg(test)]
mod proptest;

// Storage keys - using separate enums for persistent vs instance storage
#[contracttype]
#[derive(Clone)]
pub enum StateKey {
    // Persistent storage - survives upgrades
    Admin,
    PendingAdmin,       // Two-step admin transfer
    Version,
    AuthorizedContract, // Contract authorized to modify liabilities (e.g., PayrollStream)
    TokenList,          // Tokens tracked by the vault
    // Additional state that should persist across upgrades
    TreasuryBalance(Address), // Funds held for payroll (Token -> Amount)
    TotalLiability(Address),  // Amount owed to recipients (Token -> Amount)
    // Timelock storage
    PendingUpgrade, // (wasm_hash, execute_after_timestamp)
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PendingUpgrade {
    pub wasm_hash: BytesN<32>,
    pub execute_after: u64,
    pub proposed_at: u64,
    pub proposed_by: Address,
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
pub struct TreasuryTokenSummary {
    pub token: Address,
    pub balance: i128,
    pub liability: i128,
}

#[contract]
pub struct PayrollVault;

// Event symbols
const UPGRADED: Symbol = symbol_short!("upgrd");
const UPGRADE_PROPOSED: Symbol = symbol_short!("up_prop");
const UPGRADE_EXECUTED: Symbol = symbol_short!("up_exec");
const UPGRADE_CANCELED: Symbol = symbol_short!("up_cancel");

// 48 hours in seconds
const TIMELOCK_DURATION: u64 = 48 * 60 * 60;

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

    /// Legacy upgrade function - now requires timelock
    /// DEPRECATED: Use propose_upgrade + execute_upgrade instead
    pub fn upgrade(
        e: Env,
        new_wasm_hash: BytesN<32>,
        new_version: (u32, u32, u32),
    ) -> Result<(), QuipayError> {
        // For backwards compatibility, automatically propose and execute if no timelock is active
        Self::propose_upgrade(e.clone(), new_wasm_hash.clone(), new_version)?;
        Self::execute_upgrade(e, new_version)
    }

    /// Propose an upgrade with a 48-hour timelock
    /// Only the admin can call this function
    pub fn propose_upgrade(
        e: Env,
        new_wasm_hash: BytesN<32>,
        new_version: (u32, u32, u32),
    ) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();

        let now = e.ledger().timestamp();
        let execute_after = now.saturating_add(TIMELOCK_DURATION);

        // Check if there's already a pending upgrade
        if e.storage().persistent().has(&StateKey::PendingUpgrade) {
            return Err(QuipayError::Custom);
        }

        let pending_upgrade = PendingUpgrade {
            wasm_hash: new_wasm_hash.clone(),
            execute_after,
            proposed_at: now,
            proposed_by: admin.clone(),
        };

        e.storage()
            .persistent()
            .set(&StateKey::PendingUpgrade, &pending_upgrade);

        // Emit upgrade proposed event
        #[allow(deprecated)]
        e.events().publish(
            (UPGRADE_PROPOSED, admin),
            (
                new_wasm_hash,
                new_version.0,
                new_version.1,
                new_version.2,
                execute_after,
            ),
        );

        Ok(())
    }

    /// Execute a proposed upgrade after the timelock period
    /// Only the admin can call this function
    pub fn execute_upgrade(e: Env, new_version: (u32, u32, u32)) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();

        let pending_upgrade: PendingUpgrade = e
            .storage()
            .persistent()
            .get(&StateKey::PendingUpgrade)
            .ok_or(QuipayError::Custom)?;

        let now = e.ledger().timestamp();
        if now < pending_upgrade.execute_after {
            return Err(QuipayError::Custom);
        }

        // Get current version for event
        let current_version = Self::get_version(e.clone())?;

        // Perform the upgrade
        e.deployer()
            .update_current_contract_wasm(pending_upgrade.wasm_hash.clone());

        // Update version info
        let (major, minor, patch) = new_version;
        let version_info = VersionInfo {
            major,
            minor,
            patch,
            upgraded_at: now,
        };
        e.storage()
            .persistent()
            .set(&StateKey::Version, &version_info);

        // Clear pending upgrade
        e.storage().persistent().remove(&StateKey::PendingUpgrade);

        // Emit upgrade executed event
        #[allow(deprecated)]
        e.events().publish(
            (UPGRADE_EXECUTED, admin),
            (
                pending_upgrade.wasm_hash,
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

    /// Cancel a pending upgrade
    /// Only the admin can call this function
    pub fn cancel_upgrade(e: Env) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();

        let pending_upgrade: PendingUpgrade = e
            .storage()
            .persistent()
            .get(&StateKey::PendingUpgrade)
            .ok_or(QuipayError::Custom)?;

        // Clear pending upgrade
        e.storage().persistent().remove(&StateKey::PendingUpgrade);

        // Emit upgrade canceled event
        #[allow(deprecated)]
        e.events().publish(
            (UPGRADE_CANCELED, admin),
            (pending_upgrade.wasm_hash, pending_upgrade.execute_after),
        );

        Ok(())
    }

    /// Get the current pending upgrade (if any)
    pub fn get_pending_upgrade(e: Env) -> Option<PendingUpgrade> {
        e.storage().persistent().get(&StateKey::PendingUpgrade)
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

    /// Get the pending admin address (if any)
    pub fn get_pending_admin(e: Env) -> Option<Address> {
        e.storage().persistent().get(&StateKey::PendingAdmin)
    }

    /// Propose a new admin (step 1 of two-step transfer)
    ///
    /// # Multisig Support
    /// The current admin must authorize this proposal. If the current admin is a multisig,
    /// the transaction must meet its threshold.
    pub fn propose_admin(e: Env, new_admin: Address) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();

        e.storage().persistent().set(&StateKey::PendingAdmin, &new_admin);
        Ok(())
    }

    /// Accept admin role (step 2 of two-step transfer)
    ///
    /// # Multisig Support
    /// The pending admin must authorize this acceptance. If the pending admin is a multisig,
    /// the transaction must meet its threshold before the transfer is finalized.
    pub fn accept_admin(e: Env) -> Result<(), QuipayError> {
        let pending_admin: Address = e
            .storage()
            .persistent()
            .get(&StateKey::PendingAdmin)
            .ok_or(QuipayError::NoPendingAdmin)?;
        
        pending_admin.require_auth();

        // Transfer admin rights
        e.storage().persistent().set(&StateKey::Admin, &pending_admin);
        // Clear pending admin
        e.storage().persistent().remove(&StateKey::PendingAdmin);
        
        Ok(())
    }

    /// Transfer admin rights to a new address (backward compatible - atomic version)
    ///
    /// This function maintains backward compatibility by atomically proposing and accepting
    /// the admin transfer. It calls propose_admin() and accept_admin() internally.
    ///
    /// # Multisig Support
    /// Supports transferring admin to another multisig account. The current admin
    /// must authorize the transfer. If the current admin is a multisig, the transaction
    /// must meet its threshold. The new admin can also be a multisig account.
    ///
    /// # Security Note
    /// For maximum security, use propose_admin() + accept_admin() separately to ensure
    /// the new admin address is correct before finalizing the transfer.
    pub fn transfer_admin(e: Env, new_admin: Address) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();

        // Atomic two-step: propose and accept
        e.storage().persistent().set(&StateKey::PendingAdmin, &new_admin);
        
        // Simulate accept by new admin (backward compatibility)
        e.storage().persistent().set(&StateKey::Admin, &new_admin);
        e.storage().persistent().remove(&StateKey::PendingAdmin);
        
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
        Self::track_supported_token(&e, token.clone());

        let token_client = token::Client::new(&e, &token);
        token_client.transfer(&from, e.current_contract_address(), &amount);

        e.events().publish(
            (
                symbol_short!("vault"),
                symbol_short!("deposited"),
                from.clone(),
                token.clone(),
            ),
            amount,
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
    pub fn withdraw(e: Env, to: Address, token: Address, amount: i128) -> Result<(), QuipayError> {
        to.require_auth();
        require_positive_amount!(amount);

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

        e.events().publish(
            (
                symbol_short!("vault"),
                symbol_short!("withdrawn"),
                to.clone(),
                token.clone(),
            ),
            amount,
        );

        Ok(())
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
            return Err(QuipayError::InvalidAmount);
        }

        let balance_key = StateKey::TreasuryBalance(token.clone());
        let liability_key = StateKey::TotalLiability(token.clone());

        let balance: i128 = e.storage().persistent().get(&balance_key).unwrap_or(0);
        let liability: i128 = e.storage().persistent().get(&liability_key).unwrap_or(0);

        if balance < liability + amount {
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
            amount,
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
            return Err(QuipayError::InvalidAmount);
        }

        let liability_key = StateKey::TotalLiability(token.clone());
        let liability: i128 = e.storage().persistent().get(&liability_key).unwrap_or(0);

        if amount > liability {
            return Err(QuipayError::InvalidAmount);
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
            amount,
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
            amount,
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
            .ok_or(QuipayError::NotInitialized)?;
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
            amount,
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
    pub fn set_authorized_contract(e: Env, contract: Address) -> Result<(), QuipayError> {
        let admin: Address = e
            .storage()
            .persistent()
            .get(&StateKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();

        e.storage()
            .persistent()
            .set(&StateKey::AuthorizedContract, &contract);
        Ok(())
    }

    /// Get the authorized contract address (if set)
    pub fn get_authorized_contract(e: Env) -> Option<Address> {
        e.storage().persistent().get(&StateKey::AuthorizedContract)
    }

    /// Add liability for a specific token
    /// Only the authorized contract (e.g., PayrollStream) can call this
    pub fn add_liability(e: Env, token: Address, amount: i128) -> Result<(), QuipayError> {
        // Require authorization from the authorized contract
        let authorized: Address = e
            .storage()
            .persistent()
            .get(&StateKey::AuthorizedContract)
            .ok_or(QuipayError::NotInitialized)?;
        authorized.require_auth();

        if amount <= 0 {
            return Err(QuipayError::InvalidAmount);
        }

        if !Self::check_solvency(e.clone(), token.clone(), amount) {
            return Err(QuipayError::InsufficientBalance);
        }

        let key = StateKey::TotalLiability(token);
        let current: i128 = e.storage().persistent().get(&key).unwrap_or(0);
        e.storage().persistent().set(&key, &(current + amount));
        Ok(())
    }

    /// Remove liability for a specific token
    /// Only the authorized contract (e.g., PayrollStream) can call this
    pub fn remove_liability(e: Env, token: Address, amount: i128) -> Result<(), QuipayError> {
        // Require authorization from the authorized contract
        let authorized: Address = e
            .storage()
            .persistent()
            .get(&StateKey::AuthorizedContract)
            .ok_or(QuipayError::NotInitialized)?;
        authorized.require_auth();

        if amount <= 0 {
            return Err(QuipayError::InvalidAmount);
        }

        let key = StateKey::TotalLiability(token);
        let current: i128 = e.storage().persistent().get(&key).unwrap_or(0);
        if amount > current {
            return Err(QuipayError::InvalidAmount);
        }
        e.storage().persistent().set(&key, &(current - amount));
        Ok(())
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

    /// Get all supported tokens tracked by the vault.
    pub fn get_supported_tokens(e: Env) -> Vec<Address> {
        e.storage()
            .persistent()
            .get(&StateKey::TokenList)
            .unwrap_or_else(|| Vec::new(&e))
    }

    /// Get a summary of treasury balances and liabilities for all tracked tokens.
    pub fn get_treasury_summary(e: Env) -> Vec<TreasuryTokenSummary> {
        let tokens = Self::get_supported_tokens(e.clone());
        let mut summary: Vec<TreasuryTokenSummary> = Vec::new(&e);

        let mut i = 0;
        while i < tokens.len() {
            let token = tokens.get(i).unwrap();
            let balance = Self::get_treasury_balance(e.clone(), token.clone());
            let liability = Self::get_total_liability(e.clone(), token.clone());

            summary.push_back(TreasuryTokenSummary {
                token,
                balance,
                liability,
            });
            i += 1;
        }

        summary
    }

    /// Get the current contract address
    pub fn get_contract_address(e: Env) -> Address {
        e.current_contract_address()
    }
}

impl PayrollVault {
    fn track_supported_token(e: &Env, token: Address) {
        let mut tokens = e
            .storage()
            .persistent()
            .get(&StateKey::TokenList)
            .unwrap_or_else(|| Vec::new(e));

        if tokens.contains(token.clone()) {
            return;
        }

        tokens.push_back(token);
        e.storage().persistent().set(&StateKey::TokenList, &tokens);
    }
}
