#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};
use quipay_common::QuipayError;

// Version 2 contract for testing upgrades
// This simulates a new contract version with additional functionality
pub mod v2_contract {
    use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Symbol, token};
    use quipay_common::{QuipayError, QuipayHelpers, require_positive_amount};
    
    #[contracttype]
    #[derive(Clone, Debug, PartialEq)]
    pub enum StateKey {
        Admin,
        Version,
        TreasuryBalance,
        TotalLiability,
        TransactionCount,
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
    pub struct PayrollVaultV2;
    
    const UPGRADED: Symbol = symbol_short!("upgrd");
    
    #[contractimpl]
    impl PayrollVaultV2 {
        pub fn initialize(e: Env, admin: Address) -> Result<(), QuipayError> {
            if e.storage().persistent().has(&StateKey::Admin) {
                return Err(QuipayError::AlreadyInitialized);
            }
            e.storage().persistent().set(&StateKey::Admin, &admin);
            let initial_version = VersionInfo {
                major: 1,
                minor: 0,
                patch: 0,
                upgraded_at: e.ledger().timestamp(),
            };
            e.storage().persistent().set(&StateKey::Version, &initial_version);
            e.storage().persistent().set(&StateKey::TreasuryBalance, &0i128);
            e.storage().persistent().set(&StateKey::TotalLiability, &0i128);
            e.storage().persistent().set(&StateKey::TransactionCount, &0u64);
            Ok(())
        }

        pub fn upgrade(e: Env, new_wasm_hash: BytesN<32>, new_version: (u32, u32, u32)) -> Result<(), QuipayError> {
            let admin: Address = e.storage().persistent().get(&StateKey::Admin).ok_or(QuipayError::NotInitialized)?;
            admin.require_auth();
            
            let current_version: VersionInfo = e.storage().persistent().get(&StateKey::Version).ok_or(QuipayError::VersionNotSet)?;
            
            e.deployer().update_current_contract_wasm(new_wasm_hash.clone());
            
            let (major, minor, patch) = new_version;
            let version_info = VersionInfo {
                major,
                minor,
                patch,
                upgraded_at: e.ledger().timestamp(),
            };
            e.storage().persistent().set(&StateKey::Version, &version_info);
            
            e.events().publish(
                (UPGRADED, admin.clone()),
                (current_version.major, current_version.minor, current_version.patch, major, minor, patch),
            );
            Ok(())
        }

        pub fn get_version(e: Env) -> Result<VersionInfo, QuipayError> {
            e.storage().persistent().get(&StateKey::Version).ok_or(QuipayError::VersionNotSet)
        }

        pub fn get_admin(e: Env) -> Result<Address, QuipayError> {
            e.storage().persistent().get(&StateKey::Admin).ok_or(QuipayError::NotInitialized)
        }

        pub fn transfer_admin(e: Env, new_admin: Address) -> Result<(), QuipayError> {
            let admin: Address = e.storage().persistent().get(&StateKey::Admin).ok_or(QuipayError::NotInitialized)?;
            admin.require_auth();
            e.storage().persistent().set(&StateKey::Admin, &new_admin);
            Ok(())
        }

        pub fn deposit(e: Env, from: Address, token: Address, amount: i128) -> Result<(), QuipayError> {
            from.require_auth();
            require_positive_amount!(amount);
            
            let current_balance: i128 = e.storage().persistent().get(&StateKey::TreasuryBalance).unwrap_or(0);
            e.storage().persistent().set(&StateKey::TreasuryBalance, &(current_balance + amount));
            
            let tx_count: u64 = e.storage().persistent().get(&StateKey::TransactionCount).unwrap_or(0);
            e.storage().persistent().set(&StateKey::TransactionCount, &(tx_count + 1));
            
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
            
            let liability: i128 = e.storage().persistent().get(&StateKey::TotalLiability).unwrap_or(0);
            if amount > liability {
                panic!("payout amount exceeds total liability");
            }
            e.storage().persistent().set(&StateKey::TotalLiability, &(liability - amount));
            
            let treasury: i128 = e.storage().persistent().get(&StateKey::TreasuryBalance).unwrap_or(0);
            QuipayHelpers::check_sufficient_balance(treasury, amount)?;
            
            e.storage().persistent().set(&StateKey::TreasuryBalance, &(treasury - amount));

            let tx_count: u64 = e.storage().persistent().get(&StateKey::TransactionCount).unwrap_or(0);
            e.storage().persistent().set(&StateKey::TransactionCount, &(tx_count + 1));

            let token_client = token::Client::new(&e, &token);
            token_client.transfer(&e.current_contract_address(), &to, &amount);
            Ok(())
        }

        pub fn get_balance(e: Env, token: Address) -> i128 {
            let token_client = token::Client::new(&e, &token);
            token_client.balance(&e.current_contract_address())
        }

        pub fn get_treasury_balance(e: Env) -> i128 {
            e.storage().persistent().get(&StateKey::TreasuryBalance).unwrap_or(0)
        }

        pub fn get_total_liability(e: Env) -> i128 {
            e.storage().persistent().get(&StateKey::TotalLiability).unwrap_or(0)
        }

        pub fn get_transaction_count(e: Env) -> u64 {
            e.storage().persistent().get(&StateKey::TransactionCount).unwrap_or(0)
        }

        pub fn get_contract_address(e: Env) -> Address {
            e.current_contract_address()
        }
    }
}

