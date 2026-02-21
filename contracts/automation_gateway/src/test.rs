#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, vec, Address, Env, Bytes};
use quipay_common::QuipayError;

mod dummy_vault {
    use soroban_sdk::{contract, contractimpl, Address, Env};
    #[contract]
    pub struct DummyVault;
    #[contractimpl]
    impl DummyVault {
        pub fn add_liability(_env: Env, _token: Address, _amount: i128) {}
    }
}

#[test]
fn test_registration_and_auth() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let agent = Address::generate(&env);

    let contract_id = env.register(AutomationGateway, ());
    let client = AutomationGatewayClient::new(&env, &contract_id);

    client.init(&admin);

    // 1. Initial state: not authorized
    assert!(!client.is_authorized(&agent, &Permission::ExecutePayroll));

    // 2. Register agent with specific permission
    client.register_agent(&agent, &vec![&env, Permission::ExecutePayroll]);
    assert!(client.is_authorized(&agent, &Permission::ExecutePayroll));
    assert!(!client.is_authorized(&agent, &Permission::ManageTreasury));

    // 3. Registering again overwrites permissions
    client.register_agent(&agent, &vec![&env, Permission::ManageTreasury]);
    assert!(!client.is_authorized(&agent, &Permission::ExecutePayroll));
    assert!(client.is_authorized(&agent, &Permission::ManageTreasury));

    // 4. Revoke agent
    client.revoke_agent(&agent);
    assert!(!client.is_authorized(&agent, &Permission::ManageTreasury));
}

#[test]
fn test_already_initialized() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(AutomationGateway, ());
    let client = AutomationGatewayClient::new(&env, &contract_id);

    client.init(&admin);
    let result = client.try_init(&admin);
    
    assert_eq!(
        result,
        Err(Ok(QuipayError::AlreadyInitialized))
    );
}

#[test]
fn test_execute_automation_auth() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let agent = Address::generate(&env);

    let contract_id = env.register(AutomationGateway, ());
    let client = AutomationGatewayClient::new(&env, &contract_id);

    client.init(&admin);
    client.register_agent(&agent, &vec![&env, Permission::ExecutePayroll]);

    // Authorized call
    client.execute_automation(&agent, &Permission::ExecutePayroll, &Bytes::new(&env));
}

#[test]
fn test_execute_automation_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let agent = Address::generate(&env);

    let contract_id = env.register(AutomationGateway, ());
    let client = AutomationGatewayClient::new(&env, &contract_id);

    client.init(&admin);
    client.register_agent(&agent, &vec![&env, Permission::ManageTreasury]);

    // Unauthorized action
    let result = client.try_execute_automation(&agent, &Permission::ExecutePayroll, &Bytes::new(&env));
    
    assert_eq!(
        result,
        Err(Ok(QuipayError::InsufficientPermissions))
    );
}

// Integration tests for PayrollStream

#[test]
fn test_agent_can_create_stream_via_gateway() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);
    let agent = Address::generate(&env);

    // Setup AutomationGateway
    let gateway_id = env.register(AutomationGateway, ());
    let gateway_client = AutomationGatewayClient::new(&env, &gateway_id);
    gateway_client.init(&admin);
    gateway_client.register_agent(&agent, &vec![&env, Permission::ExecutePayroll]);

    // Setup PayrollStream
    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let payroll_id = env.register_contract(None, payroll_stream::PayrollStream);
    let payroll_client = payroll_stream::PayrollStreamClient::new(&env, &payroll_id);
    payroll_client.init(&admin);
    payroll_client.set_vault(&vault_id);
    payroll_client.set_gateway(&gateway_id).unwrap();

    // Set timestamp for stream creation
    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });

    // Agent creates stream via gateway
    let stream_id = gateway_client.create_stream(
        &agent,
        &payroll_id,
        &employer,
        &worker,
        &token,
        &100i128,
        &0u64,
        &0u64,
        &10u64,
    );

    assert_eq!(stream_id, 1u64);

    // Verify stream was created
    let stream = payroll_client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.employer, employer);
    assert_eq!(stream.worker, worker);
    assert_eq!(stream.rate, 100i128);
}

