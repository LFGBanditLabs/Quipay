#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, token};

#[test]
fn test_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Initialize
    client.initialize(&admin);

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
    assert_eq!(client.get_balance(&token_id), 500); // Contract balance
    assert_eq!(client.get_treasury_balance(&token_id), 500); // Tracked balance

    // Allocate funds for payout
    client.allocate_funds(&token_id, &200);
    assert_eq!(client.get_total_liability(&token_id), 200);

    // Admin payouts 200 to recipient
    client.payout(&recipient, &token_id, &200);

    // Check balances
    assert_eq!(token_client.balance(&contract_id), 300);
    assert_eq!(token_client.balance(&recipient), 200);
    assert_eq!(client.get_balance(&token_id), 300);
    assert_eq!(client.get_treasury_balance(&token_id), 300);
    assert_eq!(client.get_total_liability(&token_id), 0);
}

#[test]
fn test_solvency_enforcement() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    
    client.initialize(&admin);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    let user = Address::generate(&env);

    // Deposit 1000
    token_admin_client.mint(&user, &1000);
    client.deposit(&user, &token_id, &1000);

    // Allocate 500 - OK
    client.allocate_funds(&token_id, &500);
    assert_eq!(client.get_total_liability(&token_id), 500);

    // Allocate another 500 - OK (Total 1000 <= Balance 1000)
    client.allocate_funds(&token_id, &500);
    assert_eq!(client.get_total_liability(&token_id), 1000);

    // Try to allocate 1 more - Should Fail
    let res = client.try_allocate_funds(&token_id, &1);
    assert!(res.is_err()); // panic: insufficient funds for allocation
}

#[test]
fn test_release_funds() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    
    client.initialize(&admin);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    let user = Address::generate(&env);

    // Deposit 1000
    token_admin_client.mint(&user, &1000);
    client.deposit(&user, &token_id, &1000);

    // Allocate 500
    client.allocate_funds(&token_id, &500);
    assert_eq!(client.get_total_liability(&token_id), 500);

    // Release 200 (e.g. cancelled stream)
    client.release_funds(&token_id, &200);
    assert_eq!(client.get_total_liability(&token_id), 300);

    // Try to release more than liability (400 > 300)
    let res = client.try_release_funds(&token_id, &400);
    assert!(res.is_err());
}

#[test]
fn test_multi_token_tracking() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    
    client.initialize(&admin);

    // Setup Token A
    let token_a_admin = Address::generate(&env);
    let token_a = env.register_stellar_asset_contract_v2(token_a_admin.clone());
    let token_a_id = token_a.address();
    let token_a_client = token::StellarAssetClient::new(&env, &token_a_id);

    // Setup Token B
    let token_b_admin = Address::generate(&env);
    let token_b = env.register_stellar_asset_contract_v2(token_b_admin.clone());
    let token_b_id = token_b.address();
    let token_b_client = token::StellarAssetClient::new(&env, &token_b_id);

    let user = Address::generate(&env);
    token_a_client.mint(&user, &1000);
    token_b_client.mint(&user, &1000);

    // Deposit both
    client.deposit(&user, &token_a_id, &500);
    client.deposit(&user, &token_b_id, &300);

    // Check independent tracking
    assert_eq!(client.get_treasury_balance(&token_a_id), 500);
    assert_eq!(client.get_treasury_balance(&token_b_id), 300);

    // Allocate A
    client.allocate_funds(&token_a_id, &400);
    assert_eq!(client.get_total_liability(&token_a_id), 400);
    assert_eq!(client.get_total_liability(&token_b_id), 0);

    // Try to allocate B beyond its balance (should fail even if A has room)
    // B balance 300, try allocate 301
    let res = client.try_allocate_funds(&token_b_id, &301);
    assert!(res.is_err());

    // Allocate B within limits
    client.allocate_funds(&token_b_id, &300);
    assert_eq!(client.get_total_liability(&token_b_id), 300);
}

#[test]
#[should_panic(expected = "payout exceeds liability")]
fn test_payout_without_allocation() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    let user = Address::generate(&env);
    let recipient = Address::generate(&env);

    token_admin_client.mint(&user, &1000);
    client.deposit(&user, &token_id, &1000);

    // Try payout without allocation
    client.payout(&recipient, &token_id, &100);
}

#[test]
fn test_complex_scenario_multiple_streams() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let recipient = Address::generate(&env);

    // 1. Initial funding
    token_admin_client.mint(&user_a, &1000);
    token_admin_client.mint(&user_b, &1000);
    client.deposit(&user_a, &token_id, &1000);
    client.deposit(&user_b, &token_id, &1000);

    // Total Treasury: 2000
    assert_eq!(client.get_treasury_balance(&token_id), 2000);

    // 2. Allocate for Stream 1 (800)
    client.allocate_funds(&token_id, &800);
    assert_eq!(client.get_total_liability(&token_id), 800);

    // 3. Allocate for Stream 2 (1000)
    client.allocate_funds(&token_id, &1000);
    assert_eq!(client.get_total_liability(&token_id), 1800);

    // 4. Try allocate for Stream 3 (500) -> Should fail (1800 + 500 = 2300 > 2000)
    let res = client.try_allocate_funds(&token_id, &500);
    assert!(res.is_err());

    // 5. Payout from Stream 1 (200)
    client.payout(&recipient, &token_id, &200);
    // Liability: 1800 - 200 = 1600
    // Treasury: 2000 - 200 = 1800
    assert_eq!(client.get_total_liability(&token_id), 1600);
    assert_eq!(client.get_treasury_balance(&token_id), 1800);

    // 6. Stream 1 Cancelled (Remaining was 600) -> Release 600
    client.release_funds(&token_id, &600);
    // Liability: 1600 - 600 = 1000 (Stream 2 only)
    assert_eq!(client.get_total_liability(&token_id), 1000);

    // 7. Now Stream 3 can allocate 500 (1000 + 500 = 1500 <= 1800)
    client.allocate_funds(&token_id, &500);
    assert_eq!(client.get_total_liability(&token_id), 1500);
}
