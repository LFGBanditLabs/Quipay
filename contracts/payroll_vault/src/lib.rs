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

#[cfg(test)]
mod multisig_dedup_test;

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
    PendingAdmin, // Pending admin address (for two-step transfer)
    Version,
    AuthorizedContract, // Contract authorized to modify liabilities (e.g., PayrollStream)
    TokenList,          // Tokens tracked by the vault
    // Additional state that should persist across upgrades
    TreasuryBalance(Address), // Funds held for payroll (Token -> Amount)
    TotalLiability(Address),  // Amount owed to recipients (Token -> Amount)
    // Timelock storage
    PendingUpgrade, // (wasm_hash, execute_after_timestamp)
    PendingDrain,   // Emergency drain proposal with 24-hour timelock
    // Multi-sig storage
    Signers,             // Vec<Address> - list of authorized signers
    Threshold,           // u32 - M of N required
    WithdrawalThreshold, // i128 - amount above which multisig is required
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

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PendingDrain {
    pub recipient: Address,
    pub execute_after: u64,
    pub proposed_at: u64,
    pub proposed_by: Address,
}

#[contract]
pub struct PayrollVault;

// Event symbols
const UPGRADED: Symbol = symbol_short!("upgrd");
const UPGRADE_PROPOSED: Symbol = symbol_short!("up_prop");
const UPGRADE_EXECUTED: Symbol = symbol_short!("up_exec");
const UPGRADE_CANCELED: Symbol = symbol_short!("up_cancel");
const SIGNER_ADDED: Symbol = symbol_short!("sig_add");
const SIGNER_REMOVED: Symbol = symbol_short!("sig_rm");
const THRESHOLD_SET: Symbol = symbol_short!("thr_set");
const DRAIN_PROPOSED: Symbol = symbol_short!("dr_prop");
const DRAIN_EXECUTED: Symbol = symbol_short!("dr_exec");
const DRAIN_CANCELED: Symbol = symbol_short!("dr_cncl");

// 48 hours in seconds
const TIMELOCK_DURATION: u64 = 48 * 60 * 60;

// 24 hours in seconds (emergency drain timelock)
const DRAIN_TIMELOCK_DURATION: u64 = 24 * 60 * 60;

