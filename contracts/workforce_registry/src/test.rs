#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Bytes, Env};

#[test]
fn test_register_and_get_worker() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(WorkforceRegistry, ());
    let client = WorkforceRegistryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let worker = Address::generate(&env);
    let name = Bytes::from_slice(&env, b"John Doe");
    let email = Bytes::from_slice(&env, b"john@example.com");

    client.register_worker(&worker, &name, &email);

    let profile = client.get_worker(&worker).unwrap();
    assert_eq!(profile.name, name);
    assert_eq!(profile.email, email);
    assert!(profile.active);
}

#[test]
fn test_update_worker() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(WorkforceRegistry, ());
    let client = WorkforceRegistryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let worker = Address::generate(&env);
    let name = Bytes::from_slice(&env, b"John Doe");
    let email = Bytes::from_slice(&env, b"john@example.com");

    client.register_worker(&worker, &name, &email);

    let new_name = Bytes::from_slice(&env, b"Jane Doe");
    let new_email = Bytes::from_slice(&env, b"jane@example.com");

    client.update_worker(&worker, &new_name, &new_email, &false);

    let profile = client.get_worker(&worker).unwrap();
    assert_eq!(profile.name, new_name);
    assert_eq!(profile.email, new_email);
    assert!(!profile.active);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialize() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(WorkforceRegistry, ());
    let client = WorkforceRegistryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.initialize(&admin);
}

#[test]
#[should_panic(expected = "worker not found")]
fn test_update_nonexistent_worker() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(WorkforceRegistry, ());
    let client = WorkforceRegistryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let worker = Address::generate(&env);
    let name = Bytes::from_slice(&env, b"John Doe");
    let email = Bytes::from_slice(&env, b"john@example.com");

    client.update_worker(&worker, &name, &email, &true);
}
