#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, vec, Address, Bytes, Env};
use quipay_common::QuipayError;

// Dummy PayrollStream contract for testing gateway integration
mod dummy_payroll_stream {
    use soroban_sdk::{contract, contractimpl, Address, Env, Vec};
    use quipay_common::QuipayError;

    #[contracttype]
    #[derive(Clone)]
    pub enum DataKey {
        Gateway,
        NextStreamId,
    }

    #[contract]
    pub struct DummyPayrollStream;

    #[contractimpl]
    impl DummyPayrollStream {
        pub fn init(env: Env) {
            env.storage().instance().set(&DataKey::NextStreamId, &1u64);
        }

        pub fn set_gateway(env: Env, gateway: Address) -> Result<(), QuipayError> {
            env.storage().instance().set(&DataKey::Gateway, &gateway);
            Ok(())
        }

        pub fn create_stream_via_gateway(
            env: Env,
            _employer: Address,
            _worker: Address,
            _token: Address,
            _rate: i128,
            _cliff_ts: u64,
            _start_ts: u64,
            _end_ts: u64,
        ) -> Result<u64, QuipayError> {
            // Verify caller is the authorized gateway
            let gateway: Address = env
                .storage()
                .instance()
                .get(&DataKey::Gateway)
                .ok_or(QuipayError::NotInitialized)?;
            gateway.require_auth();

            let mut next_id: u64 = env
                .storage()
                .instance()
                .get(&DataKey::NextStreamId)
                .unwrap_or(1u64);
            let stream_id = next_id;
            next_id += 1;
            env.storage()
                .instance()
                .set(&DataKey::NextStreamId, &next_id);

            Ok(stream_id)
        }

        pub fn cancel_stream_via_gateway(
            env: Env,
            _stream_id: u64,
            _employer: Address,
        ) -> Result<(), QuipayError> {
            // Verify caller is the authorized gateway
            let gateway: Address = env
                .storage()
                .instance()
                .get(&DataKey::Gateway)
                .ok_or(QuipayError::NotInitialized)?;
            gateway.require_auth();

            Ok(())
        }
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
    assert!(!client.is_authorized(&agent, &Permission::CreateStream));

    // 2. Register agent with specific permission
    client.register_agent(&agent, &vec![&env, Permission::CreateStream]);
    assert!(client.is_authorized(&agent, &Permission::CreateStream));
    assert!(!client.is_authorized(&agent, &Permission::RebalanceTreasury));

    // 3. Registering again overwrites permissions
    client.register_agent(&agent, &vec![&env, Permission::RebalanceTreasury]);
    assert!(!client.is_authorized(&agent, &Permission::CreateStream));
    assert!(client.is_authorized(&agent, &Permission::RebalanceTreasury));

    // 4. Revoke agent
    client.revoke_agent(&agent);
    assert!(!client.is_authorized(&agent, &Permission::RebalanceTreasury));
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
    client.register_agent(&agent, &vec![&env, Permission::CreateStream]);

    // Authorized call
    client.execute_automation(&agent, &Permission::CreateStream, &Bytes::new(&env));
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
    client.register_agent(&agent, &vec![&env, Permission::RebalanceTreasury]);

    // Unauthorized action
    let result = client.try_execute_automation(&agent, &Permission::CreateStream, &Bytes::new(&env));
    
    assert_eq!(
        result,
        Err(Ok(QuipayError::InsufficientPermissions))
    );
}

#[test]
fn test_agent_create_stream_authorized() {
fn test_admin_modify_permissions() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let agent = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    // Register PayrollStream contract
    let payroll_stream_id = env.register_contract(None, dummy_payroll_stream::DummyPayrollStream);
    let payroll_client = dummy_payroll_stream::DummyPayrollStreamClient::new(&env, &payroll_stream_id);
    payroll_client.init();

    // Register AutomationGateway
    let gateway_id = env.register(AutomationGateway, ());
    let gateway_client = AutomationGatewayClient::new(&env, &gateway_id);

    gateway_client.init(&admin);
    gateway_client.set_payroll_stream(&payroll_stream_id);
    payroll_client.set_gateway(&gateway_id);

    // Register agent with CreateStream permission
    gateway_client.register_agent(&agent, &vec![&env, Permission::CreateStream]);

    // Agent creates stream on behalf of employer
    let stream_id = gateway_client.agent_create_stream(
        &agent,
        &employer,
        &worker,
        &token,
        &100i128,
        &0u64,
        &10u64,
        &100u64,
    );

    assert_eq!(stream_id, 1u64);
}

#[test]
fn test_agent_create_stream_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let agent = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    // Register PayrollStream contract
    let payroll_stream_id = env.register_contract(None, dummy_payroll_stream::DummyPayrollStream);
    let payroll_client = dummy_payroll_stream::DummyPayrollStreamClient::new(&env, &payroll_stream_id);
    payroll_client.init();

    // Register AutomationGateway
    let gateway_id = env.register(AutomationGateway, ());
    let gateway_client = AutomationGatewayClient::new(&env, &gateway_id);

    gateway_client.init(&admin);
    gateway_client.set_payroll_stream(&payroll_stream_id);
    payroll_client.set_gateway(&gateway_id);

    // Register agent with ONLY CancelStream permission (not CreateStream)
    gateway_client.register_agent(&agent, &vec![&env, Permission::CancelStream]);

    // Agent tries to create stream but is unauthorized
    let result = gateway_client.try_agent_create_stream(
        &agent,
        &employer,
        &worker,
        &token,
        &100i128,
        &0u64,
        &10u64,
        &100u64,
    );

    assert_eq!(
        result,
        Err(Ok(QuipayError::InsufficientPermissions))
    );
}

