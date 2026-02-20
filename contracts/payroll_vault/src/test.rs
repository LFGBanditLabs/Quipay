#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

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
    assert_eq!(client.get_balance(&token_id), 500);

    // Admin payouts 200 to recipient
    client.payout(&recipient, &token_id, &200);

    // Check balances
    assert_eq!(token_client.balance(&contract_id), 300);
    assert_eq!(token_client.balance(&recipient), 200);
    assert_eq!(client.get_balance(&token_id), 300);
}

#[test]
fn test_liability_tracking() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let authorized_contract = Address::generate(&env);
    let token = Address::generate(&env);
    let another_token = Address::generate(&env);

    // Initialize
    client.initialize(&admin);

    // Set authorized contract
    client.set_authorized_contract(&authorized_contract);
    assert_eq!(client.get_authorized_contract(), Some(authorized_contract.clone()));

    // Add liability for first token
    client.add_liability(&token, &500);
    assert_eq!(client.get_liability(&token), 500);
    assert_eq!(client.get_total_liability(), 500);

    // Add more liability for same token
    client.add_liability(&token, &300);
    assert_eq!(client.get_liability(&token), 800);
    assert_eq!(client.get_total_liability(), 800);

    // Add liability for another token
    client.add_liability(&another_token, &200);
    assert_eq!(client.get_liability(&another_token), 200);
    assert_eq!(client.get_liability(&token), 800); // Unchanged
    assert_eq!(client.get_total_liability(), 1000);

    // Remove liability
    client.remove_liability(&token, &400);
    assert_eq!(client.get_liability(&token), 400);
    assert_eq!(client.get_total_liability(), 600);
}

#[test]
#[should_panic(expected = "authorized contract not set")]
fn test_add_liability_without_authorized_contract_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    // Initialize but don't set authorized contract
    client.initialize(&admin);

    // Should panic - no authorized contract set
    client.add_liability(&token, &500);
}

#[test]
#[should_panic(expected = "cannot remove more liability than exists")]
fn test_remove_more_liability_than_exists_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let authorized_contract = Address::generate(&env);
    let token = Address::generate(&env);

    // Initialize and set authorized contract
    client.initialize(&admin);
    client.set_authorized_contract(&authorized_contract);

    // Add some liability
    client.add_liability(&token, &500);
    assert_eq!(client.get_liability(&token), 500);

    // Should panic - trying to remove more than exists
    client.remove_liability(&token, &600);
}

#[test]
#[should_panic(expected = "liability amount must be positive")]
fn test_add_zero_liability_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let authorized_contract = Address::generate(&env);
    let token = Address::generate(&env);

    // Initialize and set authorized contract
    client.initialize(&admin);
    client.set_authorized_contract(&authorized_contract);

    // Should panic - zero amount
    client.add_liability(&token, &0);
}

#[test]
#[should_panic(expected = "removal amount must be positive")]
fn test_remove_zero_liability_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let authorized_contract = Address::generate(&env);
    let token = Address::generate(&env);

    // Initialize and set authorized contract
    client.initialize(&admin);
    client.set_authorized_contract(&authorized_contract);

    // Add some liability first
    client.add_liability(&token, &500);

    // Should panic - zero amount
    client.remove_liability(&token, &0);
}

#[test]
fn test_get_liability_returns_zero_for_untracked_token() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    // Initialize
    client.initialize(&admin);

    // Query liability for untracked token should return 0
    assert_eq!(client.get_liability(&token), 0);
}