// Default withdrawal threshold for multisig requirement (100,000 units)
const DEFAULT_WITHDRAWAL_THRESHOLD: i128 = 100_000;

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

        // Initialize with admin as the first signer
        let mut signers = Vec::new(&e);
        signers.push_back(admin.clone());
        e.storage().persistent().set(&StateKey::Signers, &signers);

        // Initialize threshold to 1 (single admin)
        e.storage().persistent().set(&StateKey::Threshold, &1u32);

        // Set default withdrawal threshold
        e.storage().persistent().set(
            &StateKey::WithdrawalThreshold,
            &DEFAULT_WITHDRAWAL_THRESHOLD,
        );

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
        Self::require_multisig_auth(&e)?;

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

    /// Propose a new admin address (first step of two-step transfer)
    /// Only the current admin can propose a new admin
    pub fn propose_admin(e: Env, new_admin: Address) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();

        e.storage()
            .persistent()
            .set(&StateKey::PendingAdmin, &new_admin);
        Ok(())
    }

    /// Get the pending admin address (if any)
    pub fn get_pending_admin(e: Env) -> Option<Address> {
        e.storage().persistent().get(&StateKey::PendingAdmin)
    }

    /// Accept the admin role (second step of two-step transfer)
    /// Only the pending admin can call this function
    pub fn accept_admin(e: Env) -> Result<(), QuipayError> {
        let pending_admin =
            Self::get_pending_admin(e.clone()).ok_or(QuipayError::NoPendingAdmin)?;

        pending_admin.require_auth();

        // Set the new admin
        e.storage()
            .persistent()
            .set(&StateKey::Admin, &pending_admin);

        // Clear the pending admin
        e.storage().persistent().remove(&StateKey::PendingAdmin);

        Ok(())
    }

    // ==================== Multi-sig Admin Functions ====================

    /// Add a new authorized signer
    /// Only admin can call this function
    pub fn add_signer(e: Env, new_signer: Address) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();

        let mut signers: Vec<Address> = e
            .storage()
            .persistent()
            .get(&StateKey::Signers)
            .ok_or(QuipayError::NoSigners)?;

        // Check if already a signer
        let mut i = 0;
        while i < signers.len() {
            if let Some(s) = signers.get(i) {
                if s == new_signer {
                    return Err(QuipayError::AlreadySigner);
                }
            }
            i += 1;
        }

        signers.push_back(new_signer.clone());
        e.storage().persistent().set(&StateKey::Signers, &signers);

        #[allow(deprecated)]
        e.events().publish((SIGNER_ADDED, admin), new_signer);
        Ok(())
    }

    /// Remove an authorized signer
    /// Only admin can call this function
    pub fn remove_signer(e: Env, signer_to_remove: Address) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();

        let signers: Vec<Address> = e
            .storage()
            .persistent()
            .get(&StateKey::Signers)
            .ok_or(QuipayError::NoSigners)?;

        let threshold: u32 = e
            .storage()
            .persistent()
            .get(&StateKey::Threshold)
            .unwrap_or(1);

        // Ensure we don't go below threshold
        if signers.len() <= threshold {
            return Err(QuipayError::InvalidThreshold);
        }

        let mut found = false;
        let mut new_signers = Vec::new(&e);
        let mut i = 0;
        while i < signers.len() {
            if let Some(s) = signers.get(i) {
                if s == signer_to_remove {
                    found = true;
                } else {
                    new_signers.push_back(s);
                }
            }
            i += 1;
        }

        if !found {
            return Err(QuipayError::SignerNotFound);
        }

        e.storage()
            .persistent()
            .set(&StateKey::Signers, &new_signers);
        #[allow(deprecated)]
        e.events()
            .publish((SIGNER_REMOVED, admin), signer_to_remove);
        Ok(())
    }

    /// Set the M-of-N threshold for multi-sig operations
    /// Only admin can call this function
    pub fn set_threshold(e: Env, threshold: u32) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();

        let signers: Vec<Address> = e
            .storage()
            .persistent()
            .get(&StateKey::Signers)
            .ok_or(QuipayError::NoSigners)?;

        if threshold == 0 || threshold > signers.len() {
            return Err(QuipayError::InvalidThreshold);
        }

        e.storage()
            .persistent()
            .set(&StateKey::Threshold, &threshold);
        #[allow(deprecated)]
        e.events().publish((THRESHOLD_SET, admin), threshold);
        Ok(())
    }

    /// Set the withdrawal threshold (amount above which multisig is required)
    /// Only admin can call this function
    pub fn set_withdrawal_threshold(e: Env, threshold: i128) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();

        if threshold < 0 {
            return Err(QuipayError::InvalidAmount);
        }

        e.storage()
            .persistent()
            .set(&StateKey::WithdrawalThreshold, &threshold);
        Ok(())
    }

    /// Get the withdrawal threshold (amount above which multisig is required).
    /// Returns 0 if no threshold has been set.
    pub fn get_withdrawal_threshold(e: Env) -> i128 {
        e.storage()
            .persistent()
            .get(&StateKey::WithdrawalThreshold)
            .unwrap_or(0)
    }

    /// Get all authorized signers
    pub fn get_signers(e: Env) -> Vec<Address> {
        e.storage()
            .persistent()
            .get(&StateKey::Signers)
            .unwrap_or(Vec::new(&e))
    }

    /// Get the current threshold
    pub fn get_threshold(e: Env) -> u32 {
        e.storage()
            .persistent()
            .get(&StateKey::Threshold)
            .unwrap_or(1)
    }

    /// Check if an address is an authorized signer
    pub fn is_signer(e: Env, address: Address) -> bool {
        let signers: Vec<Address> = e
            .storage()
            .persistent()
            .get(&StateKey::Signers)
            .unwrap_or(Vec::new(&e));

        let mut i = 0;
        while i < signers.len() {
            if let Some(s) = signers.get(i) {
                if s == address {
                    return true;
                }
            }
            i += 1;
        }
        false
    }

    // ==================== Treasury Operations ====================

    pub fn deposit(e: Env, from: Address, token: Address, amount: i128) -> Result<(), QuipayError> {
        from.require_auth();
        require_positive_amount!(amount);

        // Update treasury balance
        let key = StateKey::TreasuryBalance(token.clone());
        let current_balance: i128 = e.storage().persistent().get(&key).unwrap_or(0);
        let new_total = current_balance + amount;
        e.storage()
            .persistent()
            .set(&key, &new_total);
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
            (amount, new_total),
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

        let withdrawal_threshold: i128 = e
            .storage()
            .persistent()
            .get(&StateKey::WithdrawalThreshold)
            .unwrap_or(DEFAULT_WITHDRAWAL_THRESHOLD);
        if amount >= withdrawal_threshold {
            Self::require_multisig_auth(&e)?;
        }

        let available = Self::get_available_balance(e.clone(), token.clone());
        if amount > available {
            return Err(QuipayError::InsufficientBalance);
        }

        let balance_key = StateKey::TreasuryBalance(token.clone());
        let balance: i128 = e.storage().persistent().get(&balance_key).unwrap_or(0);
        let new_total = balance - amount;
        // If the invariant holds, this should never underflow.
        e.storage()
            .persistent()
            .set(&balance_key, &new_total);

        let token_client = token::Client::new(&e, &token);
        token_client.transfer(&e.current_contract_address(), &to, &amount);

        e.events().publish(
            (
                symbol_short!("vault"),
                symbol_short!("withdrawn"),
                to.clone(),
                token.clone(),
            ),
            (amount, new_total),
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
                symbol_short!("alloc"),
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
                symbol_short!("release"),
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

        let key = StateKey::TotalLiability(token.clone());
        let current: i128 = e.storage().persistent().get(&key).unwrap_or(0);
        e.storage().persistent().set(&key, &(current + amount));

        e.events().publish(
            (
                symbol_short!("vault"),
                symbol_short!("add_lia"),
                token,
                authorized,
            ),
            amount,
        );

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

        let key = StateKey::TotalLiability(token.clone());
        let current: i128 = e.storage().persistent().get(&key).unwrap_or(0);
        if amount > current {
            return Err(QuipayError::InvalidAmount);
        }
        e.storage().persistent().set(&key, &(current - amount));

        e.events().publish(
            (
                symbol_short!("vault"),
                symbol_short!("rem_lia"),
                token,
                authorized,
            ),
            amount,
        );

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

    // ==================== Emergency Drain (Timelock) ====================

    /// Propose an emergency drain of all vault funds to `recipient`.
    ///
    /// Starts a 24-hour timelock. Only the admin can call this function.
    /// Off-chain monitors should observe the `DRAIN_PROPOSED` event and alert
    /// token holders so they can exit before the drain executes.
    ///
    /// Emits: `(DRAIN_PROPOSED, admin)` → `(recipient, execute_after)`
    pub fn propose_emergency_drain(e: Env, recipient: Address) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();

        // Disallow stacking proposals – cancel first, then re-propose.
        if e.storage().persistent().has(&StateKey::PendingDrain) {
            return Err(QuipayError::Custom);
        }

        let now = e.ledger().timestamp();
        let execute_after = now.saturating_add(DRAIN_TIMELOCK_DURATION);

        let pending = PendingDrain {
            recipient: recipient.clone(),
            execute_after,
            proposed_at: now,
            proposed_by: admin.clone(),
        };

        e.storage()
            .persistent()
            .set(&StateKey::PendingDrain, &pending);

        #[allow(deprecated)]
        e.events()
            .publish((DRAIN_PROPOSED, admin), (recipient, execute_after));

        Ok(())
    }

    /// Execute a pending emergency drain after the 24-hour timelock has expired.
    ///
    /// Permissionless after the timelock: anyone can call this once the window
    /// opens, ensuring liveness even if the admin key is unavailable.
    /// Drains every tracked token's full on-chain balance to the `recipient`
    /// recorded in the proposal.
    ///
    /// Emits: `(DRAIN_EXECUTED, recipient)` → `(token, amount)` per token,
    ///         then `(DRAIN_EXECUTED, recipient)` → `"done"` as a final marker.
    pub fn execute_emergency_drain(e: Env) -> Result<(), QuipayError> {
        let pending: PendingDrain = e
            .storage()
            .persistent()
            .get(&StateKey::PendingDrain)
            .ok_or(QuipayError::NoDrainPending)?;

        let now = e.ledger().timestamp();
        if now < pending.execute_after {
            return Err(QuipayError::DrainTimelockActive);
        }

        let recipient = pending.recipient.clone();

        // Drain every tracked token.
        let tokens: Vec<Address> = e
            .storage()
            .persistent()
            .get(&StateKey::TokenList)
            .unwrap_or_else(|| Vec::new(&e));

        let mut i = 0;
        while i < tokens.len() {
            let token = tokens.get(i).unwrap();
            let token_client = token::Client::new(&e, &token);
            let on_chain_balance = token_client.balance(&e.current_contract_address());

            if on_chain_balance > 0 {
                // Wipe internal accounting for this token.
                e.storage()
                    .persistent()
                    .set(&StateKey::TreasuryBalance(token.clone()), &0i128);
                e.storage()
                    .persistent()
                    .set(&StateKey::TotalLiability(token.clone()), &0i128);

                token_client.transfer(&e.current_contract_address(), &recipient, &on_chain_balance);

                #[allow(deprecated)]
                e.events().publish(
                    (DRAIN_EXECUTED, recipient.clone()),
                    (token, on_chain_balance),
                );
            }

            i += 1;
        }

        // Remove the pending proposal.
        e.storage().persistent().remove(&StateKey::PendingDrain);

        Ok(())
    }

    /// Cancel a pending emergency drain proposal.
    ///
    /// Only the admin can call this function.
    ///
    /// Emits: `(DRAIN_CANCELED, admin)` → `(recipient, execute_after)`
    pub fn cancel_emergency_drain(e: Env) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();

        let pending: PendingDrain = e
            .storage()
            .persistent()
            .get(&StateKey::PendingDrain)
            .ok_or(QuipayError::NoDrainPending)?;

        e.storage().persistent().remove(&StateKey::PendingDrain);

        #[allow(deprecated)]
        e.events().publish(
            (DRAIN_CANCELED, admin),
            (pending.recipient, pending.execute_after),
        );

        Ok(())
    }

    /// Return the currently pending emergency drain proposal, if any.
    pub fn get_pending_drain(e: Env) -> Option<PendingDrain> {
        e.storage().persistent().get(&StateKey::PendingDrain)
    }

    /// Get the current contract address
    pub fn get_contract_address(e: Env) -> Address {
        e.current_contract_address()
    }
}

