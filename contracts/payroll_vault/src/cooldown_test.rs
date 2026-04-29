#![cfg(test)]
extern crate std;

use super::*;
use quipay_common::QuipayError;
use soroban_sdk::{Address, Env, testutils::Address as _, token, testutils::Ledger};

#[test]
fn test_withdrawal_cooldown() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);

    client.initialize(&admin);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    let token_client = token::Client::new(&env, &token_id);

    // Initial funding
    token_admin_client.mint(&employer, &5000);
    client.deposit(&employer, &token_id, &5000);

    // Set cooldown to 1 hour (3600 seconds)
    client.set_withdrawal_cooldown(&admin, &3600);

    // First withdrawal passes
    env.ledger().set_timestamp(10000);
    client.withdraw(&employer, &token_id, &500);
    assert_eq!(token_client.balance(&employer), 500);

    // Second withdrawal within cooldown rejected
    env.ledger().set_timestamp(13599); // 3599 < 3600
    let res = client.try_withdraw(&employer, &token_id, &500);
    assert_eq!(res, Err(Ok(QuipayError::WithdrawalCooldownActive)));

    // Second withdrawal after cooldown passes
    env.ledger().set_timestamp(13600); // 3600 >= 3600
    client.withdraw(&employer, &token_id, &500);
    assert_eq!(token_client.balance(&employer), 1000);
}

#[test]
fn test_default_cooldown() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PayrollVault, ());
    let client = PayrollVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    client.initialize(&admin);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    token::StellarAssetClient::new(&env, &token_id).mint(&employer, &5000);
    client.deposit(&employer, &token_id, &5000);

    // Default cooldown is 1 day (86400 seconds)
    env.ledger().set_timestamp(0);
    client.withdraw(&employer, &token_id, &100);

    // Within 24 hours fails
    env.ledger().set_timestamp(86399);
    let res = client.try_withdraw(&employer, &token_id, &100);
    assert_eq!(res, Err(Ok(QuipayError::WithdrawalCooldownActive)));

    // After 24 hours passes
    env.ledger().set_timestamp(86400);
    client.withdraw(&employer, &token_id, &100);
}
