#![cfg(test)]
#![allow(deprecated)]
extern crate std;

use super::*;
use quipay_common::QuipayError;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, Env,
};

use crate::test::setup;

// ── helpers ──────────────────────────────────────────────────────────────────

/// Returns a stream created at the provided `start_ts` with a 100-ledger
/// window (end_ts = start_ts + 100s, rate = 10 tokens/s).
fn create_stream_at(
    client: &PayrollStreamClient,
    employer: &Address,
    worker: &Address,
    token: &Address,
    start_ts: u64,
) -> u64 {
    client.create_stream(
        employer,
        worker,
        token,
        &10i128,
        &start_ts,
        &start_ts,
        &(start_ts + 100),
        &None,
        &None,
    )
}

// ── #945 — cancel BEFORE minimum notice period is rejected ────────────────────

#[test]
fn test_cancel_before_notice_period_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    // Arrange: set a notice period of 100 ledgers
    client.set_min_cancel_notice(&100u32);

    // Place the stream creation at ledger 0 (start_ledger = 0).
    // At this point the ledger sequence is at its default (0).
    let start_ts = env.ledger().timestamp();
    let stream_id = create_stream_at(&client, &employer, &worker, &token, start_ts);

    // Act: attempt to cancel at ledger 50 — still inside the notice window.
    // earliest_cancel_ledger = start_ledger(0) + notice(100) = 100
    env.ledger().with_mut(|l| l.sequence_number = 50);
    let result = client.try_cancel_stream(&stream_id, &employer, &None::<Address>);

    // Assert
    assert_eq!(result, Err(Ok(QuipayError::CancellationTooEarly)));
}

// ── #945 — cancel AFTER minimum notice period is accepted ─────────────────────

#[test]
fn test_cancel_after_notice_period_is_accepted() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    // Arrange: set a notice period of 100 ledgers; disable grace period for
    // clean status assertion.
    client.set_min_cancel_notice(&100u32);
    client.set_cancellation_grace_period(&0u64);

    let start_ts = env.ledger().timestamp();
    let stream_id = create_stream_at(&client, &employer, &worker, &token, start_ts);

    // Act: advance to exactly the earliest allowed ledger (start_ledger + 100).
    env.ledger().with_mut(|l| l.sequence_number = 100);
    client.cancel_stream(&stream_id, &employer, &None::<Address>);

    // Assert: stream should be Canceled immediately (grace period is 0).
    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::Canceled);
}

// ── #945 — notice period = 0 always allows cancellation ──────────────────────

#[test]
fn test_notice_period_zero_always_allows_cancel() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    // Arrange: admin sets notice to 0 (emergency cancellation).
    client.set_min_cancel_notice(&0u32);
    client.set_cancellation_grace_period(&0u64);

    // Stream created at ledger 0; cancel attempted at ledger 0.
    let start_ts = env.ledger().timestamp();
    let stream_id = create_stream_at(&client, &employer, &worker, &token, start_ts);

    // Act: cancel immediately at the very first ledger.
    client.cancel_stream(&stream_id, &employer, &None::<Address>);

    // Assert: stream is immediately cancelled.
    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::Canceled);
}

// ── #945 — get/set min_cancel_notice round-trip ───────────────────────────────

#[test]
fn test_get_set_min_cancel_notice_round_trip() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _employer, _worker, _token, _admin) = setup(&env);

    // Default is 0 in test setup (overriding the contract default of 17280)
    assert_eq!(client.get_min_cancel_notice(), 0u32);

    client.set_min_cancel_notice(&500u32);
    assert_eq!(client.get_min_cancel_notice(), 500u32);

    // Setting to 0 should be allowed (emergency bypass)
    client.set_min_cancel_notice(&0u32);
    assert_eq!(client.get_min_cancel_notice(), 0u32);
}
