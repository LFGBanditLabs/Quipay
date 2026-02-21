#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Symbol, token};
use quipay_common::{QuipayError, require_positive_amount, QuipayHelpers};

#[cfg(test)]
mod test;

#[cfg(test)]
mod upgrade_test;

// Storage keys - using separate enums for persistent vs instance storage
#[contracttype]
#[derive(Clone)]
pub enum StateKey {
    // Persistent storage - survives upgrades
    Admin,
    Version,
    // Additional state that should persist across upgrades
    TreasuryBalance, // Total funds held for payroll
    TotalLiability,  // Total amount owed to recipients
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct VersionInfo {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
    pub upgraded_at: u64,
}

#[contract]
pub struct PayrollVault;

// Event symbols
const UPGRADED: Symbol = symbol_short!("upgrd");

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
        e.storage().persistent().set(&StateKey::Version, &initial_version);
        
        // Initialize state
        e.storage().persistent().set(&StateKey::TreasuryBalance, &0i128);
        e.storage().persistent().set(&StateKey::TotalLiability, &0i128);
        Ok(())
    }

    /// Upgrade the contract to a new WASM code
    /// Only the admin can call this function
    pub fn upgrade(e: Env, new_wasm_hash: BytesN<32>, new_version: (u32, u32, u32)) -> Result<(), QuipayError> {
        // Require admin authorization
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();
        
        // Get current version for event
        let current_version = Self::get_version(e.clone())?;
        
        // Perform the upgrade - this updates the contract's WASM code
        // All persistent storage remains intact
        e.deployer().update_current_contract_wasm(new_wasm_hash.clone());
        
        // Update version info (WASM hash is passed as parameter, not stored)
        let (major, minor, patch) = new_version;
        let version_info = VersionInfo {
            major,
            minor,
            patch,
            upgraded_at: e.ledger().timestamp(),
        };
        e.storage().persistent().set(&StateKey::Version, &version_info);
        
        // Emit upgrade event
        e.events().publish(
            (UPGRADED, admin.clone()),
            (current_version.major, current_version.minor, current_version.patch, major, minor, patch),
        );
        Ok(())
    }

    /// Get the current version information
    pub fn get_version(e: Env) -> Result<VersionInfo, QuipayError> {
        e.storage().persistent().get(&StateKey::Version).ok_or(QuipayError::VersionNotSet)
    }

    /// Get the current admin address
    pub fn get_admin(e: Env) -> Result<Address, QuipayError> {
        e.storage().persistent().get(&StateKey::Admin).ok_or(QuipayError::NotInitialized)
    }

    /// Transfer admin rights to a new address
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
        let current_balance: i128 = e.storage().persistent().get(&StateKey::TreasuryBalance).unwrap_or(0);
        e.storage().persistent().set(&StateKey::TreasuryBalance, &(current_balance + amount));
        
        let token_client = token::Client::new(&e, &token);
        token_client.transfer(&from, &e.current_contract_address(), &amount);
        Ok(())
    }

    pub fn add_liability(e: Env, amount: i128) {
        let admin: Address = e.storage().persistent().get(&StateKey::Admin).expect("not initialized");
        admin.require_auth();
        
        if amount <= 0 {
            panic!("liability amount must be positive");
        }
        
        // Check solvency
        let liability: i128 = e.storage().persistent().get(&StateKey::TotalLiability).unwrap_or(0);
        let treasury: i128 = e.storage().persistent().get(&StateKey::TreasuryBalance).unwrap_or(0);
        
        let new_liability = liability.checked_add(amount).expect("liability overflow");
        if new_liability > treasury {
            panic!("insufficient treasury balance for new liability");
        }
        
        e.storage().persistent().set(&StateKey::TotalLiability, &new_liability);
    }

    pub fn payout(e: Env, to: Address, token: Address, amount: i128) {
        let admin: Address = e.storage().persistent().get(&StateKey::Admin).expect("not initialized");
        admin.require_auth();
        
        require_positive_amount!(amount);
        
        // Update liability and treasury
        let liability: i128 = e.storage().persistent().get(&StateKey::TotalLiability).unwrap_or(0);
        if amount > liability {
            panic!("payout amount exceeds total liability");
        }
        e.storage().persistent().set(&StateKey::TotalLiability, &(liability - amount));
        
        let treasury: i128 = e.storage().persistent().get(&StateKey::TreasuryBalance).unwrap_or(0);
        QuipayHelpers::check_sufficient_balance(treasury, amount)?;
        
        e.storage().persistent().set(&StateKey::TreasuryBalance, &(treasury - amount));

        let token_client = token::Client::new(&e, &token);
        token_client.transfer(&e.current_contract_address(), &to, &amount);
        Ok(())
    }

    pub fn get_balance(e: Env, token: Address) -> i128 {
        let token_client = token::Client::new(&e, &token);
        token_client.balance(&e.current_contract_address())
    }

    /// Get the tracked treasury balance from state
    pub fn get_treasury_balance(e: Env) -> i128 {
        e.storage().persistent().get(&StateKey::TreasuryBalance).unwrap_or(0)
    }

    /// Get the total liability from state  
    pub fn get_total_liability(e: Env) -> i128 {
        e.storage().persistent().get(&StateKey::TotalLiability).unwrap_or(0)
    }

    /// Get the current contract address
    pub fn get_contract_address(e: Env) -> Address {
        e.current_contract_address()
    }
}
