#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, vec, Address, Bytes, Env, Vec};

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Permission {
    ExecutePayroll = 1,
    ManageTreasury = 2,
    RegisterAgent = 3,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Agent {
    pub address: Address,
    pub permissions: Vec<Permission>,
    pub registered_at: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Agent(Address),
}

#[contract]
pub struct AutomationGateway;

#[contractimpl]
impl AutomationGateway {
    /// Initialize the contract with an admin (employer).
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Register a new AI agent with specific permissions.
    /// Only the admin can call this.
    pub fn register_agent(env: Env, agent_address: Address, permissions: Vec<Permission>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Not initialized");
        admin.require_auth();

        let agent = Agent {
            address: agent_address.clone(),
            permissions,
            registered_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&DataKey::Agent(agent_address), &agent);
    }

    /// Revoke an AI agent's authorization.
    /// Only the admin can call this.
    pub fn revoke_agent(env: Env, agent_address: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Not initialized");
        admin.require_auth();

        env.storage().instance().remove(&DataKey::Agent(agent_address));
    }

    /// Check if an agent is authorized to perform a specific action.
    pub fn is_authorized(env: Env, agent_address: Address, action: Permission) -> bool {
        let agent_data: Option<Agent> = env.storage().instance().get(&DataKey::Agent(agent_address));
        
        match agent_data {
            Some(agent) => agent.permissions.contains(action),
            None => false,
        }
    }

    /// Route an automated action.
    /// For now, this is a placeholder that verifies authorization.
    pub fn execute_automation(env: Env, agent: Address, action: Permission, _data: Bytes) {
        agent.require_auth();

        if !Self::is_authorized(env.clone(), agent, action) {
            panic!("Agent not authorized for this action");
        }

        // TODO: Implement actual routing/integration with other contracts
    }

    // Helper to get admin
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).expect("Not initialized")
    }
}

mod test;
