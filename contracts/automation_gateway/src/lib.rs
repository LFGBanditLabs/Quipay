#![no_std]
use soroban_sdk::{Address, Bytes, Env, Vec, contract, contractimpl, contracttype, symbol_short, Symbol};
use quipay_common::{QuipayError, require};

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
    pub fn init(env: Env, admin: Address) -> Result<(), QuipayError> {
        require!(
            !env.storage().instance().has(&DataKey::Admin),
            QuipayError::AlreadyInitialized
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    /// Register a new AI agent with specific permissions.
    /// Only the admin can call this.
    pub fn register_agent(env: Env, agent_address: Address, permissions: Vec<Permission>) -> Result<(), QuipayError> {
        let admin = Self::get_admin(env.clone())?;
        admin.require_auth();

        let agent = Agent {
            address: agent_address.clone(),
            permissions,
            registered_at: env.ledger().timestamp(),
        };

        env.storage()
            .instance()
            .set(&DataKey::Agent(agent_address), &agent);

        env.events().publish(
            (
                symbol_short!("gateway"),
                symbol_short!("agent_reg"),
                agent_address.clone(),
                symbol_short!("admin"),
            ),
            (permissions),
        );

        Ok(())
    }

    /// Revoke an AI agent's authorization.
    /// Only the admin can call this.
    pub fn revoke_agent(env: Env, agent_address: Address) -> Result<(), QuipayError> {
        let admin = Self::get_admin(env.clone())?;
        admin.require_auth();

        env.storage()
            .instance()
            .remove(&DataKey::Agent(agent_address));

        env.events().publish(
            (
                symbol_short!("gateway"),
                symbol_short!("agent_rev"),
                agent_address.clone(),
                symbol_short!("admin"),
            ),
            (),
        );

        Ok(())
    }

    /// Check if an agent is authorized to perform a specific action.
    pub fn is_authorized(env: Env, agent_address: Address, action: Permission) -> bool {
        let agent_data: Option<Agent> =
            env.storage().instance().get(&DataKey::Agent(agent_address));

        match agent_data {
            Some(agent) => agent.permissions.contains(action),
            None => false,
        }
    }

    /// Route an automated action.
    /// For now, this is a placeholder that verifies authorization.
    pub fn execute_automation(env: Env, agent: Address, action: Permission, _data: Bytes) -> Result<(), QuipayError> {
        agent.require_auth();

        require!(
            Self::is_authorized(env.clone(), agent, action),
            QuipayError::InsufficientPermissions
        );

        // TODO: Implement actual routing/integration with other contracts
        env.events().publish(
            (
                symbol_short!("gateway"),
                symbol_short!("executed"),
                agent.clone(),
                Symbol::new(&env, "action"),
            ),
            (_data),
        );

        Ok(())
    }

    // Helper to get admin
    pub fn get_admin(env: Env) -> Result<Address, QuipayError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)
    }
}

mod test;