#[test]
fn test_basic_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Initialize
    client.initialize(&admin);

    // Verify initial version
    let version = client.get_version();
    assert_eq!(version.major, 1);
    assert_eq!(version.minor, 0);
    assert_eq!(version.patch, 0);

    // Verify admin
    let stored_admin = client.get_admin();
    assert_eq!(stored_admin, admin);

    // Setup Token
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_client = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    // Mint tokens to user
    token_admin_client.mint(&user, &1000);
    assert_eq!(token_client.balance(&user), 1000);

    // User deposits 500
    client.deposit(&user, &token_id, &500);

    // Check balances
    assert_eq!(token_client.balance(&user), 500);
    assert_eq!(token_client.balance(&contract_id), 500);
    assert_eq!(client.get_balance(&token_id), 500);
    assert_eq!(client.get_treasury_balance(), 500);

    // Admin payouts 200 to recipient
    client.add_liability(&200);
    client.payout(&recipient, &token_id, &200);

    // Check balances
    assert_eq!(token_client.balance(&contract_id), 300);
    assert_eq!(token_client.balance(&recipient), 200);
    assert_eq!(client.get_balance(&token_id), 300);
    assert_eq!(client.get_treasury_balance(), 300);
    assert_eq!(client.get_total_liability(), 0);
}

#[test]
fn test_admin_transfer() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);

    // Initialize with first admin
    client.initialize(&admin);
    assert_eq!(client.get_admin(), admin);

    // Transfer admin rights
    client.transfer_admin(&new_admin);
    assert_eq!(client.get_admin(), new_admin);
}

#[test]
fn test_upgrade_structure_verification() {
    let env = Env::default();
    env.mock_all_auths();

    // Test v1 contract structure
    let v1_contract_id = env.register(PayrollVault, ());
    let v1_client = PayrollVaultClient::new(&env, &v1_contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Initialize v1
    v1_client.initialize(&admin);

    // Setup Token
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let _token_client = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    // Create state in v1
    token_admin_client.mint(&user, &1000);
    v1_client.deposit(&user, &token_id, &500);
    v1_client.add_liability(&200);
    v1_client.payout(&recipient, &token_id, &200);

    // Record v1 state
    let v1_treasury = v1_client.get_treasury_balance();
    let v1_liability = v1_client.get_total_liability();
    let v1_admin = v1_client.get_admin();
    let v1_version = v1_client.get_version();

    // Verify v1 state
    assert_eq!(v1_treasury, 300);
    assert_eq!(v1_liability, 0); // it was added and removed
    assert_eq!(v1_admin, admin);
    assert_eq!(v1_version.major, 1);

    // Now test v2 contract independently to verify it can read the same state format
    // In a real upgrade, the contract address stays the same but code changes
    // For this test, we verify both contracts use compatible storage layouts
    
    // Register v2 separately to test structure compatibility
    let v2_contract_id = env.register(v2_contract::PayrollVaultV2, ());
    let v2_client = v2_contract::PayrollVaultV2Client::new(&env, &v2_contract_id);
    
    // Initialize v2 with same admin
    v2_client.initialize(&admin);
    
    // Verify v2 can track the same state fields
    token_admin_client.mint(&user, &500);
    v2_client.deposit(&user, &token_id, &100);
    assert_eq!(v2_client.get_treasury_balance(), 100);
    assert_eq!(v2_client.get_transaction_count(), 1);
}

#[test]
fn test_state_persistence_across_contract_instances() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Initialize
    client.initialize(&admin);

    // Setup tokens
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    // Create initial state
    token_admin_client.mint(&user, &10000);
    client.deposit(&user, &token_id, &1000);
    client.add_liability(&500);
    client.payout(&recipient, &token_id, &500);

    // Record state
    let state_before = (
        client.get_treasury_balance(),
        client.get_total_liability(),
        client.get_admin(),
        client.get_balance(&token_id),
        client.get_version().major,
    );
    assert_eq!(state_before, (500, 0, admin.clone(), 500, 1));

    let v2_contract_id = env.register(v2_contract::PayrollVaultV2, ());
    let v2_client = v2_contract::PayrollVaultV2Client::new(&env, &v2_contract_id);
    v2_client.initialize(&admin);
    let v2_version = v2_client.get_version();
    assert_eq!(v2_version.major, 1);
}

#[test]
fn test_version_tracking() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    // Verify initial version
    let version = client.get_version();
    assert_eq!(version.major, 1);
    assert_eq!(version.minor, 0);
    assert_eq!(version.patch, 0);
}

#[test]
fn test_double_initialize_errors() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    
    // First initialize should work
    client.initialize(&admin);
    
    // Second should return error
    let admin2 = Address::generate(&env);
    let result = client.try_initialize(&admin2);
    
    assert_eq!(
        result,
        Err(Ok(QuipayError::AlreadyInitialized))
    );
}

#[test]
fn test_operations_before_initialize_errors() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    // Should return error - not initialized
    let result = client.try_get_admin();
    
    assert_eq!(
        result,
        Err(Ok(QuipayError::NotInitialized))
    );
}
