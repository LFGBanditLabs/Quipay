#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger as _, Address, Env};

mod dummy_vault {
    use soroban_sdk::{contract, contractimpl, Address, Env};
    #[contract]
    pub struct DummyVault;
    #[contractimpl]
    impl DummyVault {
        pub fn check_solvency(_env: Env, _token: Address, _additional_liability: i128) -> bool {
            true
        }
        pub fn add_liability(_env: Env, _token: Address, _amount: i128) {}
        pub fn remove_liability(_env: Env, _token: Address, _amount: i128) {}
        pub fn payout_liability(_env: Env, _to: Address, _token: Address, _amount: i128) {}
    }
}

mod rejecting_vault {
    use soroban_sdk::{contract, contractimpl, Address, Env};
    #[contract]
    pub struct RejectingVault;
    #[contractimpl]
    impl RejectingVault {
        pub fn check_solvency(_env: Env, _token: Address, _additional_liability: i128) -> bool {
            true
        }
        pub fn add_liability(_env: Env, _token: Address, _amount: i128) {
            panic!("vault rejected liability");
        }
    }
}

/// Insolvent vault: check_solvency returns false so stream creation is blocked
mod insolvent_vault {
    use soroban_sdk::{contract, contractimpl, Address, Env};
    #[contract]
    pub struct InsolventVault;
    #[contractimpl]
    impl InsolventVault {
        pub fn check_solvency(_env: Env, _token: Address, _additional_liability: i128) -> bool {
            false
        }
        pub fn add_liability(_env: Env, _token: Address, _amount: i128) {}
        pub fn remove_liability(_env: Env, _token: Address, _amount: i128) {}
        pub fn payout_liability(_env: Env, _to: Address, _token: Address, _amount: i128) {}
    }
}

fn setup(env: &Env) -> (PayrollStreamClient, Address, Address, Address, Address) {
    let admin = Address::generate(env);
    let employer = Address::generate(env);
    let worker = Address::generate(env);
    let token = Address::generate(env);
    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(env, &contract_id);
    client.init(&admin);
    client.set_vault(&vault_id);
    (client, employer, worker, token, admin)
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
    let res = client.try_create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &10u64);
    assert!(res.is_err());
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

// ---------------------------------------------------------------------------
// Stream creation validation
// ---------------------------------------------------------------------------

#[test]
fn test_create_zero_rate_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let result = client.try_create_stream(&employer, &worker, &token, &0, &0u64, &0u64, &100u64);
    assert!(result.is_err());
}

#[test]
fn test_create_negative_rate_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let result = client.try_create_stream(&employer, &worker, &token, &-1, &0u64, &0u64, &100u64);
    assert!(result.is_err());
}

#[test]
fn test_create_end_equals_start_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let result = client.try_create_stream(&employer, &worker, &token, &100, &0u64, &50u64, &50u64);
    assert!(result.is_err());
}

#[test]
fn test_create_end_before_start_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let result = client.try_create_stream(&employer, &worker, &token, &100, &0u64, &50u64, &10u64);
    assert!(result.is_err());
}

#[test]
fn test_create_start_in_past_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 100; });
    let result = client.try_create_stream(&employer, &worker, &token, &100, &0u64, &50u64, &200u64);
    assert!(result.is_err());
}

#[test]
fn test_create_cliff_exceeds_end_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let result = client.try_create_stream(&employer, &worker, &token, &100, &200u64, &0u64, &100u64);
    assert!(result.is_err());
}

#[test]
fn test_create_sequential_ids() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let id1 = client.create_stream(&employer, &worker, &token, &10, &0u64, &0u64, &100u64);
    let id2 = client.create_stream(&employer, &worker, &token, &10, &0u64, &0u64, &100u64);
    let id3 = client.create_stream(&employer, &worker, &token, &10, &0u64, &0u64, &100u64);
    assert_eq!(id2, id1 + 1);
    assert_eq!(id3, id1 + 2);
}

