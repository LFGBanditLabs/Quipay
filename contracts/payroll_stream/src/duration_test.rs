#![cfg(test)]
use super::*;
use crate::test::setup;
use soroban_sdk::testutils::Ledger as _;

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
        &None,
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
        &None,
    );

    let err = res.unwrap_err().unwrap();
    assert_eq!(err, QuipayError::InvalidTimeRange);
}
