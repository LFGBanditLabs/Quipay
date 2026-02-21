#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};
use quipay_common::QuipayError;

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

    // Admin adds liability and payouts 200 to recipient
    client.add_liability(&200);
    client.payout(&recipient, &token_id, &200);

    // Check balances
    assert_eq!(token_client.balance(&contract_id), 300);
    assert_eq!(token_client.balance(&recipient), 200);
    assert_eq!(client.get_balance(&token_id), 300);
}

#[test]
fn test_already_initialized() {
    let env = Env::default();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);
    let result = client.try_initialize(&admin);
    
    assert_eq!(
        result,
        Err(Ok(QuipayError::AlreadyInitialized))
    );
}

#[test]
fn test_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();

    client.initialize(&admin);
    
    let result = client.try_payout(&recipient, &token_id, &100);
    assert_eq!(
        result,
        Err(Ok(QuipayError::InsufficientBalance))
    );
}