#[test]
fn test_create_vault_rejection_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);
    let admin = Address::generate(&env);
    let vault_id = env.register_contract(None, rejecting_vault::RejectingVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);
    client.init(&admin);
    client.set_vault(&vault_id);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let result = client.try_create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &100u64);
    assert!(result.is_err());
}

#[test]
fn test_create_stream_blocked_when_treasury_insolvent() {
    let env = Env::default();
    env.mock_all_auths();
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);
    let admin = Address::generate(&env);
    let vault_id = env.register_contract(None, insolvent_vault::InsolventVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);
    client.init(&admin);
    client.set_vault(&vault_id);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let result = client.try_create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &100u64);
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// Withdrawal edge cases
// ---------------------------------------------------------------------------

#[test]
fn test_withdraw_before_stream_starts() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 100; });
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &200u64, &300u64);
    env.ledger().with_mut(|li| { li.timestamp = 150; });
    let amount = client.withdraw(&stream_id, &worker);
    assert_eq!(amount, 0);
}

#[test]
fn test_withdraw_at_midpoint_linear() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    // rate=100, duration=100, total=10000
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &100u64);
    env.ledger().with_mut(|li| { li.timestamp = 50; });
    let amount = client.withdraw(&stream_id, &worker);
    assert_eq!(amount, 5000);
}

#[test]
fn test_withdraw_after_end_returns_total() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    // rate=100, duration=10, total=1000
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &10u64);
    env.ledger().with_mut(|li| { li.timestamp = 50; });
    let amount = client.withdraw(&stream_id, &worker);
    assert_eq!(amount, 1000);
}

#[test]
fn test_withdraw_zero_available_returns_zero() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &100u64);
    env.ledger().with_mut(|li| { li.timestamp = 40; });
    client.withdraw(&stream_id, &worker);
    // same timestamp: nothing new has vested
    let second = client.withdraw(&stream_id, &worker);
    assert_eq!(second, 0);
}

#[test]
fn test_withdraw_sequential_accumulates_correctly() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    // rate=10, duration=100, total=1000
    let stream_id = client.create_stream(&employer, &worker, &token, &10, &0u64, &0u64, &100u64);
    env.ledger().with_mut(|li| { li.timestamp = 25; });
    let first = client.withdraw(&stream_id, &worker);
    assert_eq!(first, 250);
    env.ledger().with_mut(|li| { li.timestamp = 75; });
    let second = client.withdraw(&stream_id, &worker);
    assert_eq!(second, 500);
    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.withdrawn_amount, 750);
}

#[test]
fn test_withdraw_wrong_worker_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    let intruder = Address::generate(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &100u64);
    env.ledger().with_mut(|li| { li.timestamp = 50; });
    let result = client.try_withdraw(&stream_id, &intruder);
    assert!(result.is_err());
}

#[test]
fn test_withdraw_updates_last_withdrawal_ts() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &100u64);
    let before = client.get_stream(&stream_id).unwrap();
    assert_eq!(before.last_withdrawal_ts, 0);
    env.ledger().with_mut(|li| { li.timestamp = 42; });
    client.withdraw(&stream_id, &worker);
    let after = client.get_stream(&stream_id).unwrap();
    assert_eq!(after.last_withdrawal_ts, 42);
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

#[test]
fn test_cancel_wrong_employer_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    let intruder = Address::generate(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &100u64);
    let result = client.try_cancel_stream(&stream_id, &intruder);
    assert!(result.is_err());
}

#[test]
fn test_cancel_already_canceled_is_idempotent() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &100u64);
    client.cancel_stream(&stream_id, &employer);
    // second cancel must not panic
    client.cancel_stream(&stream_id, &employer);
    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::Canceled);
}

