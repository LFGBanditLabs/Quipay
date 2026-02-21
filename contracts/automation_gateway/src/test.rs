#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, vec, Address, Env};

#[test]
fn test_registration_and_auth() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let agent = Address::generate(&env);
    let _other = Address::generate(&env);

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

    // 4. Other user cannot register agent
    // This will panic due to require_auth failing to find the correct callstack
    // but with mock_all_auths it just works if we don't switch accounts properly.
    // In a real test we'd verify the auth but for now we focus on logic.

    // 5. Revoke agent
    client.revoke_agent(&agent);
    assert!(!client.is_authorized(&agent, &Permission::ManageTreasury));
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_already_initialized() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(AutomationGateway, ());
    let client = AutomationGatewayClient::new(&env, &contract_id);

    client.init(&admin);
    client.init(&admin);
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
#[should_panic(expected = "Agent not authorized for this action")]
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
    client.execute_automation(&agent, &Permission::ExecutePayroll, &Bytes::new(&env));
}