impl PayrollVault {
    /// Verify that the required number of signers have authorized the transaction.
    ///
    /// ### Deduplication
    /// This function ensures each signer is unique by checking for duplicates in the
    /// signer list. This prevents a single key from satisfying the threshold multiple
    /// times by appearing in the list more than once.
    ///
    /// ### Requirements
    /// - At least `threshold` unique signers must authorize
    /// - Duplicate signers in the list are rejected
    /// - Threshold must be valid (> 0 and <= number of signers)
    fn require_multisig_auth(e: &Env) -> Result<(), QuipayError> {
        let signers: Vec<Address> = e
            .storage()
            .persistent()
            .get(&StateKey::Signers)
            .ok_or(QuipayError::NoSigners)?;

        let threshold: u32 = e
            .storage()
            .persistent()
            .get(&StateKey::Threshold)
            .unwrap_or(1);

        if threshold == 0 || threshold > signers.len() {
            return Err(QuipayError::InvalidThreshold);
        }

        // Check for duplicate signers to prevent a single key from satisfying threshold multiple times
        let mut i = 0;
        while i < signers.len() {
            let signer_i = signers.get(i).ok_or(QuipayError::SignerNotFound)?;
            let mut j = i + 1;
            while j < signers.len() {
                let signer_j = signers.get(j).ok_or(QuipayError::SignerNotFound)?;
                if signer_i == signer_j {
                    return Err(QuipayError::DuplicateSigner);
                }
                j += 1;
            }
            i += 1;
        }

        // Require auth from the first `threshold` signers
        let mut i = 0;
        while i < threshold {
            let signer = signers.get(i).ok_or(QuipayError::SignerNotFound)?;
            signer.require_auth();
            i += 1;
        }

        Ok(())
    }

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
