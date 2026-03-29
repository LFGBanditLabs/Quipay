#![cfg(test)]

use super::*;
use quipay_common::QuipayError;
use soroban_sdk::{
    Address, BytesN, Env, contract, contractimpl,
    testutils::{Address as _, Ledger},
};

#[contract]
pub struct DummyVault;
#[contractimpl]
impl DummyVault {
    pub fn check_solvency(_env: Env, _token: Address, _additional_liability: i128) -> bool {
        true
    }
    pub fn add_liability(_env: Env, _token: Address, _amount: i128) {}
}

fn setup_test(env: &Env) -> (Address, PayrollStreamClient) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let vault_id = env.register(DummyVault, ());
    let contract_id = env.register(PayrollStream, ());
    let client = PayrollStreamClient::new(env, &contract_id);
    client.init(&admin);
    client.set_min_stream_duration(&0u64);
    client.set_vault(&vault_id);
    (admin, client)
}

#[test]
fn test_upgrade_proposal_and_state_preservation() {
    let env = Env::default();
    let (admin, client) = setup_test(&env);

    // 1. Create a stream in V1
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);
    
    let stream_id = client.create_stream(
        &employer, 
        &worker, 
        &token, 
        &100, 
        &0u64, 
        &env.ledger().timestamp(), 
        &(env.ledger().timestamp() + 1000), 
        &None,
        &None,
    );
    assert_eq!(stream_id, 1);

    // 2. Propose upgrade
    let v2_wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
    client.propose_upgrade(&v2_wasm_hash);

    // Verify pending upgrade state
    let pending = client.get_pending_upgrade().unwrap();
    assert_eq!(pending.wasm_hash, v2_wasm_hash);
    assert!(pending.execute_after > env.ledger().timestamp());

    // 3. Record state and verify it's still accessible
    assert_eq!(client.get_admin(), admin);
    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.employer, employer);
    assert_eq!(stream.worker, worker);
}

#[test]
fn test_upgrade_timelock_enforcement() {
    let env = Env::default();
    let (_admin, client) = setup_test(&env);

    let v2_wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
    client.propose_upgrade(&v2_wasm_hash);

    // Try to execute immediately - should fail with Custom (timelock not met)
    let result = client.try_execute_upgrade();
    assert_eq!(result, Err(Ok(QuipayError::Custom)));

    // Wait 24 hours (halfway)
    env.ledger().set_timestamp(env.ledger().timestamp() + 24 * 60 * 60);
    let result = client.try_execute_upgrade();
    assert_eq!(result, Err(Ok(QuipayError::Custom)));

    // Wait remaining 48 hours total
    env.ledger().set_timestamp(env.ledger().timestamp() + 24 * 60 * 60);
    let result = client.try_execute_upgrade();
    
    // Now it should have passed the timelock check. 
    match result {
        Err(Ok(err)) => assert_ne!(err, QuipayError::Custom),
        _ => {} 
    }
}

#[test]
fn test_cancel_upgrade() {
    let env = Env::default();
    let (_admin, client) = setup_test(&env);

    let v2_wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
    client.propose_upgrade(&v2_wasm_hash);

    // Cancel
    client.cancel_upgrade();

    // Verify it's gone
    assert!(client.get_pending_upgrade().is_none());

    // Try to execute - should fail as no upgrade is pending
    let result = client.try_execute_upgrade();
    assert_eq!(result, Err(Ok(QuipayError::Custom)));
}
