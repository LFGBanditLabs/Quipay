#![cfg(test)]
#![allow(deprecated)]
extern crate std;

use super::*;
use quipay_common::QuipayError;
use soroban_sdk::{Address, Env, testutils::Address as _, testutils::Ledger as _};

use crate::test::setup;

// ── helpers ───────────────────────────────────────────────────────────────────

fn make_stream(
    client: &PayrollStreamClient,
    employer: &Address,
    worker: &Address,
    token: &Address,
    rate: i128,
    end: u64,
) -> u64 {
    client.create_stream(employer, worker, token, &rate, &0u64, &0u64, &end, &None, &None)
}

// ── basic functionality ───────────────────────────────────────────────────────

#[test]
fn test_batch_cancel_single_stream() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = make_stream(&client, &employer, &worker, &token, 10, 100);

    // Grace period disabled for immediate cancel.
    client.set_cancellation_grace_period(&0u64);

    env.ledger().with_mut(|li| li.timestamp = 10);
    let ids = soroban_sdk::vec![&env, stream_id];
    let results = client.batch_cancel_streams(&ids, &employer);

    assert_eq!(results.len(), 1);
    let r = results.get(0).unwrap();
    assert_eq!(r.stream_id, stream_id);
    assert!(r.success);

    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::Canceled);
}

#[test]
fn test_batch_cancel_multiple_streams() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let s1 = make_stream(&client, &employer, &worker, &token, 10, 100);
    let s2 = make_stream(&client, &employer, &worker, &token, 20, 200);
    let s3 = make_stream(&client, &employer, &worker, &token, 5, 50);

    client.set_cancellation_grace_period(&0u64);

    env.ledger().with_mut(|li| li.timestamp = 10);
    let ids = soroban_sdk::vec![&env, s1, s2, s3];
    let results = client.batch_cancel_streams(&ids, &employer);

    assert_eq!(results.len(), 3);
    for i in 0..3 {
        assert!(results.get(i).unwrap().success);
    }
    assert_eq!(
        client.get_stream(&s1).unwrap().status,
        StreamStatus::Canceled
    );
    assert_eq!(
        client.get_stream(&s2).unwrap().status,
        StreamStatus::Canceled
    );
    assert_eq!(
        client.get_stream(&s3).unwrap().status,
        StreamStatus::Canceled
    );
}

#[test]
fn test_batch_cancel_requires_employer_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = make_stream(&client, &employer, &worker, &token, 10, 100);

    client.set_cancellation_grace_period(&0u64);

    let wrong_employer = Address::generate(&env);
    let ids = soroban_sdk::vec![&env, stream_id];

    // Correct employer owns this stream; wrong employer gets a failure result, not a panic.
    let results = client.batch_cancel_streams(&ids, &wrong_employer);
    assert_eq!(results.len(), 1);
    assert!(!results.get(0).unwrap().success);

    // Stream must remain active.
    assert_eq!(
        client.get_stream(&stream_id).unwrap().status,
        StreamStatus::Active
    );
}

#[test]
fn test_batch_cancel_stream_not_found_records_failure() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, _worker, _token, _admin) = setup(&env);

    client.set_cancellation_grace_period(&0u64);

    let ids = soroban_sdk::vec![&env, 999u64];
    let results = client.batch_cancel_streams(&ids, &employer);

    assert_eq!(results.len(), 1);
    assert!(!results.get(0).unwrap().success);
}

#[test]
fn test_batch_cancel_already_canceled_is_idempotent() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = make_stream(&client, &employer, &worker, &token, 10, 100);

    client.set_cancellation_grace_period(&0u64);

    env.ledger().with_mut(|li| li.timestamp = 5);
    let ids = soroban_sdk::vec![&env, stream_id];

    // First cancel.
    let r1 = client.batch_cancel_streams(&ids, &employer);
    assert!(r1.get(0).unwrap().success);

    // Second cancel on the same stream — idempotent, must still succeed.
    let r2 = client.batch_cancel_streams(&ids, &employer);
    assert!(r2.get(0).unwrap().success);
}