#[test]
fn test_agent_cancel_stream_authorized() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let agent = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    // Register PayrollStream contract
    let payroll_stream_id = env.register_contract(None, dummy_payroll_stream::DummyPayrollStream);
    let payroll_client = dummy_payroll_stream::DummyPayrollStreamClient::new(&env, &payroll_stream_id);
    payroll_client.init();

    // Register AutomationGateway
    let gateway_id = env.register(AutomationGateway, ());
    let gateway_client = AutomationGatewayClient::new(&env, &gateway_id);

    gateway_client.init(&admin);
    gateway_client.set_payroll_stream(&payroll_stream_id);
    payroll_client.set_gateway(&gateway_id);

    // Register agent with both CreateStream and CancelStream permissions
    gateway_client.register_agent(&agent, &vec![&env, Permission::CreateStream, Permission::CancelStream]);

    // First, create a stream
    let stream_id = gateway_client.agent_create_stream(
        &agent,
        &employer,
        &worker,
        &token,
        &100i128,
        &0u64,
        &10u64,
        &100u64,
    );

    // Then cancel it
    gateway_client.agent_cancel_stream(&agent, &stream_id, &employer);
}

#[test]
fn test_agent_cancel_stream_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let agent = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    // Register PayrollStream contract
    let payroll_stream_id = env.register_contract(None, dummy_payroll_stream::DummyPayrollStream);
    let payroll_client = dummy_payroll_stream::DummyPayrollStreamClient::new(&env, &payroll_stream_id);
    payroll_client.init();

    // Register AutomationGateway
    let gateway_id = env.register(AutomationGateway, ());
    let gateway_client = AutomationGatewayClient::new(&env, &gateway_id);

    gateway_client.init(&admin);
    gateway_client.set_payroll_stream(&payroll_stream_id);
    payroll_client.set_gateway(&gateway_id);

    // Register agent with ONLY CreateStream permission (not CancelStream)
    gateway_client.register_agent(&agent, &vec![&env, Permission::CreateStream]);

    // First, create a stream
    let stream_id = gateway_client.agent_create_stream(
        &agent,
        &employer,
        &worker,
        &token,
        &100i128,
        &0u64,
        &10u64,
        &100u64,
    );

    // Agent tries to cancel stream but is unauthorized
    let result = gateway_client.try_agent_cancel_stream(&agent, &stream_id, &employer);

    assert_eq!(
        result,
        Err(Ok(QuipayError::InsufficientPermissions))
    );
}

#[test]
fn test_revoked_agent_blocked() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let agent = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    // Register PayrollStream contract
    let payroll_stream_id = env.register_contract(None, dummy_payroll_stream::DummyPayrollStream);
    let payroll_client = dummy_payroll_stream::DummyPayrollStreamClient::new(&env, &payroll_stream_id);
    payroll_client.init();

    // Register AutomationGateway
    let gateway_id = env.register(AutomationGateway, ());
    let gateway_client = AutomationGatewayClient::new(&env, &gateway_id);

    gateway_client.init(&admin);
    gateway_client.set_payroll_stream(&payroll_stream_id);
    payroll_client.set_gateway(&gateway_id);

    // Register agent with CreateStream permission
    gateway_client.register_agent(&agent, &vec![&env, Permission::CreateStream]);

    // Revoke the agent
    gateway_client.revoke_agent(&agent);

    // Revoked agent tries to create stream
    let result = gateway_client.try_agent_create_stream(
        &agent,
        &employer,
        &worker,
        &token,
        &100i128,
        &0u64,
        &10u64,
        &100u64,
    );

    assert_eq!(
        result,
        Err(Ok(QuipayError::InsufficientPermissions))
    );
}

#[test]
fn test_create_stream_permission_types() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let agent_create = Address::generate(&env);
    let agent_cancel = Address::generate(&env);
    let agent_both = Address::generate(&env);

    let gateway_id = env.register(AutomationGateway, ());
    let gateway_client = AutomationGatewayClient::new(&env, &gateway_id);

    gateway_client.init(&admin);

    // Register agents with different permissions
    gateway_client.register_agent(&agent_create, &vec![&env, Permission::CreateStream]);
    gateway_client.register_agent(&agent_cancel, &vec![&env, Permission::CancelStream]);
    gateway_client.register_agent(&agent_both, &vec![&env, Permission::CreateStream, Permission::CancelStream]);

    // Verify permissions
    assert!(gateway_client.is_authorized(&agent_create, &Permission::CreateStream));
    assert!(!gateway_client.is_authorized(&agent_create, &Permission::CancelStream));

    assert!(!gateway_client.is_authorized(&agent_cancel, &Permission::CreateStream));
    assert!(gateway_client.is_authorized(&agent_cancel, &Permission::CancelStream));

    assert!(gateway_client.is_authorized(&agent_both, &Permission::CreateStream));
    assert!(gateway_client.is_authorized(&agent_both, &Permission::CancelStream));

    let contract_id = env.register(AutomationGateway, ());
    let client = AutomationGatewayClient::new(&env, &contract_id);

    client.init(&admin);
    client.register_agent(&agent, &vec![&env, Permission::CreateStream]);

    client.grant_permission(&agent, &Permission::CancelStream);
    assert!(client.is_authorized(&agent, &Permission::CreateStream));
    assert!(client.is_authorized(&agent, &Permission::CancelStream));

    client.revoke_permission(&agent, &Permission::CreateStream);
    assert!(!client.is_authorized(&agent, &Permission::CreateStream));
    assert!(client.is_authorized(&agent, &Permission::CancelStream));

    client.set_agent_permissions(&agent, &vec![&env, Permission::RebalanceTreasury]);
    assert!(!client.is_authorized(&agent, &Permission::CancelStream));
    assert!(client.is_authorized(&agent, &Permission::RebalanceTreasury));
}