#[test]
fn test_cancel_sets_closed_at() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &100u64);
    env.ledger().with_mut(|li| { li.timestamp = 55; });
    client.cancel_stream(&stream_id, &employer);
    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::Canceled);
    assert_eq!(stream.closed_at, 55);
}

#[test]
fn test_cancel_completed_stream_is_idempotent() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &10u64);
    env.ledger().with_mut(|li| { li.timestamp = 10; });
    client.withdraw(&stream_id, &worker);
    // stream is now Completed; cancel should return early without panicking
    client.cancel_stream(&stream_id, &employer);
    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::Completed);
}

// ---------------------------------------------------------------------------
// Stream completion
// ---------------------------------------------------------------------------

#[test]
fn test_full_withdrawal_auto_completes_stream() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &10u64);
    env.ledger().with_mut(|li| { li.timestamp = 10; });
    let amount = client.withdraw(&stream_id, &worker);
    assert_eq!(amount, 1000);
    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::Completed);
    assert_eq!(stream.withdrawn_amount, stream.total_amount);
}

#[test]
fn test_completed_stream_blocks_further_withdrawal() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &10u64);
    env.ledger().with_mut(|li| { li.timestamp = 10; });
    client.withdraw(&stream_id, &worker);
    let result = client.try_withdraw(&stream_id, &worker);
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// Edge cases and boundaries
// ---------------------------------------------------------------------------

#[test]
fn test_minimum_one_second_stream() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    // rate=1, duration=1, total=1
    let stream_id = client.create_stream(&employer, &worker, &token, &1, &0u64, &0u64, &1u64);
    env.ledger().with_mut(|li| { li.timestamp = 1; });
    let amount = client.withdraw(&stream_id, &worker);
    assert_eq!(amount, 1);
    let stream = client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::Completed);
}

#[test]
fn test_init_twice_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);
    client.init(&admin);
    let result = client.try_init(&admin2);
    assert!(result.is_err());
}

#[test]
fn test_get_nonexistent_stream_returns_none() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.init(&admin);
    assert!(client.get_stream(&9999u64).is_none());
}

#[test]
fn test_cleanup_active_stream_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &100u64);
    let result = client.try_cleanup_stream(&stream_id);
    assert!(result.is_err());
}

#[test]
fn test_cleanup_before_retention_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    client.set_retention_secs(&100u64);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &10u64);
    env.ledger().with_mut(|li| { li.timestamp = 10; });
    client.cancel_stream(&stream_id, &employer);
    // closed_at=10, retention=100 → eligible at t=110
    // trying at t=50 must fail
    env.ledger().with_mut(|li| { li.timestamp = 50; });
    let result = client.try_cleanup_stream(&stream_id);
    assert!(result.is_err());
}

#[test]
fn test_empty_index_for_unknown_address() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _, _, _) = setup(&env);
    let stranger = Address::generate(&env);
    assert_eq!(client.get_employer_streams(&stranger).len(), 0);
    assert_eq!(client.get_worker_streams(&stranger).len(), 0);
}

// ---------------------------------------------------------------------------
// Accrual precision and cliff semantics
// ---------------------------------------------------------------------------

#[test]
fn test_accrual_exact_linear() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    // rate=1000, duration=1000, total=1_000_000
    let stream_id = client.create_stream(&employer, &worker, &token, &1000, &0u64, &0u64, &1000u64);

    env.ledger().with_mut(|li| { li.timestamp = 250; });
    let a = client.withdraw(&stream_id, &worker);
    assert_eq!(a, 250_000);

    env.ledger().with_mut(|li| { li.timestamp = 500; });
    let b = client.withdraw(&stream_id, &worker);
    assert_eq!(b, 250_000);

    env.ledger().with_mut(|li| { li.timestamp = 750; });
    let c = client.withdraw(&stream_id, &worker);
    assert_eq!(c, 250_000);

    env.ledger().with_mut(|li| { li.timestamp = 1000; });
    let d = client.withdraw(&stream_id, &worker);
    assert_eq!(d, 250_000);

    assert_eq!(a + b + c + d, 1_000_000);
}