#[test]
fn test_agent_can_cancel_stream_via_gateway() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);
    let agent = Address::generate(&env);

    // Setup AutomationGateway
    let gateway_id = env.register(AutomationGateway, ());
    let gateway_client = AutomationGatewayClient::new(&env, &gateway_id);
    gateway_client.init(&admin);
    gateway_client.register_agent(&agent, &vec![&env, Permission::ExecutePayroll]);

    // Setup PayrollStream
    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let payroll_id = env.register_contract(None, payroll_stream::PayrollStream);
    let payroll_client = payroll_stream::PayrollStreamClient::new(&env, &payroll_id);
    payroll_client.init(&admin);
    payroll_client.set_vault(&vault_id);
    payroll_client.set_gateway(&gateway_id).unwrap();

    // Set timestamp for stream creation
    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });

    // Agent creates stream via gateway
    let stream_id = gateway_client.create_stream(
        &agent,
        &payroll_id,
        &employer,
        &worker,
        &token,
        &100i128,
        &0u64,
        &0u64,
        &10u64,
    );

    // Agent cancels stream via gateway
    gateway_client.cancel_stream(&agent, &payroll_id, &stream_id, &employer);

    // Verify stream was cancelled
    let stream = payroll_client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, payroll_stream::StreamStatus::Canceled);
}

#[test]
fn test_unauthorized_agent_blocked_from_creating_stream() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);
    let agent = Address::generate(&env);
    let unauthorized_agent = Address::generate(&env);

    // Setup AutomationGateway
    let gateway_id = env.register(AutomationGateway, ());
    let gateway_client = AutomationGatewayClient::new(&env, &gateway_id);
    gateway_client.init(&admin);
    // Only register agent, not unauthorized_agent
    gateway_client.register_agent(&agent, &vec![&env, Permission::ExecutePayroll]);

    // Setup PayrollStream
    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let payroll_id = env.register_contract(None, payroll_stream::PayrollStream);
    let payroll_client = payroll_stream::PayrollStreamClient::new(&env, &payroll_id);
    payroll_client.init(&admin);
    payroll_client.set_vault(&vault_id);
    payroll_client.set_gateway(&gateway_id).unwrap();

    // Set timestamp for stream creation
    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });

    // Unauthorized agent tries to create stream via gateway
    let result = gateway_client.try_create_stream(
        &unauthorized_agent,
        &payroll_id,
        &employer,
        &worker,
        &token,
        &100i128,
        &0u64,
        &0u64,
        &10u64,
    );

    assert_eq!(result, Err(Ok(QuipayError::InsufficientPermissions)));
}

#[test]
fn test_unauthorized_agent_blocked_from_canceling_stream() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);
    let agent = Address::generate(&env);
    let unauthorized_agent = Address::generate(&env);

    // Setup AutomationGateway
    let gateway_id = env.register(AutomationGateway, ());
    let gateway_client = AutomationGatewayClient::new(&env, &gateway_id);
    gateway_client.init(&admin);
    gateway_client.register_agent(&agent, &vec![&env, Permission::ExecutePayroll]);

    // Setup PayrollStream
    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let payroll_id = env.register_contract(None, payroll_stream::PayrollStream);
    let payroll_client = payroll_stream::PayrollStreamClient::new(&env, &payroll_id);
    payroll_client.init(&admin);
    payroll_client.set_vault(&vault_id);
    payroll_client.set_gateway(&gateway_id).unwrap();

    // Set timestamp for stream creation
    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });

    // Authorized agent creates stream
    let stream_id = gateway_client.create_stream(
        &agent,
        &payroll_id,
        &employer,
        &worker,
        &token,
        &100i128,
        &0u64,
        &0u64,
        &10u64,
    );

    // Unauthorized agent tries to cancel stream
    let result = gateway_client.try_cancel_stream(&unauthorized_agent, &payroll_id, &stream_id, &employer);

    assert_eq!(result, Err(Ok(QuipayError::InsufficientPermissions)));
}

#[test]
fn test_agent_with_wrong_permission_blocked() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);
    let agent = Address::generate(&env);

    // Setup AutomationGateway - register agent with wrong permission
    let gateway_id = env.register(AutomationGateway, ());
    let gateway_client = AutomationGatewayClient::new(&env, &gateway_id);
    gateway_client.init(&admin);
    gateway_client.register_agent(&agent, &vec![&env, Permission::ManageTreasury]); // Wrong permission

    // Setup PayrollStream
    let vault_id = env.register_contract(None, dummy_vault::DummyVault);
    let payroll_id = env.register_contract(None, payroll_stream::PayrollStream);
    let payroll_client = payroll_stream::PayrollStreamClient::new(&env, &payroll_id);
    payroll_client.init(&admin);
    payroll_client.set_vault(&vault_id);
    payroll_client.set_gateway(&gateway_id).unwrap();

    // Set timestamp for stream creation
    env.ledger().with_mut(|li| {
        li.timestamp = 0;
    });

    // Agent with wrong permission tries to create stream
    let result = gateway_client.try_create_stream(
        &agent,
        &payroll_id,
        &employer,
        &worker,
        &token,
        &100i128,
        &0u64,
        &0u64,
        &10u64,
    );

    assert_eq!(result, Err(Ok(QuipayError::InsufficientPermissions)));
}
