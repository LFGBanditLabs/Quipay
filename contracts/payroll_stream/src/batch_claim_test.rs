#![cfg(test)]
#![allow(deprecated)]
extern crate std;

use super::*;
use quipay_common::QuipayError;
use soroban_sdk::{Address, Env, testutils::Address as _, testutils::Ledger as _};

use crate::test::setup;

// ── helpers ──────────────────────────────────────────────────────────────────

/// Create a stream for `worker` starting and ending at explicit timestamps.
fn make_stream(
    client: &PayrollStreamClient,
    employer: &Address,
    worker: &Address,
    token: &Address,
    rate: i128,
    start: u64,
    end: u64,
) -> u64 {
    client.create_stream(employer, worker, token, &rate, &start, &start, &end, &None)
}

// ── basic functionality ───────────────────────────────────────────────────────

#[test]
fn test_batch_claim_single_stream() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    make_stream(&client, &employer, &worker, &token, 10, 0, 100);

    env.ledger().with_mut(|li| li.timestamp = 50);
    let result = client.batch_claim(&worker);

    assert_eq!(result.total_claimed, 500); // 10 * 50
    assert_eq!(result.streams.len(), 1);
    let s = result.streams.get(0).unwrap();
    assert_eq!(s.amount, 500);
    assert_eq!(s.token, token);
}

#[test]
fn test_batch_claim_multiple_streams_same_token() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    make_stream(&client, &employer, &worker, &token, 10, 0, 100); // vests 1000 total
    make_stream(&client, &employer, &worker, &token, 20, 0, 100); // vests 2000 total
    make_stream(&client, &employer, &worker, &token, 5, 0, 100); // vests 500 total

    env.ledger().with_mut(|li| li.timestamp = 100);
    let result = client.batch_claim(&worker);

    // All three fully vested
    assert_eq!(result.total_claimed, 3500);
    assert_eq!(result.streams.len(), 3);
}

#[test]
fn test_batch_claim_multiple_streams_different_tokens() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token_a, _admin) = setup(&env);
    let token_b = Address::generate(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    make_stream(&client, &employer, &worker, &token_a, 10, 0, 100);
    make_stream(&client, &employer, &worker, &token_b, 20, 0, 100);

    env.ledger().with_mut(|li| li.timestamp = 50);
    let result = client.batch_claim(&worker);

    assert_eq!(result.total_claimed, 1500); // 500 + 1000
    assert_eq!(result.streams.len(), 2);

    // Verify both tokens appear in the breakdown.
    let mut saw_a = false;
    let mut saw_b = false;
    let mut i = 0u32;
    while i < result.streams.len() {
        let s = result.streams.get(i).unwrap();
        if s.token == token_a {
            assert_eq!(s.amount, 500);
            saw_a = true;
        }
        if s.token == token_b {
            assert_eq!(s.amount, 1000);
            saw_b = true;
        }
        i += 1;
    }
    assert!(saw_a && saw_b);
}

// ── zero-balance streams are skipped ─────────────────────────────────────────

#[test]
fn test_batch_claim_skips_zero_balance_streams() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    // Stream with cliff in the future — nothing vested yet.
    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id_cliff = client.create_stream(
        &employer, &worker, &token, &10, &200u64, &0u64, &300u64, &None,
    );
    // Normal stream.
    make_stream(&client, &employer, &worker, &token, 10, 0, 100);

    env.ledger().with_mut(|li| li.timestamp = 50);
    let result = client.batch_claim(&worker);

    // Only the second stream should have been claimed.
    assert_eq!(result.streams.len(), 1);
    assert_eq!(result.total_claimed, 500);

    // Cliffed stream is still active.
    let cliffed = client.get_stream(&stream_id_cliff).unwrap();
    assert_eq!(cliffed.status, StreamStatus::Active);
    assert_eq!(cliffed.withdrawn_amount, 0);
}

// ── closed streams are skipped ────────────────────────────────────────────────

#[test]
fn test_batch_claim_skips_completed_streams() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let s1 = make_stream(&client, &employer, &worker, &token, 10, 0, 10);
    make_stream(&client, &employer, &worker, &token, 10, 0, 100);

    // Complete s1.
    env.ledger().with_mut(|li| li.timestamp = 10);
    client.withdraw(&s1, &worker);

    env.ledger().with_mut(|li| li.timestamp = 50);
    let result = client.batch_claim(&worker);

    // Only the second stream contributes.
    assert_eq!(result.streams.len(), 1);
    assert_eq!(result.total_claimed, 500);
}

// #[test]
// fn test_batch_claim_skips_canceled_streams() {
//     let env = Env::default();
//     env.mock_all_auths();
//     let (client, employer, worker, token, _admin) = setup(&env);

//     env.ledger().with_mut(|li| li.timestamp = 0);
//     let s1 = make_stream(&client, &employer, &worker, &token, 10, 0, 100);
//     make_stream(&client, &employer, &worker, &token, 20, 0, 100);

//     client.cancel_stream(&s1, &employer, &None);

//     env.ledger().with_mut(|li| li.timestamp = 50);
//     let result = client.batch_claim(&worker);