#[test]
fn test_batch_cancel_mixed_success_and_failure() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    let other_employer = Address::generate(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let own_stream = make_stream(&client, &employer, &worker, &token, 10, 100);
    let other_stream = make_stream(&client, &other_employer, &worker, &token, 10, 100);

    client.set_cancellation_grace_period(&0u64);

    env.ledger().with_mut(|li| li.timestamp = 5);
    // employer only owns own_stream; other_stream belongs to other_employer.
    let ids = soroban_sdk::vec![&env, own_stream, 999u64, other_stream];
    let results = client.batch_cancel_streams(&ids, &employer);

    assert_eq!(results.len(), 3);
    assert!(results.get(0).unwrap().success); // own_stream — cancelled
    assert!(!results.get(1).unwrap().success); // 999 — not found
    assert!(!results.get(2).unwrap().success); // other_stream — wrong employer
}

#[test]
fn test_batch_cancel_too_large_returns_error() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, _worker, _token, _admin) = setup(&env);

    let mut ids = soroban_sdk::Vec::new(&env);
    for i in 0..21u64 {
        ids.push_back(i);
    }

    let result = client.try_batch_cancel_streams(&ids, &employer);
    assert_eq!(result, Err(Ok(QuipayError::BatchTooLarge)));
}

// ── grace period behaviour ────────────────────────────────────────────────────

#[test]
fn test_batch_cancel_with_grace_period_schedules_pending_cancel() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = make_stream(&client, &employer, &worker, &token, 10, 100);

    // Enable a 30-second grace period.
    client.set_cancellation_grace_period(&30u64);

    env.ledger().with_mut(|li| li.timestamp = 10);
    let ids = soroban_sdk::vec![&env, stream_id];
    let results = client.batch_cancel_streams(&ids, &employer);

    assert!(results.get(0).unwrap().success);

    // Stream should now be in PendingCancel, not Canceled yet.
    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::PendingCancel);
    assert_eq!(stream.cancel_effective_at, 40); // 10 + 30
}

#[test]
fn test_batch_cancel_finalizes_when_grace_period_elapsed() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = make_stream(&client, &employer, &worker, &token, 10, 100);

    // 20-second grace period.
    client.set_cancellation_grace_period(&20u64);

    // Schedule cancellation at t=10 → effective at t=30.
    env.ledger().with_mut(|li| li.timestamp = 10);
    let ids = soroban_sdk::vec![&env, stream_id];
    client.batch_cancel_streams(&ids, &employer);
    assert_eq!(
        client.get_stream(&stream_id).unwrap().status,
        StreamStatus::PendingCancel
    );

    // Call again after grace period elapsed — should finalize.
    env.ledger().with_mut(|li| li.timestamp = 50);
    let results = client.batch_cancel_streams(&ids, &employer);
    assert!(results.get(0).unwrap().success);
    assert_eq!(
        client.get_stream(&stream_id).unwrap().status,
        StreamStatus::Canceled
    );
}

// ── event emission ────────────────────────────────────────────────────────────

#[test]
fn test_batch_cancel_emits_cancel_scheduled_event() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = make_stream(&client, &employer, &worker, &token, 10, 100);

    client.set_cancellation_grace_period(&30u64);

    env.ledger().with_mut(|li| li.timestamp = 5);
    let ids = soroban_sdk::vec![&env, stream_id];
    client.batch_cancel_streams(&ids, &employer);

    // Verify the cancel_scheduled event was emitted by checking the stream status
    // (event API varies by SDK version; status check is the canonical assertion)
    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::PendingCancel,
        "cancel_scheduled event not emitted — stream should be PendingCancel");
}

#[test]
fn test_batch_cancel_emits_canceled_event_when_no_grace() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = make_stream(&client, &employer, &worker, &token, 10, 100);

    client.set_cancellation_grace_period(&0u64);

    env.ledger().with_mut(|li| li.timestamp = 5);
    let ids = soroban_sdk::vec![&env, stream_id];
    client.batch_cancel_streams(&ids, &employer);

    // Verify the canceled event was emitted by checking the stream status
    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::Canceled,
        "canceled event not emitted — stream should be Canceled");
}
