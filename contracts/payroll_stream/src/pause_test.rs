#![cfg(test)]
use super::*;
use crate::test::setup;
use soroban_sdk::{testutils::Address as _, testutils::Ledger as _};

#[test]
fn test_pause_and_resume_stream_vesting() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _admin) = setup(&env);

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });

    // Create a 100s stream with rate 1 (total 100)
    let stream_id =
        client.create_stream(&employer, &worker, &token, &1, &0u64, &0u64, &100u64, &None);

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
    let stream_id =
        client.create_stream(&employer, &worker, &token, &1, &0u64, &0u64, &100u64, &None);

    // Malicious user tries to pause
    let result = client.try_pause_stream(&stream_id, &malicious);
    assert!(result.is_err());
}
