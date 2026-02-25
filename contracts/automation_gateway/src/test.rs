#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, vec, Address, Env};
use quipay_common::QuipayError;

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
fn test_admin_modify_permissions() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let agent = Address::generate(&env);

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
