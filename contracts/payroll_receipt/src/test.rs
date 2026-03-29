#![cfg(test)]

use soroban_sdk::{Address, Env, testutils::Address as _};

use crate::{ClosureReason, PayrollReceiptContract, PayrollReceiptContractClient};

fn setup(env: &Env) -> (Address, Address, PayrollReceiptContractClient) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, PayrollReceiptContract);
    let client = PayrollReceiptContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let minter = Address::generate(env);
    client.init(&admin, &minter);

    (admin, minter, client)
}

#[test]
fn test_mint_and_get_receipt() {
    let env = Env::default();
    let (_admin, _minter, client) = setup(&env);

    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    let receipt_id = client.mint(
        &1u64,
        &employer,
        &worker,
        &token,
        &1_000_000i128,
        &1_000u64,
        &2_000u64,
        &2_000u64,
        &ClosureReason::Completed,
    );
    assert_eq!(receipt_id, 1u64);

    let receipt = client.get_receipt(&receipt_id);
    assert_eq!(receipt.stream_id, 1u64);
    assert_eq!(receipt.employer, employer);
    assert_eq!(receipt.worker, worker);
    assert_eq!(receipt.total_paid, 1_000_000i128);
    assert_eq!(receipt.reason, ClosureReason::Completed);
}

#[test]
fn test_worker_receipts_index() {
    let env = Env::default();
    let (_admin, _minter, client) = setup(&env);

    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    client.mint(&1u64, &employer, &worker, &token, &500i128, &0u64, &100u64, &100u64, &ClosureReason::Completed);
    client.mint(&2u64, &employer, &worker, &token, &300i128, &0u64, &100u64, &100u64, &ClosureReason::Cancelled);

    let ids = client.get_worker_receipts(&worker, &0u32, &10u32);
    assert_eq!(ids.len(), 2);
}

#[test]
fn test_receipt_ids_increment() {
    let env = Env::default();
    let (_admin, _minter, client) = setup(&env);

    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    let id1 = client.mint(&1u64, &employer, &worker, &token, &100i128, &0u64, &100u64, &100u64, &ClosureReason::Completed);
    let id2 = client.mint(&2u64, &employer, &worker, &token, &200i128, &0u64, &100u64, &100u64, &ClosureReason::Cancelled);

    assert_eq!(id1, 1u64);
    assert_eq!(id2, 2u64);
}
