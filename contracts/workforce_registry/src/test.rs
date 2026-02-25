#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};
use std::vec::Vec as StdVec;

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

#[test]
fn test_get_workers_by_employer_pagination() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(WorkforceRegistryContract, ());
    let client = WorkforceRegistryContractClient::new(&e, &contract_id);

    let employer = Address::generate(&e);
    let preferred_token = Address::generate(&e);

    let mut workers: StdVec<Address> = StdVec::new();
    let mut i: u32 = 0;
    while i < 10 {
        let worker = Address::generate(&e);
        let metadata_hash = String::from_str(&e, "QmHash");
        client.register_worker(&worker, &preferred_token, &metadata_hash);
        client.set_stream_active(&employer, &worker, &true);
        workers.push(worker);
        i += 1;
    }

    let page1 = client.get_workers_by_employer(&employer, &0u32, &3u32);
    assert_eq!(page1.len(), 3);
    assert_eq!(page1.get(0).unwrap().wallet, workers.get(0).unwrap().clone());
    assert_eq!(page1.get(2).unwrap().wallet, workers.get(2).unwrap().clone());

    let page2 = client.get_workers_by_employer(&employer, &3u32, &3u32);
    assert_eq!(page2.len(), 3);
    assert_eq!(page2.get(0).unwrap().wallet, workers.get(3).unwrap().clone());

    let tail = client.get_workers_by_employer(&employer, &9u32, &10u32);
    assert_eq!(tail.len(), 1);
    assert_eq!(tail.get(0).unwrap().wallet, workers.get(9).unwrap().clone());

    let empty1 = client.get_workers_by_employer(&employer, &10u32, &1u32);
    assert_eq!(empty1.len(), 0);

    let empty2 = client.get_workers_by_employer(&employer, &0u32, &0u32);
    assert_eq!(empty2.len(), 0);
}

#[test]
fn test_get_workers_by_employer_only_active_streams() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(WorkforceRegistryContract, ());
    let client = WorkforceRegistryContractClient::new(&e, &contract_id);

    let employer = Address::generate(&e);
    let preferred_token = Address::generate(&e);

    let w1 = Address::generate(&e);
    let w2 = Address::generate(&e);
    let w3 = Address::generate(&e);
    let metadata_hash = String::from_str(&e, "QmHash");

    client.register_worker(&w1, &preferred_token, &metadata_hash);
    client.register_worker(&w2, &preferred_token, &metadata_hash);
    client.register_worker(&w3, &preferred_token, &metadata_hash);

    client.set_stream_active(&employer, &w1, &true);
    client.set_stream_active(&employer, &w2, &true);
    client.set_stream_active(&employer, &w3, &true);

    let all = client.get_workers_by_employer(&employer, &0u32, &10u32);
    assert_eq!(all.len(), 3);

    client.set_stream_active(&employer, &w2, &false);

    let after = client.get_workers_by_employer(&employer, &0u32, &10u32);
    assert_eq!(after.len(), 2);
    assert!(after.iter().any(|p| p.wallet == w1));
    assert!(after.iter().any(|p| p.wallet == w3));
    assert!(!after.iter().any(|p| p.wallet == w2));
}

#[test]
fn test_query_performance_scales_with_page_size() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(WorkforceRegistryContract, ());
    let client = WorkforceRegistryContractClient::new(&e, &contract_id);

    let employer = Address::generate(&e);
    let preferred_token = Address::generate(&e);
    let metadata_hash = String::from_str(&e, "QmHash");

    let mut i: u32 = 0;
    while i < 200 {
        let worker = Address::generate(&e);
        client.register_worker(&worker, &preferred_token, &metadata_hash);
        client.set_stream_active(&employer, &worker, &true);
        i += 1;
    }

    e.budget().reset_unlimited();
    let cpu_before_small = e.budget().cpu_instruction_cost();
    let small = client.get_workers_by_employer(&employer, &0u32, &5u32);
    assert_eq!(small.len(), 5);
    let cpu_after_small = e.budget().cpu_instruction_cost();
    let small_cost = cpu_after_small.saturating_sub(cpu_before_small);

    e.budget().reset_unlimited();
    let cpu_before_large = e.budget().cpu_instruction_cost();
    let large = client.get_workers_by_employer(&employer, &0u32, &50u32);
    assert_eq!(large.len(), 50);
    let cpu_after_large = e.budget().cpu_instruction_cost();
    let large_cost = cpu_after_large.saturating_sub(cpu_before_large);

    assert!(large_cost > small_cost);
    assert!(large_cost < small_cost.saturating_mul(20));
}
