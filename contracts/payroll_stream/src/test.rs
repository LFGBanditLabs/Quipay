#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger as _, Address, Env};

mod dummy_vault {
    use soroban_sdk::{contract, contractimpl, Env};
    #[contract]
    pub struct DummyVault;
    #[contractimpl]
    impl DummyVault {
        pub fn add_liability(_env: Env, _amount: i128) {}
    }
}

#[test]
fn test_pause_mechanism() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    let vault_id = env.register_contract(None, dummy_vault::DummyVault);

    let contract_id = env.register(PayrollStream, ());
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_vault(&vault_id);

    assert!(!client.is_paused());

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });

    client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &10u64);

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
    let token = Address::generate(&env);

    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_vault(&vault_id);
    client.set_paused(&true);

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });
    client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &10u64);
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
    let result = client.try_withdraw(&1u64, &worker);

    assert!(result.is_err());
}

#[test]
fn test_cancel_stream_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let contract_id = env.register(PayrollStream, ());
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_paused(&true);
    let result = client.try_cancel_stream(&1u64, &employer);

    assert!(result.is_err());
}

#[test]
fn test_unpause_resumes_operations() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_vault(&vault_id);
    client.set_paused(&true);
    assert!(client.is_paused());

    client.set_paused(&false);
    assert!(!client.is_paused());

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });
    client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &10u64);
}

#[test]
fn test_stream_withdraw_and_cleanup() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    let vault_id = env.register_contract(None, dummy_vault::DummyVault);

    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);
    client.init(&admin);
    client.set_vault(&vault_id);
    client.set_retention_secs(&0u64);

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &10u64);

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

#[test]
fn test_batch_withdraw_single_stream() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_vault(&vault_id);

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &10u64);

    env.ledger().with_mut(|li| {
        li.timestamp = 5;
    });

    let stream_ids = soroban_sdk::vec![&env, stream_id];
    let results = client.batch_withdraw(&stream_ids, &worker);

    assert_eq!(results.len(), 1);
    let result = results.get(0).unwrap();
    assert_eq!(result.stream_id, stream_id);
    assert!(result.success);
    assert!(result.amount > 0);
}

#[test]
fn test_batch_withdraw_multiple_streams() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_vault(&vault_id);

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });

    let stream1 = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &10u64);
    let stream2 = client.create_stream(&employer, &worker, &token, &200, &0u64, &0u64, &20u64);
    let stream3 = client.create_stream(&employer, &worker, &token, &50, &0u64, &0u64, &5u64);

    env.ledger().with_mut(|li| {
        li.timestamp = 10;
    });

    let stream_ids = soroban_sdk::vec![&env, stream1, stream2, stream3];
    let results = client.batch_withdraw(&stream_ids, &worker);

    assert_eq!(results.len(), 3);

    for i in 0..3 {
        let result = results.get(i).unwrap();
        assert!(result.success);
        assert!(result.amount > 0);
    }
}

#[test]
fn test_batch_withdraw_mixed_ownership() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker1 = Address::generate(&env);
    let worker2 = Address::generate(&env);
    let token = Address::generate(&env);

    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_vault(&vault_id);

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });

    let stream1 = client.create_stream(&employer, &worker1, &token, &100, &0u64, &0u64, &10u64);
    let stream2 = client.create_stream(&employer, &worker2, &token, &100, &0u64, &0u64, &10u64);
    let stream3 = client.create_stream(&employer, &worker1, &token, &100, &0u64, &0u64, &10u64);

    env.ledger().with_mut(|li| {
        li.timestamp = 5;
    });

    let stream_ids = soroban_sdk::vec![&env, stream1, stream2, stream3];
    let results = client.batch_withdraw(&stream_ids, &worker1);

    assert_eq!(results.len(), 3);

    let result0 = results.get(0).unwrap();
    assert!(result0.success);

    let result1 = results.get(1).unwrap();
    assert!(!result1.success);

    let result2 = results.get(2).unwrap();
    assert!(result2.success);
}

#[test]
fn test_batch_withdraw_nonexistent_stream() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_vault(&vault_id);

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });

    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &10u64);

    env.ledger().with_mut(|li| {
        li.timestamp = 5;
    });

    let stream_ids = soroban_sdk::vec![&env, stream_id, 999u64];
    let results = client.batch_withdraw(&stream_ids, &worker);

    assert_eq!(results.len(), 2);

    let result0 = results.get(0).unwrap();
    assert!(result0.success);

    let result1 = results.get(1).unwrap();
    assert!(!result1.success);
}

