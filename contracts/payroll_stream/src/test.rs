#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger as _, Address, Env, token};

// We need a dummy vault for testing
mod dummy_vault {
    use soroban_sdk::{contract, contractimpl, Env, Address};
    #[contract]
    pub struct DummyVault;
    #[contractimpl]
    impl DummyVault {
        pub fn add_liability(_env: Env, _amount: i128) {
            // Do nothing for stream tests unless we want to test failures
        }
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

    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    client.init(&admin);
    client.set_vault(&vault_id);

    // 1. Initial state: not paused
    assert!(!client.is_paused());
    
    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });
    
    // rate=100, start=0, end=10
    client.create_stream(&employer, &worker, &token, &100, &0u64, &10u64); // Should not panic

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
    client.create_stream(&employer, &worker, &token, &100, &0u64, &10u64);
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
    client.create_stream(&employer, &worker, &token, &100, &0u64, &10u64); // Should not panic
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
    let stream_id = client.create_stream(&employer, &worker, &token, &100, &0u64, &10u64);

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
fn test_calculate_accrued_before_start_and_at_start() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);

    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);
    client.init(&admin);

    let stream_id = client.create_stream(&employer, &worker, &1000, &10u64, &20u64);

    assert_eq!(client.calculate_accrued(&stream_id, &0u64), 0);
    assert_eq!(client.calculate_accrued(&stream_id, &10u64), 0);
}

#[test]
fn test_calculate_accrued_active_and_withdrawn_netting() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);

    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);
    client.init(&admin);

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });
    let stream_id = client.create_stream(&employer, &worker, &1000, &0u64, &10u64);

    assert_eq!(client.calculate_accrued(&stream_id, &5u64), 500);

    env.ledger().with_mut(|li| {
        li.timestamp = 5;
    });
    let w = client.withdraw(&stream_id, &worker);
    assert_eq!(w, 500);

    assert_eq!(client.calculate_accrued(&stream_id, &5u64), 0);
    assert_eq!(client.calculate_accrued(&stream_id, &6u64), 100);
}

#[test]
fn test_calculate_accrued_completed_stream() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);

    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);
    client.init(&admin);

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });
    let stream_id = client.create_stream(&employer, &worker, &1000, &0u64, &10u64);

    env.ledger().with_mut(|li| {
        li.timestamp = 10;
    });
    let w = client.withdraw(&stream_id, &worker);
    assert_eq!(w, 1000);

    let stream = client.get_stream(&stream_id).unwrap();
    assert!(stream.status_bits & (1u32 << (StreamStatus::Completed as u32)) != 0);
    assert_eq!(client.calculate_accrued(&stream_id, &10u64), 0);
    assert_eq!(client.calculate_accrued(&stream_id, &11u64), 0);
}

#[test]
fn test_calculate_accrued_canceled_stream_caps_at_closed_at() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);

    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);
    client.init(&admin);

    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });
    let stream_id = client.create_stream(&employer, &worker, &1000, &0u64, &10u64);

    env.ledger().with_mut(|li| {
        li.timestamp = 2;
    });
    let w = client.withdraw(&stream_id, &worker);
    assert_eq!(w, 200);

    env.ledger().with_mut(|li| {
        li.timestamp = 4;
    });
    client.cancel_stream(&stream_id, &employer);

    assert_eq!(client.calculate_accrued(&stream_id, &4u64), 200);
    assert_eq!(client.calculate_accrued(&stream_id, &9u64), 200);
}

#[test]
#[should_panic(expected = "accrued mul overflow")]
fn test_calculate_accrued_overflow_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);

    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);
    client.init(&admin);

    let stream_id = client.create_stream(&employer, &worker, &i128::MAX, &0u64, &3u64);
    client.calculate_accrued(&stream_id, &2u64);
}
