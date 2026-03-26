#![cfg(test)]

extern crate std;

use super::*;
use quipay_common::QuipayError;
use soroban_sdk::{Address, Env, String, testutils::Address as _};
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
    client.try_register_worker(&worker, &preferred_token, &metadata_hash).unwrap();

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

    client.try_register_worker(&worker, &token1, &hash1).unwrap();

    // Update profile
    client.try_update_worker(&worker, &token2, &hash2).unwrap();

    let profile = client.get_worker(&worker).unwrap();
    assert_eq!(profile.preferred_token, token2);
    assert_eq!(profile.metadata_hash, hash2);
}

#[test]
fn test_duplicate_registration() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(WorkforceRegistryContract, ());
    let client = WorkforceRegistryContractClient::new(&e, &contract_id);

    let worker = Address::generate(&e);
    let token = Address::generate(&e);
    let hash = String::from_str(&e, "QmHash");

    let _ = client.try_register_worker(&worker, &token, &hash).unwrap();
    let result = client.try_register_worker(&worker, &token, &hash);
    assert_eq!(result, Err(Ok(QuipayError::AlreadyInitialized)));
}

#[test]
fn test_update_nonexistent_worker() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(WorkforceRegistryContract, ());
    let client = WorkforceRegistryContractClient::new(&e, &contract_id);

    let worker = Address::generate(&e);
    let token = Address::generate(&e);
    let hash = String::from_str(&e, "QmHash");

    let result = client.try_update_worker(&worker, &token, &hash);
    assert_eq!(result, Err(Ok(QuipayError::WorkerNotFound)));
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
        client.try_register_worker(&worker, &preferred_token, &metadata_hash).unwrap();
        client.try_set_stream_active(&employer, &worker, &true).unwrap();
        workers.push(worker);
        i += 1;
    }

    let page1 = client.get_workers_by_employer(&employer, &0u32, &3u32);
    assert_eq!(page1.len(), 3);
    assert_eq!(
        page1.get(0).unwrap().wallet,
        workers.get(0).unwrap().clone()
    );
    assert_eq!(
        page1.get(2).unwrap().wallet,
        workers.get(2).unwrap().clone()
    );

    let page2 = client.get_workers_by_employer(&employer, &3u32, &3u32);
    assert_eq!(page2.len(), 3);
    assert_eq!(
        page2.get(0).unwrap().wallet,
        workers.get(3).unwrap().clone()
    );

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

    client.try_register_worker(&w1, &preferred_token, &metadata_hash).unwrap();
    client.try_register_worker(&w2, &preferred_token, &metadata_hash).unwrap();
    client.try_register_worker(&w3, &preferred_token, &metadata_hash).unwrap();

    client.try_set_stream_active(&employer, &w1, &true).unwrap();
    client.try_set_stream_active(&employer, &w2, &true).unwrap();
    client.try_set_stream_active(&employer, &w3, &true).unwrap();

    let all = client.get_workers_by_employer(&employer, &0u32, &10u32);
    assert_eq!(all.len(), 3);

    client.try_set_stream_active(&employer, &w2, &false).unwrap();

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
        client.try_register_worker(&worker, &preferred_token, &metadata_hash).unwrap();
        client.try_set_stream_active(&employer, &worker, &true).unwrap();
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

#[test]
fn test_get_workers_with_missing_storage_entries() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(WorkforceRegistryContract, ());
    let client = WorkforceRegistryContractClient::new(&e, &contract_id);

    let employer = Address::generate(&e);
    let preferred_token = Address::generate(&e);
    let metadata_hash = String::from_str(&e, "QmHash");

    // Register workers and activate streams
    let w1 = Address::generate(&e);
    let w2 = Address::generate(&e);
    let w3 = Address::generate(&e);

    let _ = client.try_register_worker(&w1, &preferred_token, &metadata_hash).unwrap();
    let _ = client.try_register_worker(&w2, &preferred_token, &metadata_hash).unwrap();
    let _ = client.try_register_worker(&w3, &preferred_token, &metadata_hash).unwrap();

    let _ = client.try_set_stream_active(&employer, &w1, &true).unwrap();
    let _ = client.try_set_stream_active(&employer, &w2, &true).unwrap();
    let _ = client.try_set_stream_active(&employer, &w3, &true).unwrap();

    // Simulate corrupted state by manually removing a worker profile
    // This tests that get_workers_by_employer handles missing entries gracefully
    let worker_key = DataKey::Worker(w2.clone());
    e.as_contract(&contract_id, || {
        e.storage().persistent().remove(&worker_key);
    });

    // Should not panic and should skip the corrupted entry
    let workers = client.get_workers_by_employer(&employer, &0u32, &10u32);
    
    // Should return only the valid workers (w1 and w3), skipping w2
    assert_eq!(workers.len(), 2);
    assert!(workers.iter().any(|p| p.wallet == w1));
    assert!(workers.iter().any(|p| p.wallet == w3));
    assert!(!workers.iter().any(|p| p.wallet == w2));
}

// ============================================================================
// Two-Step Admin Transfer Tests
// ============================================================================

#[test]
fn test_initialize_and_get_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(WorkforceRegistryContract, ());
    let client = WorkforceRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    // Initialize
    client.initialize(&admin);
    assert_eq!(client.get_admin(), admin);
}

#[test]
fn test_two_step_admin_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(WorkforceRegistryContract, ());
    let client = WorkforceRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);

    // Initialize
    client.initialize(&admin);
    assert_eq!(client.get_admin(), admin);

    // Step 1: Propose new admin
    client.propose_admin(&new_admin);
    assert_eq!(client.get_pending_admin(), Some(new_admin.clone()));
    assert_eq!(client.get_admin(), admin); // Admin hasn't changed yet

    // Step 2: Accept admin role
    client.accept_admin();
    assert_eq!(client.get_admin(), new_admin);
    assert_eq!(client.get_pending_admin(), None); // Pending cleared
}

#[test]
fn test_accept_admin_requires_pending() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(WorkforceRegistryContract, ());
    let client = WorkforceRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Try to accept without pending admin - should fail with NoPendingAdmin
    let result = client.try_accept_admin();
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().unwrap(), QuipayError::NoPendingAdmin);
}

#[test]
fn test_transfer_admin_backward_compatible() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(WorkforceRegistryContract, ());
    let client = WorkforceRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);

    // Initialize
    client.initialize(&admin);
    assert_eq!(client.get_admin(), admin);

    // Use transfer_admin function (backward compatible)
    client.transfer_admin(&new_admin);
    
    // Should transfer atomically
    assert_eq!(client.get_admin(), new_admin);
    assert_eq!(client.get_pending_admin(), None); // No pending admin left
}

#[test]
fn test_set_blacklisted_requires_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(WorkforceRegistryContract, ());
    let client = WorkforceRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let worker = Address::generate(&env);

    client.initialize(&admin);

    // Admin can blacklist
    client.set_blacklisted(&worker, &true);
    assert_eq!(client.is_blacklisted(&worker), true);

    // Admin can unblacklist
    client.set_blacklisted(&worker, &false);
    assert_eq!(client.is_blacklisted(&worker), false);
}