#[test]
fn test_cliff_retroactive_accrual() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    // cliff=50, start=0, end=100, rate=10, total=1000
    // at t=60: vested = 1000 * 60 / 100 = 600 (retroactive from start_ts)
    let stream_id = client.create_stream(&employer, &worker, &token, &10, &50u64, &0u64, &100u64);

    env.ledger().with_mut(|li| { li.timestamp = 30; });
    let before_cliff = client.withdraw(&stream_id, &worker);
    assert_eq!(before_cliff, 0);

    env.ledger().with_mut(|li| { li.timestamp = 60; });
    let after_cliff = client.withdraw(&stream_id, &worker);
    assert_eq!(after_cliff, 600);
}

#[test]
fn test_cliff_at_end_blocks_until_maturity() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    // cliff == end: nothing vests until stream fully matures
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &100u64, &0u64, &100u64);

    env.ledger().with_mut(|li| { li.timestamp = 50; });
    let mid = client.withdraw(&stream_id, &worker);
    assert_eq!(mid, 0);

    env.ledger().with_mut(|li| { li.timestamp = 100; });
    let at_maturity = client.withdraw(&stream_id, &worker);
    assert_eq!(at_maturity, 10000);
}

// ---------------------------------------------------------------------------
// Concurrent streams
// ---------------------------------------------------------------------------

#[test]
fn test_multiple_streams_are_independent() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    let worker2 = Address::generate(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let s1 = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &100u64);
    let s2 = client.create_stream(&employer, &worker2, &token, &200, &0u64, &0u64, &100u64);
    client.cancel_stream(&s1, &employer);
    let stream1 = client.get_stream(&s1).unwrap();
    let stream2 = client.get_stream(&s2).unwrap();
    assert_eq!(stream1.status, StreamStatus::Canceled);
    assert_eq!(stream2.status, StreamStatus::Active);
}

#[test]
fn test_last_withdrawal_ts_tracked_per_stream() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, employer, worker, token, _) = setup(&env);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let s1 = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &100u64);
    let s2 = client.create_stream(&employer, &worker, &token, &100, &0u64, &0u64, &100u64);
    env.ledger().with_mut(|li| { li.timestamp = 10; });
    client.withdraw(&s1, &worker);
    env.ledger().with_mut(|li| { li.timestamp = 20; });
    client.withdraw(&s2, &worker);
    assert_eq!(client.get_stream(&s1).unwrap().last_withdrawal_ts, 10);
    assert_eq!(client.get_stream(&s2).unwrap().last_withdrawal_ts, 20);
}

#[test]
fn test_different_employers_have_independent_indexes() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let employer1 = Address::generate(&env);
    let employer2 = Address::generate(&env);
    let worker1 = Address::generate(&env);
    let worker2 = Address::generate(&env);
    let token = Address::generate(&env);
    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);
    client.init(&admin);
    client.set_vault(&vault_id);
    env.ledger().with_mut(|li| { li.timestamp = 0; });
    let id1 = client.create_stream(&employer1, &worker1, &token, &10, &0u64, &0u64, &100u64);
    let id2 = client.create_stream(&employer2, &worker2, &token, &10, &0u64, &0u64, &100u64);
    let emp1_ids = client.get_employer_streams(&employer1);
    let emp2_ids = client.get_employer_streams(&employer2);
    assert_eq!(emp1_ids.len(), 1);
    assert_eq!(emp1_ids.get(0).unwrap(), id1);
    assert_eq!(emp2_ids.len(), 1);
    assert_eq!(emp2_ids.get(0).unwrap(), id2);
    assert_eq!(client.get_worker_streams(&worker1).get(0).unwrap(), id1);
    assert_eq!(client.get_worker_streams(&worker2).get(0).unwrap(), id2);
}