//     assert_eq!(result.streams.len(), 1);
//     assert_eq!(result.total_claimed, 1000); // 20 * 50
// }

// ── empty result when nothing to claim ────────────────────────────────────────

#[test]
fn test_batch_claim_returns_empty_when_nothing_to_claim() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    // Stream hasn't started vesting yet (cliff far in future).
    env.ledger().with_mut(|li| li.timestamp = 0);
    client.create_stream(
        &employer, &worker, &token, &10, &1000u64, &0u64, &2000u64, &None,
    );

    env.ledger().with_mut(|li| li.timestamp = 5);
    let result = client.batch_claim(&worker);

    assert_eq!(result.total_claimed, 0);
    assert_eq!(result.streams.len(), 0);
}

#[test]
fn test_batch_claim_no_streams_returns_empty() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _employer, worker, _token, _admin) = setup(&env);

    let result = client.batch_claim(&worker);
    assert_eq!(result.total_claimed, 0);
    assert_eq!(result.streams.len(), 0);
}

// ── stream state is correctly updated ────────────────────────────────────────

#[test]
fn test_batch_claim_updates_withdrawn_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = make_stream(&client, &employer, &worker, &token, 10, 0, 100);

    env.ledger().with_mut(|li| li.timestamp = 30);
    client.batch_claim(&worker);

    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.withdrawn_amount, 300);
    assert_eq!(stream.last_withdrawal_ts, 30);
}

#[test]
fn test_batch_claim_auto_completes_fully_vested_stream() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = make_stream(&client, &employer, &worker, &token, 10, 0, 10);

    env.ledger().with_mut(|li| li.timestamp = 10);
    let result = client.batch_claim(&worker);

    assert_eq!(result.total_claimed, 100);
    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::Completed);
}

// ── idempotent: claiming twice yields correct incremental amounts ─────────────

#[test]
fn test_batch_claim_twice_accumulates_incrementally() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = make_stream(&client, &employer, &worker, &token, 10, 0, 100);

    env.ledger().with_mut(|li| li.timestamp = 40);
    let r1 = client.batch_claim(&worker);
    assert_eq!(r1.total_claimed, 400);

    env.ledger().with_mut(|li| li.timestamp = 70);
    let r2 = client.batch_claim(&worker);
    assert_eq!(r2.total_claimed, 300); // 700 - 400

    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.withdrawn_amount, 700);
}

// ── cooldown enforcement ──────────────────────────────────────────────────────

#[test]
fn test_batch_claim_respects_withdrawal_cooldown() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, admin) = setup(&env);

    // Re-enable a 100-second cooldown.
    client.set_withdrawal_cooldown(&100u64);

    env.ledger().with_mut(|li| li.timestamp = 0);
    make_stream(&client, &employer, &worker, &token, 10, 0, 1000);

    env.ledger().with_mut(|li| li.timestamp = 200);
    client.batch_claim(&worker); // first claim — OK

    env.ledger().with_mut(|li| li.timestamp = 250); // only 50 s later
    let result = client.try_batch_claim(&worker);
    assert_eq!(result, Err(Ok(QuipayError::WithdrawalCooldown)));

    env.ledger().with_mut(|li| li.timestamp = 301); // past cooldown
    let result2 = client.batch_claim(&worker);
    assert!(result2.total_claimed > 0);
}

// ── only the caller's streams are processed ───────────────────────────────────

#[test]
fn test_batch_claim_only_processes_callers_own_streams() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker1, token, _admin) = setup(&env);
    let worker2 = Address::generate(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    make_stream(&client, &employer, &worker1, &token, 10, 0, 100);
    make_stream(&client, &employer, &worker2, &token, 20, 0, 100);

    env.ledger().with_mut(|li| li.timestamp = 50);

    // worker1 claims — should only get their own stream.
    let r1 = client.batch_claim(&worker1);
    assert_eq!(r1.total_claimed, 500); // 10 * 50

    // worker2 claims — should only get their own stream.
    let r2 = client.batch_claim(&worker2);
    assert_eq!(r2.total_claimed, 1000); // 20 * 50
}

// ── grace-period interaction ──────────────────────────────────────────────────

#[test]
fn test_batch_claim_respects_cancel_effective_at_vesting_cap() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    // Re-enable grace period (20 s) just for this test.
    client.set_cancellation_grace_period(&20u64);

    env.ledger().with_mut(|li| li.timestamp = 0);
    // rate 10, end 100 → total 1000
    make_stream(&client, &employer, &worker, &token, 10, 0, 100);

    // At t=10, employer schedules cancellation → cancel_effective_at = 30.
    env.ledger().with_mut(|li| li.timestamp = 10);
    client.cancel_stream(
        &client
            .get_streams_by_worker(&worker, &None, &None)
            .get(0)
            .unwrap(),
        &employer,
        &None,
    );

    // At t=60, worker batch_claims — vesting must be capped at t=30.
    env.ledger().with_mut(|li| li.timestamp = 60);
    let result = client.batch_claim(&worker);

    // Elapsed to cap = 30 s → 30 * 10 = 300.
    assert_eq!(result.total_claimed, 300);
}
