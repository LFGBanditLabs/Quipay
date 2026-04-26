#![cfg(test)]
#![allow(deprecated)]
extern crate std;

use super::*;
use crate::test::setup;
use quipay_common::QuipayError;
use soroban_sdk::{
    contract, contractimpl, contracttype, testutils::Address as _, testutils::Ledger as _, Address,
    Env, Vec,
};

#[contracttype]
#[derive(Clone)]
enum CountingVaultKey {
    PayoutCalls,
}

#[contract]
pub struct CountingVault;

#[contractimpl]
impl CountingVault {
    pub fn is_token_allowed(_env: Env, _token: Address) -> bool {
        true
    }

    pub fn check_solvency(_env: Env, _token: Address, _additional_liability: i128) -> bool {
        true
    }

    pub fn add_liability(_env: Env, _token: Address, _amount: i128) {}

    pub fn remove_liability(_env: Env, _token: Address, _amount: i128) {}

    pub fn payout_liability(env: Env, _to: Address, _token: Address, _amount: i128) {
        let count: u32 = env
            .storage()
            .instance()
            .get(&CountingVaultKey::PayoutCalls)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&CountingVaultKey::PayoutCalls, &(count + 1));
    }

    pub fn get_payout_calls(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&CountingVaultKey::PayoutCalls)
            .unwrap_or(0)
    }
}

fn make_stream(
    client: &PayrollStreamClient,
    employer: &Address,
    worker: &Address,
    token: &Address,
    rate: i128,
    start: u64,
    end: u64,
) -> u64 {
    client.create_stream(
        employer, worker, token, &rate, &start, &start, &end, &None, &None,
    )
}

fn sum_claims(results: &Vec<(u64, i128)>) -> i128 {
    let mut total = 0i128;
    let mut idx = 0u32;
    while idx < results.len() {
        let (_, amount) = results.get(idx).unwrap();
        total += amount;
        idx += 1;
    }
    total
}

fn setup_with_counting_vault(
    env: &Env,
) -> (
    PayrollStreamClient,
    CountingVaultClient,
    Address,
    Address,
    Address,
    Address,
) {
    let admin = Address::generate(env);
    let employer = Address::generate(env);
    let worker = Address::generate(env);
    let token = Address::generate(env);
    let vault_id = env.register(CountingVault, ());
    let contract_id = env.register(PayrollStream, ());

    let client = PayrollStreamClient::new(env, &contract_id);
    let vault_client = CountingVaultClient::new(env, &vault_id);

    client.init(&admin);
    client.set_vault(&vault_id);
    client.set_withdrawal_cooldown(&0u64);
    client.set_min_stream_duration(&0u64);
    client.set_min_cancel_notice(&0u32);

    (client, vault_client, employer, worker, token, admin)
}

#[test]
fn test_batch_claim_single_stream() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = make_stream(&client, &employer, &worker, &token, 10, 0, 100);

    env.ledger().with_mut(|li| li.timestamp = 50);
    let result = client.batch_claim(&soroban_sdk::vec![&env, stream_id]);

    assert_eq!(result.len(), 1);
    assert_eq!(result.get(0).unwrap(), (stream_id, 500));
}

#[test]
fn test_batch_claim_multiple_streams_same_token() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let s1 = make_stream(&client, &employer, &worker, &token, 10, 0, 100);
    let s2 = make_stream(&client, &employer, &worker, &token, 20, 0, 100);
    let s3 = make_stream(&client, &employer, &worker, &token, 5, 0, 100);

    env.ledger().with_mut(|li| li.timestamp = 100);
    let result = client.batch_claim(&soroban_sdk::vec![&env, s1, s2, s3]);

    assert_eq!(result.len(), 3);
    assert_eq!(sum_claims(&result), 3500);
    assert_eq!(result.get(0).unwrap(), (s1, 1000));
    assert_eq!(result.get(1).unwrap(), (s2, 2000));
    assert_eq!(result.get(2).unwrap(), (s3, 500));
}

#[test]
fn test_batch_claim_aggregates_same_token_payouts_into_one_vault_call() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, vault_client, employer, worker, token, _admin) = setup_with_counting_vault(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let s1 = make_stream(&client, &employer, &worker, &token, 10, 0, 100);
    let s2 = make_stream(&client, &employer, &worker, &token, 20, 0, 100);
    let s3 = make_stream(&client, &employer, &worker, &token, 5, 0, 100);

    env.ledger().with_mut(|li| li.timestamp = 50);
    let result = client.batch_claim(&soroban_sdk::vec![&env, s1, s2, s3]);

    assert_eq!(sum_claims(&result), 1750);
    assert_eq!(vault_client.get_payout_calls(), 1);
}

