#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};
use quipay_common::QuipayError;

#[test]
fn test_pause_mechanism() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);

    let contract_id = env.register(PayrollStream, ());
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);

    // 1. Initial state: not paused
    assert!(!client.is_paused());
    client.create_stream(&employer, &worker, &1000); // Should not panic

    // 2. Admin pauses the protocol
    client.set_paused(&true);
    assert!(client.is_paused());
}

#[test]
fn test_create_stream_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let contract_id = env.register(PayrollStream, ());
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_paused(&true);
    let result = client.try_create_stream(&employer, &worker, &1000);
    
    assert_eq!(
        result,
        Err(Ok(QuipayError::ProtocolPaused))
    );
}

#[test]
fn test_withdraw_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let worker = Address::generate(&env);
    let contract_id = env.register(PayrollStream, ());
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_paused(&true);
    let result = client.try_withdraw(&worker);
    
    assert_eq!(
        result,
        Err(Ok(QuipayError::ProtocolPaused))
    );
}

#[test]
fn test_cancel_stream_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let contract_id = env.register(PayrollStream, ());
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_paused(&true);
    let result = client.try_cancel_stream(&employer, &worker);
    
    assert_eq!(
        result,
        Err(Ok(QuipayError::ProtocolPaused))
    );
}

#[test]
fn test_unpause_resumes_operations() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let contract_id = env.register(PayrollStream, ());
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_paused(&true);
    assert!(client.is_paused());

    client.set_paused(&false);
    assert!(!client.is_paused());
    client.create_stream(&employer, &worker, &1000); // Should not panic
}
