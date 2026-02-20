#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger as _, Address, Env};

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
    client.create_stream(&employer, &worker, &1000, &0u64, &10u64); // Should not panic

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
    client.create_stream(&employer, &worker, &1000, &0u64, &10u64);
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
    client.withdraw(&1u64, &worker);
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
    client.cancel_stream(&1u64, &employer);
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
    client.create_stream(&employer, &worker, &1000, &0u64, &10u64); // Should not panic
}

#[test]
fn test_stream_withdraw_and_cleanup() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);

    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);
    client.init(&admin);

    client.set_retention_secs(&0u64);

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });
    let stream_id = client.create_stream(&employer, &worker, &1000, &0u64, &10u64);

    env.ledger().with_mut(|li| {
        li.timestamp = 5;
    });
    let withdrawn_1 = client.withdraw(&stream_id, &worker);
    assert!(withdrawn_1 > 0);

    env.ledger().with_mut(|li| {
        li.timestamp = 10;
    });
    let withdrawn_2 = client.withdraw(&stream_id, &worker);
    assert!(withdrawn_2 > 0);

    let stream = client.get_stream(&stream_id).unwrap();
    assert!(stream.withdrawn_amount >= stream.total_amount);

    client.cleanup_stream(&stream_id);
    assert!(client.get_stream(&stream_id).is_none());
}
