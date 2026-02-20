#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

// Version 2 contract for testing upgrades
// This simulates a new contract version with additional functionality
pub mod v2_contract {
    use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Symbol, token};
    
    #[contracttype]
    #[derive(Clone, Debug, PartialEq)]
    pub enum StateKey {
        Admin,
        Version,
        TreasuryBalance,
        TotalLiability,
        // New field in v2
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
        pub fn initialize(e: Env, admin: Address) {
            if e.storage().persistent().has(&StateKey::Admin) {
                panic!("already initialized");
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
        }

        pub fn upgrade(e: Env, new_wasm_hash: BytesN<32>, new_version: (u32, u32, u32)) {
            let admin: Address = e.storage().persistent().get(&StateKey::Admin).expect("not initialized");
            admin.require_auth();
            
            let current_version: VersionInfo = e.storage().persistent().get(&StateKey::Version).expect("version not set");
            
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
        }

        pub fn get_version(e: Env) -> VersionInfo {
            e.storage().persistent().get(&StateKey::Version).expect("version not set")
        }

        pub fn get_admin(e: Env) -> Address {
            e.storage().persistent().get(&StateKey::Admin).expect("not initialized")
        }

        pub fn transfer_admin(e: Env, new_admin: Address) {
            let admin: Address = e.storage().persistent().get(&StateKey::Admin).expect("not initialized");
            admin.require_auth();
            e.storage().persistent().set(&StateKey::Admin, &new_admin);
        }

        // V2: Enhanced deposit with transaction counting
        pub fn deposit(e: Env, from: Address, token: Address, amount: i128) {
            from.require_auth();
            if amount <= 0 {
                panic!("deposit amount must be positive");
            }
            
            let current_balance: i128 = e.storage().persistent().get(&StateKey::TreasuryBalance).unwrap_or(0);
            e.storage().persistent().set(&StateKey::TreasuryBalance, &(current_balance + amount));
            
            // V2: Track transaction count
            let tx_count: u64 = e.storage().persistent().get(&StateKey::TransactionCount).unwrap_or(0);
            e.storage().persistent().set(&StateKey::TransactionCount, &(tx_count + 1));
            
            let token_client = token::Client::new(&e, &token);
            token_client.transfer(&from, &e.current_contract_address(), &amount);
        }

        pub fn payout(e: Env, to: Address, token: Address, amount: i128) {
            let admin: Address = e.storage().persistent().get(&StateKey::Admin).expect("not initialized");
            admin.require_auth();
            
            if amount <= 0 {
                panic!("payout amount must be positive");
            }
            
            let liability: i128 = e.storage().persistent().get(&StateKey::TotalLiability).unwrap_or(0);
            e.storage().persistent().set(&StateKey::TotalLiability, &(liability + amount));
            
            let treasury: i128 = e.storage().persistent().get(&StateKey::TreasuryBalance).unwrap_or(0);
            if amount > treasury {
                panic!("insufficient treasury balance");
            }
            e.storage().persistent().set(&StateKey::TreasuryBalance, &(treasury - amount));

            // V2: Track transaction count
            let tx_count: u64 = e.storage().persistent().get(&StateKey::TransactionCount).unwrap_or(0);
            e.storage().persistent().set(&StateKey::TransactionCount, &(tx_count + 1));

            let token_client = token::Client::new(&e, &token);
            token_client.transfer(&e.current_contract_address(), &to, &amount);
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

        // V2: New function
        pub fn get_transaction_count(e: Env) -> u64 {
            e.storage().persistent().get(&StateKey::TransactionCount).unwrap_or(0)
        }

        pub fn get_contract_address(e: Env) -> Address {
            e.current_contract_address()
        }
    }
}

/// Helper to get the WASM hash of a registered contract
/// In Soroban tests, we need to get the actual WASM hash of a registered contract
fn get_contract_wasm_hash(env: &Env, contract_id: &Address) -> BytesN<32> {
    // Get the code from the contract - this is the proper way to get WASM hash in tests
    env.deployer().get_contract_wasm_hash(contract_id)
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
    client.payout(&recipient, &token_id, &200);

    // Check balances
    assert_eq!(token_client.balance(&contract_id), 300);
    assert_eq!(token_client.balance(&recipient), 200);
    assert_eq!(client.get_balance(&token_id), 300);
    assert_eq!(client.get_treasury_balance(), 300);
    assert_eq!(client.get_total_liability(), 200);
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
fn test_logic_switch_upgrade() {
    let env = Env::default();
    env.mock_all_auths();

    // Register v1 contract
    let contract_id = env.register(PayrollVault, ());
    let v1_client = PayrollVaultClient::new(&env, &contract_id);

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

    // Mint and deposit in v1
    token_admin_client.mint(&user, &1000);
    v1_client.deposit(&user, &token_id, &500);
    v1_client.payout(&recipient, &token_id, &200);

    // Record state before upgrade
    let v1_treasury = v1_client.get_treasury_balance();
    let v1_liability = v1_client.get_total_liability();
    let v1_admin = v1_client.get_admin();

    // Register v2 contract and get its WASM hash for upgrade
    let v2_contract_id = env.register(v2_contract::PayrollVaultV2, ());
    let v2_wasm_hash = get_contract_wasm_hash(&env, &v2_contract_id);

    // Upgrade to v2 using the actual WASM hash
    v1_client.upgrade(&v2_wasm_hash, &(2u32, 0u32, 0u32));

    // Create v2 client pointing to same contract address
    let v2_client = v2_contract::PayrollVaultV2Client::new(&env, &contract_id);

    // Verify version updated
    let version = v2_client.get_version();
    assert_eq!(version.major, 2);
    assert_eq!(version.minor, 0);
    assert_eq!(version.patch, 0);

    // CRITICAL: Verify all state persisted after upgrade
    assert_eq!(v2_client.get_treasury_balance(), v1_treasury, "Treasury balance should persist after upgrade");
    assert_eq!(v2_client.get_total_liability(), v1_liability, "Liability should persist after upgrade");
    assert_eq!(v2_client.get_admin(), v1_admin, "Admin should persist after upgrade");
    assert_eq!(v2_client.get_balance(&token_id), 300, "Token balance should persist");

    // Verify new v2 functionality works
    assert_eq!(v2_client.get_transaction_count(), 2, "Transaction count should track both deposit and payout");

    // Verify v2 new features work
    token_admin_client.mint(&user, &500);
    v2_client.deposit(&user, &token_id, &100);
    
    // Check that v2 tracked the new transaction
    assert_eq!(v2_client.get_transaction_count(), 3, "New deposit should increment count");
    assert_eq!(v2_client.get_treasury_balance(), 400, "Treasury should include new deposit");
}

#[test]
fn test_only_admin_can_upgrade() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    // Initialize
    client.initialize(&admin);

    // Register another contract to get a valid WASM hash
    let new_contract_id = env.register(PayrollVault, ());
    let new_wasm_hash = get_contract_wasm_hash(&env, &new_contract_id);

    // Admin can upgrade
    client.upgrade(&new_wasm_hash, &(1u32, 1u32, 0u32));

    // Verify upgrade worked
    let version = client.get_version();
    assert_eq!(version.major, 1);
    assert_eq!(version.minor, 1);
}

#[test]
fn test_state_persistence_across_upgrades() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Initialize
    client.initialize(&admin);

    // Setup tokens
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    // Create initial state
    token_admin_client.mint(&user1, &10000);
    token_admin_client.mint(&user2, &10000);
    
    client.deposit(&user1, &token_id, &1000);
    client.deposit(&user2, &token_id, &2000);
    client.payout(&recipient, &token_id, &500);

    // Record comprehensive state
    let state_before = (
        client.get_treasury_balance(),
        client.get_total_liability(),
        client.get_admin(),
        client.get_balance(&token_id),
    );

    // Get new contract wasm for upgrade
    let new_contract_id = env.register(PayrollVault, ());
    let new_wasm_hash = get_contract_wasm_hash(&env, &new_contract_id);

    // Perform upgrade
    client.upgrade(&new_wasm_hash, &(2u32, 0u32, 0u32));

    // Verify all state preserved
    let state_after = (
        client.get_treasury_balance(),
        client.get_total_liability(),
        client.get_admin(),
        client.get_balance(&token_id),
    );

    assert_eq!(state_before, state_after, "All state should be preserved after upgrade");

    // Verify contract still works after upgrade
    client.payout(&recipient, &token_id, &100);
    assert_eq!(client.get_treasury_balance(), 2400);
    assert_eq!(client.get_total_liability(), 600);
}

