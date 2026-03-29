#![cfg(test)]
use super::*;
use crate::test::setup;
use soroban_sdk::testutils::{Address as _, Ledger as _};

// ─── Default fallback (365 days) ─────────────────────────────────────────────

#[test]
fn test_default_max_stream_duration() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _employer, _worker, _token, _admin) = setup(&env);

    let default = 365 * 24 * 60 * 60;
    assert_eq!(client.get_max_stream_duration(), default);
}

// ─── Admin setter + getter round-trip ────────────────────────────────────────

#[test]
fn test_set_and_get_max_stream_duration() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _employer, _worker, _token, _admin) = setup(&env);

    let new_duration = 180 * 24 * 60 * 60; // 180 days
    client.set_max_stream_duration(&new_duration);
    assert_eq!(client.get_max_stream_duration(), new_duration);
}

// ─── Non-admin rejected ──────────────────────────────────────────────────────

#[test]
fn test_set_max_stream_duration_requires_admin_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _employer, _worker, _token, admin) = setup(&env);

    let new_duration = 90 * 24 * 60 * 60;
    client.set_max_stream_duration(&new_duration);

    // Verify the admin's require_auth was invoked
    use soroban_sdk::testutils::MockAuth;
    let auths = env.auths();
    assert!(!auths.is_empty());
    // The last auth invocation must be from the admin address
    let (addr, _) = &auths[auths.len() - 1];
    assert_eq!(*addr, admin);
}

// ─── Zero-second duration rejected ───────────────────────────────────────────

#[test]
fn test_set_max_stream_duration_zero_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _employer, _worker, _token, _admin) = setup(&env);

    let res = client.try_set_max_stream_duration(&0u64);
    let err = res.unwrap_err().unwrap();
    assert_eq!(err, QuipayError::InvalidTimeRange);
}

// ─── Stream creation validates against configured value ──────────────────────

#[test]
fn test_create_stream_respects_configured_max_duration() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });

    // Reduce max to 30 days
    let thirty_days = 30 * 24 * 60 * 60;
    client.set_max_stream_duration(&thirty_days);

    // Exactly 30 days → OK
    let res = client.try_create_stream(
        &employer,
        &worker,
        &token,
        &100,
        &0u64,
        &0u64,
        &thirty_days,
        &None, &None,
    );
    assert!(res.is_ok());

    // 30 days + 1 second → rejected
    let res = client.try_create_stream(
        &employer,
        &worker,
        &token,
        &100,
        &0u64,
        &0u64,
        &(thirty_days + 1),
        &None, &None,
    );
    let err = res.unwrap_err().unwrap();
    assert_eq!(err, QuipayError::InvalidTimeRange);
}

// ─── Default 365-day enforcement (no explicit config) ────────────────────────

#[test]
fn test_create_stream_max_duration_enforced() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });

    // Valid duration: 365 days
    let valid_duration = 365 * 24 * 60 * 60;
    let res = client.try_create_stream(
        &employer,
        &worker,
        &token,
        &100,
        &0u64,
        &0u64,
        &valid_duration,
        &None, &None,
    );
    assert!(res.is_ok());

    // Invalid duration: 365 days + 1 second
    let invalid_duration = valid_duration + 1;
    let res = client.try_create_stream(
        &employer,
        &worker,
        &token,
        &100,
        &0u64,
        &0u64,
        &invalid_duration,
        &None, &None,
    );

    let err = res.unwrap_err().unwrap();
    assert_eq!(err, QuipayError::InvalidTimeRange);
}

// ─── Updating max duration re-validates on next stream creation ──────────────

#[test]
fn test_update_max_duration_affects_subsequent_streams() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });

    let sixty_days = 60 * 24 * 60 * 60;
    let ninety_days = 90 * 24 * 60 * 60;

    // Set max to 60 days → 90-day stream rejected
    client.set_max_stream_duration(&sixty_days);
    let res = client.try_create_stream(
        &employer,
        &worker,
        &token,
        &100,
        &0u64,
        &0u64,
        &ninety_days,
        &None, &None,
    );
    assert!(res.is_err());

    // Raise max to 90 days → same stream now accepted
    client.set_max_stream_duration(&ninety_days);
    let res = client.try_create_stream(
        &employer,
        &worker,
        &token,
        &100,
        &0u64,
        &0u64,
        &ninety_days,
        &None, &None,
    );
    assert!(res.is_ok());
}
