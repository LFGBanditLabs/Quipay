//! Integration tests: PayrollStream and PayrollVault cross-contract communication.
//! - Stream creation blocked if treasury insolvent
//! - Liabilities updated correctly on create / withdraw / cancel
//! - Token transfers on withdrawal

#![cfg(test)]
use super::*;
use payroll_vault::{PayrollVault, PayrollVaultClient};
use soroban_sdk::{
    Address, Env,
    testutils::{Address as _, Ledger as _},
    token,
};

fn setup_integration(
    env: &Env,
) -> (
    PayrollStreamClient,
    PayrollVaultClient,
    Address,
    Address,
    Address,
    Address,
    Address,
) {
    let admin = Address::generate(env);
    let employer = Address::generate(env);
    let worker = Address::generate(env);
    let depositor = Address::generate(env);

    let token_admin = Address::generate(env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_client = token::StellarAssetClient::new(env, &token_id);

    let vault_id = env.register_contract(None, PayrollVault);
    let stream_id = env.register_contract(None, PayrollStream);

    let vault_client = PayrollVaultClient::new(env, &vault_id);
    let stream_client = PayrollStreamClient::new(env, &stream_id);

    vault_client.initialize(&admin);
    stream_client.init(&admin);

    vault_client.set_authorized_contract(&stream_id);
    stream_client.set_vault(&vault_id);

    token_client.mint(&depositor, &10_000);
    vault_client.deposit(&depositor, &token_id, &10_000);

    (
        stream_client,
        vault_client,
        admin,
        employer,
        worker,
        token_id,
        depositor,
    )
}

#[test]
fn test_integration_stream_creation_blocked_if_insolvent() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let (stream_client, _vault_client, _admin, employer, worker, token_id, _depositor) =
        setup_integration(&env);

    // Deposited 10_000. Try to create stream with total_amount 15_000 (rate 150, duration 100)
    env.ledger().with_mut(|li| li.timestamp = 0);
    let result =
        stream_client.try_create_stream(&employer, &worker, &token_id, &150, &0u64, &0u64, &100u64);
    assert!(result.is_err());
}

#[test]
fn test_integration_liabilities_updated_on_create_and_withdraw() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let (stream_client, vault_client, _admin, employer, worker, token_id, _depositor) =
        setup_integration(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id =
        stream_client.create_stream(&employer, &worker, &token_id, &100, &0u64, &0u64, &100u64);
    // total_amount = 100 * 100 = 10_000
    assert_eq!(vault_client.get_total_liability(&token_id), 10_000);

    env.ledger().with_mut(|li| li.timestamp = 50);
    let amount = stream_client.withdraw(&stream_id, &worker);
    assert_eq!(amount, 5_000);
    assert_eq!(vault_client.get_total_liability(&token_id), 5_000);

    let token_client = token::Client::new(&env, &token_id);
    assert_eq!(token_client.balance(&worker), 5_000);
}

#[test]
fn test_integration_token_transfer_on_withdrawal() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let (stream_client, vault_client, _admin, employer, worker, token_id, _depositor) =
        setup_integration(&env);
    let token_client = token::Client::new(&env, &token_id);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id =
        stream_client.create_stream(&employer, &worker, &token_id, &10, &0u64, &0u64, &10u64);
    let balance_before = token_client.balance(&worker);

    env.ledger().with_mut(|li| li.timestamp = 10);
    let withdrawn = stream_client.withdraw(&stream_id, &worker);
    assert_eq!(withdrawn, 100);
    assert_eq!(token_client.balance(&worker), balance_before + 100);
}

#[test]
fn test_integration_remove_liability_on_cancel() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let (stream_client, vault_client, _admin, employer, worker, token_id, _depositor) =
        setup_integration(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id =
        stream_client.create_stream(&employer, &worker, &token_id, &100, &0u64, &0u64, &100u64);
    assert_eq!(vault_client.get_total_liability(&token_id), 10_000);

    env.ledger().with_mut(|li| li.timestamp = 25);
    stream_client.withdraw(&stream_id, &worker);
    assert_eq!(vault_client.get_total_liability(&token_id), 7_500);

    stream_client.cancel_stream(&stream_id, &employer, &None);
    assert_eq!(vault_client.get_total_liability(&token_id), 0);
}

#[test]
fn test_integration_full_withdraw_completes_and_liability_zero() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let (stream_client, vault_client, _admin, employer, worker, token_id, _depositor) =
        setup_integration(&env);
    let token_client = token::Client::new(&env, &token_id);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id =
        stream_client.create_stream(&employer, &worker, &token_id, &50, &0u64, &0u64, &100u64);
    assert_eq!(vault_client.get_total_liability(&token_id), 5_000);

    env.ledger().with_mut(|li| li.timestamp = 100);
    let amount = stream_client.withdraw(&stream_id, &worker);
    assert_eq!(amount, 5_000);
    assert_eq!(vault_client.get_total_liability(&token_id), 0);

    let stream = stream_client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::Completed);
    assert_eq!(token_client.balance(&worker), 5_000);
}
