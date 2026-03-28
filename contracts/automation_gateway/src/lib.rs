#![no_std]
#![allow(clippy::too_many_arguments)]
use quipay_common::{QuipayError, require};
use soroban_sdk::{
    Address, Bytes, Env, IntoVal, Symbol, Vec, contract, contractimpl, contracttype, symbol_short,
    vec,
};

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Permission {
    ExecutePayroll = 1,
    ManageTreasury = 2,
    RegisterAgent = 3,
    CreateStream = 4,
    CancelStream = 5,
    RebalanceTreasury = 6,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Agent {
    pub address: Address,
    pub permissions: Vec<Permission>,
    pub registered_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct StreamCreateParams {
    pub employer: Address,
    pub worker: Address,
    pub token: Address,
    pub rate: i128,
    pub cliff_ts: u64,
    pub start_ts: u64,
    pub end_ts: u64,
}

#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub enum AutomationEvent {
    PermSet(Address),
    PermAdd(Address, Permission),
    PermRev(Address, Permission),
    AgentReg(Address),
    AgentRev(Address),
    Executed(Address, Symbol),
    StreamCreated(Address, Address, u64),
    StreamCanceled(Address, Address, u64),
}


#[contracttype]
pub enum DataKey {
    Admin,
    Agent(Address),
    PayrollStream,
}

#[contract]
pub struct AutomationGateway;

#[contractimpl]
#[allow(clippy::too_many_arguments)]
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

    /// Replace an agent's permissions.
    /// Only the admin can call this.
    pub fn set_agent_permissions(
        env: Env,
        agent_address: Address,
        permissions: Vec<Permission>,
    ) -> Result<(), QuipayError> {
        let admin = Self::get_admin(env.clone())?;
        admin.require_auth();

        let mut agent: Agent = env
            .storage()
            .instance()
            .get(&DataKey::Agent(agent_address.clone()))
            .ok_or(QuipayError::AgentNotFound)?;

        agent.permissions = permissions.clone();
        env.storage()
            .instance()
            .set(&DataKey::Agent(agent_address.clone()), &agent);

        env.events().publish(
            (symbol_short!("gateway"), symbol_short!("p_set")),
            AutomationEvent::PermSet(agent_address),
        );


        Ok(())
    }

    /// Grant a single permission to an agent.
    /// Only the admin can call this.
    pub fn grant_permission(
        env: Env,
        agent_address: Address,
        permission: Permission,
    ) -> Result<(), QuipayError> {
        let admin = Self::get_admin(env.clone())?;
        admin.require_auth();

        let mut agent: Agent = env
            .storage()
            .instance()
            .get(&DataKey::Agent(agent_address.clone()))
            .ok_or(QuipayError::AgentNotFound)?;

        if !agent.permissions.contains(permission) {
            agent.permissions.push_back(permission);
            env.storage()
                .instance()
                .set(&DataKey::Agent(agent_address.clone()), &agent);
        }

        env.events().publish(
            (symbol_short!("gateway"), symbol_short!("p_add")),
            AutomationEvent::PermAdd(agent_address, permission),
        );


        Ok(())
    }

    /// Revoke a single permission from an agent.
    /// Only the admin can call this.
    pub fn revoke_permission(
        env: Env,
        agent_address: Address,
        permission: Permission,
    ) -> Result<(), QuipayError> {
        let admin = Self::get_admin(env.clone())?;
        admin.require_auth();

        let mut agent: Agent = env
            .storage()
            .instance()
            .get(&DataKey::Agent(agent_address.clone()))
            .ok_or(QuipayError::AgentNotFound)?;

        let mut new_perms: Vec<Permission> = Vec::new(&env);
        let mut i = 0u32;
        while i < agent.permissions.len() {
            let p = agent.permissions.get(i).unwrap();
            if p != permission {
                new_perms.push_back(p);
            }
            i += 1;
        }
        agent.permissions = new_perms;
        env.storage()
            .instance()
            .set(&DataKey::Agent(agent_address.clone()), &agent);

        env.events().publish(
            (symbol_short!("gateway"), symbol_short!("p_rev")),
            AutomationEvent::PermRev(agent_address, permission),
        );


        Ok(())
    }

    /// Register a new AI agent with specific permissions.
    /// Only the admin can call this.
    pub fn register_agent(
        env: Env,
        agent_address: Address,
        permissions: Vec<Permission>,
    ) -> Result<(), QuipayError> {
        let admin = Self::get_admin(env.clone())?;
        admin.require_auth();

        let agent = Agent {
            address: agent_address.clone(),
            permissions: permissions.clone(),
            registered_at: env.ledger().timestamp(),
        };

        env.storage()
            .instance()
            .set(&DataKey::Agent(agent_address.clone()), &agent);

        env.events().publish(
            (symbol_short!("gateway"), symbol_short!("a_reg")),
            AutomationEvent::AgentReg(agent_address),
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
            .remove(&DataKey::Agent(agent_address.clone()));

        env.events().publish(
            (symbol_short!("gateway"), symbol_short!("a_rev")),
            AutomationEvent::AgentRev(agent_address),
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
    pub fn execute_automation(
        env: Env,
        agent: Address,
        action: Permission,
        _data: Bytes,
    ) -> Result<(), QuipayError> {
        agent.require_auth();

        require!(
            Self::is_authorized(env.clone(), agent.clone(), action),
            QuipayError::InsufficientPermissions
        );

        // TODO: Implement actual routing/integration with other contracts
        env.events().publish(
            (symbol_short!("gateway"), symbol_short!("exec")),
            AutomationEvent::Executed(agent, Symbol::new(&env, "action")), // Symbol is used now
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

    /// Set the PayrollStream contract address.
    /// Only the admin can call this.
    pub fn set_payroll_stream(env: Env, payroll_stream: Address) -> Result<(), QuipayError> {
        let admin = Self::get_admin(env.clone())?;
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::PayrollStream, &payroll_stream);
        Ok(())
    }

    /// Get the PayrollStream contract address.
    pub fn get_payroll_stream(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::PayrollStream)
    }

    /// Create a stream on behalf of an employer through an authorized agent.
    /// The agent must have CreateStream permission.
    #[allow(clippy::too_many_arguments)]
    pub fn agent_create_stream(
        env: Env,
        agent: Address,
        params: StreamCreateParams,
    ) -> Result<u64, QuipayError> {

        agent.require_auth();

        require!(
            Self::is_authorized(env.clone(), agent.clone(), Permission::CreateStream),
            QuipayError::InsufficientPermissions
        );

        let payroll_stream =
            Self::get_payroll_stream(env.clone()).ok_or(QuipayError::NotInitialized)?;

        // Invoke create_stream_via_gateway on PayrollStream contract
        let stream_id: u64 = env.invoke_contract(
            &payroll_stream,
            &Symbol::new(&env, "create_stream_via_gateway"),
            vec![
                &env,
                params.employer.clone().into_val(&env),
                params.worker.clone().into_val(&env),
                params.token.into_val(&env),
                params.rate.into_val(&env),
                params.cliff_ts.into_val(&env),
                params.start_ts.into_val(&env),
                params.end_ts.into_val(&env),
            ],
        );


        env.events().publish(
            (symbol_short!("gateway"), symbol_short!("s_cr")),
            AutomationEvent::StreamCreated(agent, params.employer, stream_id),
        );


        Ok(stream_id)
    }

    /// Cancel a stream on behalf of an employer through an authorized agent.
    /// The agent must have CancelStream permission.
    pub fn agent_cancel_stream(
        env: Env,
        agent: Address,
        stream_id: u64,
        employer: Address,
    ) -> Result<(), QuipayError> {
        agent.require_auth();

        require!(
            Self::is_authorized(env.clone(), agent.clone(), Permission::CancelStream),
            QuipayError::InsufficientPermissions
        );

        let payroll_stream =
            Self::get_payroll_stream(env.clone()).ok_or(QuipayError::NotInitialized)?;

        // Invoke cancel_stream_via_gateway on PayrollStream contract
        env.invoke_contract::<()>(
            &payroll_stream,
            &Symbol::new(&env, "cancel_stream_via_gateway"),
            vec![&env, stream_id.into_val(&env), employer.into_val(&env)],
        );

        env.events().publish(
            (symbol_short!("gateway"), symbol_short!("s_can")),
            AutomationEvent::StreamCanceled(agent, employer.clone(), stream_id),
        );


        Ok(())
    }
}

mod test;
