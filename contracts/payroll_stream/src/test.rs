#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_pause_mechanism() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);

    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);

    // 1. Initial state: not paused
    assert!(!client.is_paused());
    client.create_stream(&employer, &worker, &1000); // Should not panic

    // 2. Admin pauses the protocol
    client.set_paused(&true);
    assert!(client.is_paused());

    // 3. Operations should panic when paused
}

#[test]
#[should_panic(expected = "protocol is paused")]
fn test_create_stream_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_paused(&true);
    client.create_stream(&employer, &worker, &1000);
}

#[test]
#[should_panic(expected = "protocol is paused")]
fn test_withdraw_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let worker = Address::generate(&env);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_paused(&true);
    client.withdraw(&worker);
}

#[test]
#[should_panic(expected = "protocol is paused")]
fn test_cancel_stream_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_paused(&true);
    client.cancel_stream(&employer, &worker);
}

#[test]
fn test_unpause_resumes_operations() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_paused(&true);
    assert!(client.is_paused());

    client.set_paused(&false);
    assert!(!client.is_paused());
    client.create_stream(&employer, &worker, &1000); // Should not panic
}
