#![cfg(test)]

use super::*;
use soroban_sdk::{Env, Address, testutils::Address as _};

#[test]
fn test_register_and_get_worker() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(WorkforceRegistryContract, ());
    let client = WorkforceRegistryContractClient::new(&e, &contract_id);

    let worker = Address::generate(&e);
    let preferred_token = Address::generate(&e);
    let metadata_hash = String::from_str(&e, "QmHash123");

    // Test initial state
    assert_eq!(client.is_registered(&worker), false);
    assert_eq!(client.get_worker(&worker), None);

    // Register worker
    client.register_worker(&worker, &preferred_token, &metadata_hash);

    // Verify registration
    assert_eq!(client.is_registered(&worker), true);
    
    let profile = client.get_worker(&worker).unwrap();
    assert_eq!(profile.wallet, worker);
    assert_eq!(profile.preferred_token, preferred_token);
    assert_eq!(profile.metadata_hash, metadata_hash);
}

#[test]
fn test_update_worker() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(WorkforceRegistryContract, ());
    let client = WorkforceRegistryContractClient::new(&e, &contract_id);

    let worker = Address::generate(&e);
    let token1 = Address::generate(&e);
    let token2 = Address::generate(&e);
    let hash1 = String::from_str(&e, "QmHash1");
    let hash2 = String::from_str(&e, "QmHash2");

    client.register_worker(&worker, &token1, &hash1);
    
    // Update profile
    client.update_worker(&worker, &token2, &hash2);

    let profile = client.get_worker(&worker).unwrap();
    assert_eq!(profile.preferred_token, token2);
    assert_eq!(profile.metadata_hash, hash2);
}

#[test]
#[should_panic(expected = "Worker already registered")]
fn test_duplicate_registration() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(WorkforceRegistryContract, ());
    let client = WorkforceRegistryContractClient::new(&e, &contract_id);

    let worker = Address::generate(&e);
    let token = Address::generate(&e);
    let hash = String::from_str(&e, "QmHash");

    client.register_worker(&worker, &token, &hash);
    client.register_worker(&worker, &token, &hash);
}

#[test]
#[should_panic(expected = "Worker not registered")]
fn test_update_nonexistent_worker() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(WorkforceRegistryContract, ());
    let client = WorkforceRegistryContractClient::new(&e, &contract_id);

    let worker = Address::generate(&e);
    let token = Address::generate(&e);
    let hash = String::from_str(&e, "QmHash");

    client.update_worker(&worker, &token, &hash);
}