#[test]
fn test_batch_claim_returns_zero_for_zero_balance_duplicate_and_foreign_streams() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);
    let other_worker = Address::generate(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let claimable = make_stream(&client, &employer, &worker, &token, 10, 0, 100);
    let not_started = client.create_stream(
        &employer, &worker, &token, &10, &200u64, &0u64, &300u64, &None, &None,
    );
    let foreign = make_stream(&client, &employer, &other_worker, &token, 15, 0, 100);

    env.ledger().with_mut(|li| li.timestamp = 50);
    let result = client.batch_claim(&soroban_sdk::vec![
        &env,
        claimable,
        not_started,
        claimable,
        foreign,
        999u64,
    ]);

    assert_eq!(result.len(), 5);
    assert_eq!(result.get(0).unwrap(), (claimable, 500));
    assert_eq!(result.get(1).unwrap(), (not_started, 0));
    assert_eq!(result.get(2).unwrap(), (claimable, 0));
    assert_eq!(result.get(3).unwrap(), (foreign, 0));
    assert_eq!(result.get(4).unwrap(), (999, 0));
}

#[test]
fn test_batch_claim_partially_succeeds_when_one_stream_was_cancelled() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    client.set_cancellation_grace_period(&0u64);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let cancelled = make_stream(&client, &employer, &worker, &token, 10, 0, 100);
    let active = make_stream(&client, &employer, &worker, &token, 20, 0, 100);

    env.ledger().with_mut(|li| li.timestamp = 25);
    client.cancel_stream(&cancelled, &employer, &None);

    env.ledger().with_mut(|li| li.timestamp = 50);
    let result = client.batch_claim(&soroban_sdk::vec![&env, cancelled, active]);

    assert_eq!(result.len(), 2);
    assert_eq!(result.get(0).unwrap(), (cancelled, 0));
    assert_eq!(result.get(1).unwrap(), (active, 1000));
}

#[test]
fn test_batch_claim_marks_fully_vested_stream_completed() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = make_stream(&client, &employer, &worker, &token, 10, 0, 10);

    env.ledger().with_mut(|li| li.timestamp = 10);
    let result = client.batch_claim(&soroban_sdk::vec![&env, stream_id]);

    assert_eq!(result.get(0).unwrap(), (stream_id, 100));
    assert_eq!(
        client.get_stream(&stream_id).unwrap().status,
        StreamStatus::Completed
    );
}

#[test]
fn test_batch_claim_accumulates_incrementally() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = make_stream(&client, &employer, &worker, &token, 10, 0, 100);

    env.ledger().with_mut(|li| li.timestamp = 40);
    let first = client.batch_claim(&soroban_sdk::vec![&env, stream_id]);
    assert_eq!(first.get(0).unwrap(), (stream_id, 400));

    env.ledger().with_mut(|li| li.timestamp = 70);
    let second = client.batch_claim(&soroban_sdk::vec![&env, stream_id]);
    assert_eq!(second.get(0).unwrap(), (stream_id, 300));

    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.withdrawn_amount, 700);
}

#[test]
fn test_batch_claim_respects_withdrawal_cooldown() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    client.set_withdrawal_cooldown(&100u64);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = make_stream(&client, &employer, &worker, &token, 10, 0, 1000);

    env.ledger().with_mut(|li| li.timestamp = 200);
    client.batch_claim(&soroban_sdk::vec![&env, stream_id]);

    env.ledger().with_mut(|li| li.timestamp = 250);
    let result = client.try_batch_claim(&soroban_sdk::vec![&env, stream_id]);
    assert_eq!(result, Err(Ok(QuipayError::WithdrawalCooldown)));

    env.ledger().with_mut(|li| li.timestamp = 301);
    let result = client.batch_claim(&soroban_sdk::vec![&env, stream_id]);
    assert!(result.get(0).unwrap().1 > 0);
}

#[test]
fn test_batch_claim_rejects_oversized_batches() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = make_stream(&client, &employer, &worker, &token, 10, 0, 100);

    let mut oversized = soroban_sdk::Vec::new(&env);
    let mut i = 0u32;
    while i < 51 {
        oversized.push_back(stream_id + i as u64);
        i += 1;
    }

    let result = client.try_batch_claim(&oversized);
    assert_eq!(result, Err(Ok(QuipayError::BatchTooLarge)));
}
