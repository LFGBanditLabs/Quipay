#![cfg(test)]
use super::*;
use crate::test::setup;
use soroban_sdk::{testutils::Address as _, testutils::Events, testutils::Ledger as _, TryFromVal};

#[test]
fn test_pause_and_resume_stream_vesting() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });

    // Create a 100s stream with rate 1 (total 100)
    let stream_id = client.create_stream(
        &employer, &worker, &token, &1, &0u64, &0u64, &100u64, &None, &None,
    );

    // Fast forward to t=10
    env.ledger().with_mut(|li| li.timestamp = 10);
    assert_eq!(client.get_withdrawable(&stream_id), Some(10));

    // Pause at t=10
    client.pause_stream(&stream_id, &employer);

    // Fast forward to t=20 (stream is paused)
    env.ledger().with_mut(|li| li.timestamp = 20);
    // Vesting should be frozen at 10
    assert_eq!(client.get_withdrawable(&stream_id), Some(10));

    // Resume at t=20
    client.resume_stream(&stream_id, &employer);

    // Fast forward to t=30 (stream has been active for 10s + 10s = 20s total)
    env.ledger().with_mut(|li| li.timestamp = 30);
    // Elapsed active time = (30 - 0) - (20 - 10) = 20
    assert_eq!(client.get_withdrawable(&stream_id), Some(20));

    // Withdraw at t=30
    client.withdraw(&stream_id, &worker);
    assert_eq!(client.get_withdrawable(&stream_id), Some(0));

    // Check end time shifting behavior (vesting should continue until 100s of active time)
    // Original end was 100. New effective end should be 110.
    env.ledger().with_mut(|li| li.timestamp = 110);
    assert_eq!(client.get_withdrawable(&stream_id), Some(80)); // 100 - 20 withdrawn
}

#[test]
fn test_pause_stream_wrong_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);
    let malicious = Address::generate(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = client.create_stream(
        &employer, &worker, &token, &1, &0u64, &0u64, &100u64, &None, &None,
    );

    // Malicious user tries to pause
    let result = client.try_pause_stream(&stream_id, &malicious);
    assert!(result.is_err());
}

#[test]
fn test_admin_pause_and_resume_stream() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id =
        client.create_stream(&employer, &worker, &token, &1, &0, &0, &100, &None, &None);

    // Admin pauses
    client.admin_pause_stream(&stream_id);
    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::Paused);

    // Admin resumes
    env.ledger().with_mut(|li| li.timestamp = 10);
    client.admin_resume_stream(&stream_id);
    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::Active);
    assert_eq!(stream.total_paused_duration, 10);
}

#[test]
fn test_withdraw_from_paused_stream() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id =
        client.create_stream(&employer, &worker, &token, &1, &0, &0, &100, &None, &None);

    // Fast forward to t=25
    env.ledger().with_mut(|li| li.timestamp = 25);
    assert_eq!(client.get_withdrawable(&stream_id), Some(25));

    // Pause at t=25
    client.pause_stream(&stream_id, &employer);

    // Fast forward to t=50 (paused)
    env.ledger().with_mut(|li| li.timestamp = 50);
    // Should still only have 25 available
    assert_eq!(client.get_withdrawable(&stream_id), Some(25));

    // Worker withdraws while paused
    let withdrawn = client.withdraw(&stream_id, &worker);
    assert_eq!(withdrawn, 25);

    // Check state
    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.withdrawn_amount, 25);
    assert_eq!(client.get_withdrawable(&stream_id), Some(0));
}

#[test]
fn test_cliff_ts_equals_start_ts() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);

    // Create stream with cliff_ts == start_ts
    let stream_id =
        client.create_stream(&employer, &worker, &token, &1, &10, &10, &100, &None, &None);

    let stream = client.get_stream(&stream_id).unwrap();
    // Should be normalized to effective_cliff = start_ts = 10
    assert_eq!(stream.cliff_ts, 10);
    assert_eq!(stream.start_ts, 10);

    // Verify it vests immediately after t=10
    env.ledger().with_mut(|li| li.timestamp = 11);
    assert_eq!(client.get_withdrawable(&stream_id), Some(1));
}

