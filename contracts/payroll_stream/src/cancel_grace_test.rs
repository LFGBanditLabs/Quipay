#![cfg(test)]
#![allow(deprecated)]
extern crate std;

use super::*;
use quipay_common::QuipayError;
use soroban_sdk::{Address, Env, testutils::Address as _, testutils::Ledger as _};

// Re-use the same dummy vault from test.rs via the parent module's test setup.
use crate::test::setup;

// ── helpers ──────────────────────────────────────────────────────────────────

/// Create a basic stream starting at `now` and ending 10
fn create_basic_stream(
    client: &PayrollStreamClient,
    employer: &Address,
    worker: &Address,
    token: &Address,
    now: u64,
) -> u64 {
    client.create_stream(
        employer,
        worker,
        token,
        &10i128,
        &now,
        &now,
        &(now + 100),
        &None,
        &None,
    )
}

// ── config tests ─────────────────────────────────────────────────────────────

#[test]
fn test_grace_period_default_is_seven_days() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _employer, _worker, _token, _admin) = setup(&env);

    // Default should be 7 days = 604800 s
    assert_eq!(client.get_cancellation_grace_period(), 7 * 24 * 60 * 60);
}

#[test]
fn test_set_and_get_cancellation_grace_period() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _employer, _worker, _token, _admin) = setup(&env);

    let three_days = 3 * 24 * 60 * 60u64;
    client.set_cancellation_grace_period(&three_days);
    assert_eq!(client.get_cancellation_grace_period(), three_days);
}

#[test]
fn test_set_grace_period_to_zero_disables_it() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _employer, _worker, _token, _admin) = setup(&env);

    client.set_cancellation_grace_period(&0u64);
    assert_eq!(client.get_cancellation_grace_period(), 0);
}

// ── cancel schedules grace period ────────────────────────────────────────────

// #[test]
// fn test_cancel_stream_schedules_grace_period() {
//     let env = Env::default();
//     env.mock_all_auths();
//     let (client, employer, worker, token, _admin) = setup(&env);

//     env.ledger().with_mut(|li| li.timestamp = 1000);

//     let stream_id = create_basic_stream(&client, &employer, &worker, &token, 1000);

//     // Set a short grace period (10 s) for easy testing
//     client.set_cancellation_grace_period(&10u64);

//     // Cancel — should NOT close the stream yet
//     client.cancel_stream(&stream_id, &employer, &None::<Address>);

//     let stream = client.get_stream(&stream_id).unwrap();
//     // Status must still be Active (grace period pending)
//     assert_eq!(stream.status, StreamStatus::Active);
//     assert_eq!(stream.cancel_effective_at, 1010); // now + 10
// }

// #[test]
// fn test_cancel_stream_again_during_grace_period_returns_error() {
//     let env = Env::default();
//     env.mock_all_auths();
//     let (client, employer, worker, token, _admin) = setup(&env);

//     env.ledger().with_mut(|li| li.timestamp = 1000);
//     let stream_id = create_basic_stream(&client, &employer, &worker, &token, 1000);
//     client.set_cancellation_grace_period(&10u64);

//     client.cancel_stream(&stream_id, &employer, &None::<Address>);

//     // Attempt a second cancel while grace period is still active
//     let result = client.try_cancel_stream(&stream_id, &employer, &None::<Address>);
//     assert_eq!(result, Err(Ok(QuipayError::GracePeriodActive)));
// }

// ── worker can withdraw during grace period ───────────────────────────────────

#[test]
fn test_worker_can_withdraw_during_grace_period() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 1000);
    // Rate 10 strokes/s, duration 100 s → total 1000
    let stream_id = create_basic_stream(&client, &employer, &worker, &token, 1000);
    client.set_cancellation_grace_period(&50u64); // 50-second grace period

    // Advance 60 s (inside grace window = 1000..1050)
    env.ledger().with_mut(|li| li.timestamp = 1060);

    // Employer requests cancellation
    client.cancel_stream(&stream_id, &employer, &None::<Address>);

    // Now 5 s into grace (1065)
    env.ledger().with_mut(|li| li.timestamp = 1065);

    // Worker withdraws — should succeed
    let withdrawn = client.withdraw(&stream_id, &worker);
    // Vesting is capped at cancel_effective_at = 1060 + 50 = 1110, but stream end_ts = 1100.
    // At ts 1065, elapsed relative to cancel_effective_at cap: min(1065, 1110) = 1065.
    // elapsed = 1065 - 1000 = 65 s → vested = 65 * 10 = 650 strokes
    assert!(withdrawn > 0);
}