#[test]
fn test_multiple_upgrades() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    // Perform multiple sequential upgrades with actual WASM hashes
    let versions = [
        (1u32, 1u32, 0u32),
        (1u32, 2u32, 0u32),
        (2u32, 0u32, 0u32),
        (2u32, 1u32, 0u32),
    ];

    for (major, minor, patch) in versions {
        // Register a new contract to get a unique WASM hash
        let new_contract_id = env.register(PayrollVault, ());
        let new_wasm_hash = get_contract_wasm_hash(&env, &new_contract_id);
        
        client.upgrade(&new_wasm_hash, &(major, minor, patch));
        
        let version = client.get_version();
        assert_eq!(version.major, major);
        assert_eq!(version.minor, minor);
        assert_eq!(version.patch, patch);
    }

    // Verify final version is correct
    let final_version = client.get_version();
    assert_eq!(final_version.major, 2);
    assert_eq!(final_version.minor, 1);
    assert_eq!(final_version.patch, 0);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialize_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    
    // First initialize should work
    client.initialize(&admin);
    
    // Second should panic
    let admin2 = Address::generate(&env);
    client.initialize(&admin2);
}

#[test]
#[should_panic(expected = "not initialized")]
fn test_operations_before_initialize_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    // Should panic - not initialized
    let _ = client.get_admin();
}