#[test]
fn test_resume_event_fields() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = client.create_stream(
        &employer, &worker, &token, &1, &0u64, &0u64, &100u64, &None, &None,
    );

    // Pause at t=10
    env.ledger().with_mut(|li| li.timestamp = 10);
    client.pause_stream(&stream_id, &employer);

    // Resume at t=25 (Pause duration = 15)
    env.ledger().with_mut(|li| li.timestamp = 25);
    client.resume_stream(&stream_id, &employer);

    let events = env.events().all();
    let (_, _, value) = events
        .iter()
        .find(|(_, topics, _)| {
            Symbol::try_from_val(&env, &topics.get(0).unwrap()).unwrap()
                == Symbol::new(&env, "stream")
                && Symbol::try_from_val(&env, &topics.get(1).unwrap()).unwrap()
                    == Symbol::new(&env, "resumed")
        })
        .expect("Resume event not found");

    // The value should be (now, paused_duration, total_paused_duration)
    // now = 25, paused_duration = 15, total_paused_duration = 15
    let expected_val: (u64, u64, u64) = (25, 15, 15);
    let val: (u64, u64, u64) = TryFromVal::try_from_val(&env, &value).unwrap();
    assert_eq!(val, expected_val);
}

#[test]
fn test_admin_resume_event_fields() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = client.create_stream(
        &employer, &worker, &token, &1, &0u64, &0u64, &100u64, &None, &None,
    );

    // Admin Pause at t=10
    env.ledger().with_mut(|li| li.timestamp = 10);
    client.admin_pause_stream(&stream_id);

    // Admin Resume at t=35 (Pause duration = 25)
    env.ledger().with_mut(|li| li.timestamp = 35);
    client.admin_resume_stream(&stream_id);

    let events = env.events().all();
    let (_, _, value) = events
        .iter()
        .find(|(_, topics, _)| {
            Symbol::try_from_val(&env, &topics.get(0).unwrap()).unwrap()
                == Symbol::new(&env, "stream")
                && Symbol::try_from_val(&env, &topics.get(1).unwrap()).unwrap()
                    == Symbol::new(&env, "resumed")
        })
        .expect("Resume event not found");

    // now = 35, pause_duration = 25, total_paused_duration = 25
    let expected_val: (u64, u64, u64) = (35, 25, 25);
    let val: (u64, u64, u64) = TryFromVal::try_from_val(&env, &value).unwrap();
    assert_eq!(val, expected_val);
}

#[test]
fn test_is_stream_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = client.create_stream(
        &employer, &worker, &token, &1, &0u64, &0u64, &100u64, &None, &None,
    );

    // Active stream should not be paused
    assert_eq!(client.is_stream_paused(&stream_id), false);

    // Pause the stream
    env.ledger().with_mut(|li| li.timestamp = 10);
    client.pause_stream(&stream_id, &employer);
    assert_eq!(client.is_stream_paused(&stream_id), true);

    // Resume the stream
    env.ledger().with_mut(|li| li.timestamp = 20);
    client.resume_stream(&stream_id, &employer);
    assert_eq!(client.is_stream_paused(&stream_id), false);
}

#[test]
fn test_is_stream_paused_not_found() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _employer, _worker, _token, _admin) = setup(&env);

    let result = client.try_is_stream_paused(&999u64);
    assert!(result.is_err());
}

#[test]
fn test_get_stream_paused_at() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = client.create_stream(
        &employer, &worker, &token, &1, &0u64, &0u64, &100u64, &None, &None,
    );

    // Not paused — should return None
    assert_eq!(client.get_stream_paused_at(&stream_id), None);

    // Pause at t=42
    env.ledger().with_mut(|li| li.timestamp = 42);
    client.pause_stream(&stream_id, &employer);
    assert_eq!(client.get_stream_paused_at(&stream_id), Some(42u64));

    // Resume — should return None again
    env.ledger().with_mut(|li| li.timestamp = 50);
    client.resume_stream(&stream_id, &employer);
    assert_eq!(client.get_stream_paused_at(&stream_id), None);
}

#[test]
fn test_get_stream_paused_at_not_found() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _employer, _worker, _token, _admin) = setup(&env);

    let result = client.try_get_stream_paused_at(&999u64);
    assert!(result.is_err());
}