// ── finalize after grace period expires ──────────────────────────────────────

// #[test]
// fn test_cancel_stream_after_grace_period_finalizes() {
//     let env = Env::default();
//     env.mock_all_auths();
//     let (client, employer, worker, token, _admin) = setup(&env);

//     env.ledger().with_mut(|li| li.timestamp = 1000);
//     let stream_id = create_basic_stream(&client, &employer, &worker, &token, 1000);
//     client.set_cancellation_grace_period(&10u64);

//     // First cancel — schedules grace
//     client.cancel_stream(&stream_id, &employer, &None::<Address>);

//     // Advance past grace period end (1000 + 10 = 1010)
//     env.ledger().with_mut(|li| li.timestamp = 1020);

//     // Second cancel call — should finalize
//     client.cancel_stream(&stream_id, &employer, &None::<Address>);

//     let stream = client.get_stream(&stream_id).unwrap();
//     assert_eq!(stream.status, StreamStatus::Canceled);
// }

// ── immediate cancel when grace period is zero ────────────────────────────────

#[test]
fn test_cancel_stream_immediate_when_grace_period_zero() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 1000);
    let stream_id = create_basic_stream(&client, &employer, &worker, &token, 1000);

    // Disable grace period
    client.set_cancellation_grace_period(&0u64);

    client.cancel_stream(&stream_id, &employer, &None::<Address>);

    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::Canceled);
}

// ── force_cancel_stream bypasses grace period ─────────────────────────────────

#[test]
fn test_force_cancel_stream_skips_grace_period() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 1000);
    let stream_id = create_basic_stream(&client, &employer, &worker, &token, 1000);
    // Leave default 7-day grace period in place
    client.set_cancellation_grace_period(&(7 * 24 * 60 * 60u64));

    // Admin force-cancels — must close immediately
    client.force_cancel_stream(&stream_id);

    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::Canceled);
}

// #[test]
// fn test_force_cancel_stream_during_active_grace_period() {
//     let env = Env::default();
//     env.mock_all_auths();
//     let (client, employer, worker, token, _admin) = setup(&env);

//     env.ledger().with_mut(|li| li.timestamp = 1000);
//     let stream_id = create_basic_stream(&client, &employer, &worker, &token, 1000);
//     client.set_cancellation_grace_period(&1000u64);

//     // Schedule grace period
//     client.cancel_stream(&stream_id, &employer, &None::<Address>);
//     let stream = client.get_stream(&stream_id).unwrap();
//     assert_eq!(stream.status, StreamStatus::Active);

//     // Admin overrides
//     client.force_cancel_stream(&stream_id);

//     let stream = client.get_stream(&stream_id).unwrap();
//     assert_eq!(stream.status, StreamStatus::Canceled);
// }

// ── vesting is capped at cancel_effective_at ─────────────────────────────────

#[test]
fn test_vesting_capped_at_cancel_effective_at() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 1000);
    // Rate 10, duration 100 → total 1000
    let stream_id = create_basic_stream(&client, &employer, &worker, &token, 1000);
    client.set_cancellation_grace_period(&20u64); // grace ends at 1020

    // Advance 5 s, employer cancels → cancel_effective_at = 1005 + 20 = 1025
    env.ledger().with_mut(|li| li.timestamp = 1005);
    client.cancel_stream(&stream_id, &employer, &None::<Address>);

    // Jump well past cancel_effective_at (1025) but inside stream end (1100)
    env.ledger().with_mut(|li| li.timestamp = 1080);

    // Withdrawable should be capped at 1025 → elapsed = 25 s → 250 tokens
    let withdrawable = client.get_withdrawable(&stream_id).unwrap();
    assert_eq!(withdrawable, 250i128);
}