#[test]
fn test_batch_withdraw_closed_stream() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_vault(&vault_id);

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });

    let stream1 = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &10u64);
    let stream2 = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &10u64);

    client.cancel_stream(&stream1, &employer);

    env.ledger().with_mut(|li| {
        li.timestamp = 5;
    });

    let stream_ids = soroban_sdk::vec![&env, stream1, stream2];
    let results = client.batch_withdraw(&stream_ids, &worker);

    assert_eq!(results.len(), 2);

    let result0 = results.get(0).unwrap();
    assert!(!result0.success);

    let result1 = results.get(1).unwrap();
    assert!(result1.success);
}

#[test]
fn test_batch_withdraw_empty_list() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let worker = Address::generate(&env);

    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_vault(&vault_id);

    let stream_ids = soroban_sdk::Vec::new(&env);
    let results = client.batch_withdraw(&stream_ids, &worker);

    assert_eq!(results.len(), 0);
}

#[test]
fn test_batch_withdraw_completes_stream() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_vault(&vault_id);

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });

    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &10u64);

    env.ledger().with_mut(|li| {
        li.timestamp = 10;
    });

    let stream_ids = soroban_sdk::vec![&env, stream_id];
    let results = client.batch_withdraw(&stream_ids, &worker);

    assert_eq!(results.len(), 1);
    let result = results.get(0).unwrap();
    assert!(result.success);

    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::Completed);
}

#[test]
fn test_index_get_employer_streams() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_vault(&vault_id);

    env.ledger().with_mut(|li| { li.timestamp = 0; });

    let id1 = client.create_stream(&employer, &worker, &token, &10, &0u64, &0u64, &100u64);
    let id2 = client.create_stream(&employer, &worker, &token, &20, &0u64, &0u64, &200u64);

    let ids = client.get_employer_streams(&employer);
    assert_eq!(ids.len(), 2);
    assert_eq!(ids.get(0).unwrap(), id1);
    assert_eq!(ids.get(1).unwrap(), id2);
}

#[test]
fn test_index_get_worker_streams() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_vault(&vault_id);

    env.ledger().with_mut(|li| { li.timestamp = 0; });

    let id1 = client.create_stream(&employer, &worker, &token, &10, &0u64, &0u64, &100u64);
    let id2 = client.create_stream(&employer, &worker, &token, &20, &0u64, &0u64, &200u64);

    let ids = client.get_worker_streams(&worker);
    assert_eq!(ids.len(), 2);
    assert_eq!(ids.get(0).unwrap(), id1);
    assert_eq!(ids.get(1).unwrap(), id2);
}

#[test]
fn test_cliff_blocks_early_withdrawal() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_vault(&vault_id);

    env.ledger().with_mut(|li| { li.timestamp = 0; });

    let stream_id = client.create_stream(&employer, &worker, &token, &100, &5u64, &0u64, &10u64);

    env.ledger().with_mut(|li| { li.timestamp = 3; });
    let amount = client.withdraw(&stream_id, &worker);
    assert_eq!(amount, 0);

    env.ledger().with_mut(|li| { li.timestamp = 7; });
    let amount = client.withdraw(&stream_id, &worker);
    assert!(amount > 0);
}

#[test]
fn test_cleanup_removes_from_indexes() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_vault(&vault_id);
    client.set_retention_secs(&0u64);

    env.ledger().with_mut(|li| { li.timestamp = 0; });

    let id1 = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &10u64);
    let id2 = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &20u64);

    assert_eq!(client.get_employer_streams(&employer).len(), 2);
    assert_eq!(client.get_worker_streams(&worker).len(), 2);

    env.ledger().with_mut(|li| { li.timestamp = 10; });
    client.withdraw(&id1, &worker);

    client.cleanup_stream(&id1);

    let emp_ids = client.get_employer_streams(&employer);
    assert_eq!(emp_ids.len(), 1);
    assert_eq!(emp_ids.get(0).unwrap(), id2);

    let wrk_ids = client.get_worker_streams(&worker);
    assert_eq!(wrk_ids.len(), 1);
    assert_eq!(wrk_ids.get(0).unwrap(), id2);
}

#[test]
fn test_audit_fields_set_on_create() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_vault(&vault_id);

    env.ledger().with_mut(|li| { li.timestamp = 42; });

    let stream_id = client.create_stream(&employer, &worker, &token, &10, &0u64, &42u64, &142u64);
    let stream = client.get_stream(&stream_id).unwrap();

    assert_eq!(stream.created_at, 42);
    assert_eq!(stream.closed_at, 0);
    assert_eq!(stream.last_withdrawal_ts, 0);
    assert_eq!(stream.status, StreamStatus::Active);
}
