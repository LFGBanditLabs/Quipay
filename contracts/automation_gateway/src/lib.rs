#![no_std]
use quipay_common::{QuipayError, require};
use soroban_sdk::{
    Address, Bytes, Env, IntoVal, Map, Symbol, Vec, contract, contractimpl, contracttype, symbol_short,
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
#[derive(Clone, Debug)]
pub struct RetryJob {
    pub job_id: u64,
    pub target_contract: Address,
    pub calldata: Bytes,
    pub attempt: u32,
    pub next_retry_at: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    PendingAdmin,
    Agent(Address),
    PayrollStream,
    RetryQueue,
    DeadLetterQueue,
    NextRetryJobId,
}

const BACKOFF_DELAYS: [u64; 3] = [30, 120, 600];
const MAX_RETRY_ATTEMPTS: u32 = 3;

#[contract]
pub struct AutomationGateway;

#[contractimpl]
impl AutomationGateway {
    /// Placeholder change: provides a minimal on-chain circuit-breaker.
    ///
    /// This is intentionally simple so the team can iterate on proper routing
    /// and safety controls later without changing the public surface too much.
    fn require_circuit_closed(env: &Env) -> Result<(), QuipayError> {
        let is_open: bool = env
            .storage()
            .instance()
            .get(&Symbol::new(env, "circuit_open"))
            .unwrap_or(false);
        require!(!is_open, QuipayError::CircuitOpen);
        Ok(())
    }

    /// Toggle the circuit breaker for downstream dispatch.
    /// Only the admin can call this.
    pub fn set_circuit_open(env: Env, open: bool) -> Result<(), QuipayError> {
        let admin = Self::get_admin(env.clone())?;
        admin.require_auth();

        env.storage()
            .instance()
            .set(&Symbol::new(&env, "circuit_open"), &open);
        env.events().publish(
            (symbol_short!("gateway"), Symbol::new(&env, "circuit")),
            open,
        );
        Ok(())
    }

    /// Initialize the contract with an admin (employer).
    pub fn init(env: Env, admin: Address) -> Result<(), QuipayError> {
        require!(
            !env.storage().instance().has(&DataKey::Admin),
            QuipayError::AlreadyInitialized
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "circuit_open"), &false);
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
            (
                symbol_short!("gateway"),
                symbol_short!("perm_set"),
                agent_address.clone(),
                symbol_short!("admin"),
            ),
            permissions,
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
            (
                symbol_short!("gateway"),
                symbol_short!("perm_add"),
                agent_address.clone(),
                symbol_short!("admin"),
            ),
            permission,
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
            (
                symbol_short!("gateway"),
                symbol_short!("perm_rev"),
                agent_address.clone(),
                symbol_short!("admin"),
            ),
            permission,
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
            (
                symbol_short!("gateway"),
                symbol_short!("agent_reg"),
                agent_address.clone(),
                symbol_short!("admin"),
            ),
            permissions,
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

    /// Route an automated action to the appropriate Quipay contract.
    ///
    /// Phase 2 implementation: cross-contract dispatch to PayrollStream /
    /// PayrollVault based on the `action` variant and decoded `_data` payload.
    /// Authorization and event emission are complete; routing logic is pending.
    pub fn execute_automation(
        env: Env,
        agent: Address,
        action: Permission,
        _data: Bytes,
    ) -> Result<(), QuipayError> {
        agent.require_auth();
        Self::require_circuit_closed(&env)?;

        require!(
            Self::is_authorized(env.clone(), agent.clone(), action),
            QuipayError::InsufficientPermissions
        );

        // Phase 2: dispatch action to target contract via cross-contract call
        env.events().publish(
            (
                symbol_short!("gateway"),
                symbol_short!("executed"),
                agent.clone(),
                Symbol::new(&env, "action"),
            ),
            _data,
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

    /// Get the pending admin address (if any)
    pub fn get_pending_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::PendingAdmin)
    }

    /// Propose a new admin (step 1 of two-step transfer)
    pub fn propose_admin(env: Env, new_admin: Address) -> Result<(), QuipayError> {
        let admin = Self::get_admin(env.clone())?;
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::PendingAdmin, &new_admin);
        Ok(())
    }

    /// Accept admin role (step 2 of two-step transfer)
    pub fn accept_admin(env: Env) -> Result<(), QuipayError> {
        let pending_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::PendingAdmin)
            .ok_or(QuipayError::NoPendingAdmin)?;

        pending_admin.require_auth();

        // Transfer admin rights
        env.storage()
            .instance()
            .set(&DataKey::Admin, &pending_admin);
        // Clear pending admin
        env.storage().instance().remove(&DataKey::PendingAdmin);

        Ok(())
    }

    /// Transfer admin rights to a new address (backward compatible - atomic version)
    pub fn transfer_admin(env: Env, new_admin: Address) -> Result<(), QuipayError> {
        let admin = Self::get_admin(env.clone())?;
        admin.require_auth();

        // Atomic two-step: propose and accept
        env.storage()
            .instance()
            .set(&DataKey::PendingAdmin, &new_admin);

        // Simulate accept by new admin (backward compatibility)
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        env.storage().instance().remove(&DataKey::PendingAdmin);

        Ok(())
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
    pub fn agent_create_stream(
        env: Env,
        agent: Address,
        employer: Address,
        worker: Address,
        token: Address,
        rate: i128,
        cliff_ts: u64,
        start_ts: u64,
        end_ts: u64,
    ) -> Result<u64, QuipayError> {
        agent.require_auth();
        Self::require_circuit_closed(&env)?;

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
                employer.into_val(&env),
                worker.clone().into_val(&env),
                token.into_val(&env),
                rate.into_val(&env),
                cliff_ts.into_val(&env),
                start_ts.into_val(&env),
                end_ts.into_val(&env),
            ],
        );

        env.events().publish(
            (
                symbol_short!("gateway"),
                Symbol::new(&env, "stream_created"),
                agent.clone(),
                employer.clone(),
            ),
            (stream_id, worker, rate, start_ts, end_ts),
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
        Self::require_circuit_closed(&env)?;

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
            (
                symbol_short!("gateway"),
                Symbol::new(&env, "stream_canceled"),
                agent.clone(),
                employer.clone(),
            ),
            (stream_id,),
        );

        Ok(())
    }

    /// Push a failed job to the retry queue
    pub fn push_to_retry_queue(
        env: Env,
        target_contract: Address,
        calldata: Bytes,
    ) -> Result<u64, QuipayError> {
        let next_job_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextRetryJobId)
            .unwrap_or(1u64);

        let job = RetryJob {
            job_id: next_job_id,
            target_contract: target_contract.clone(),
            calldata: calldata.clone(),
            attempt: 1,
            next_retry_at: env.ledger().timestamp() + BACKOFF_DELAYS[0],
        };

        let mut queue: Vec<RetryJob> = env
            .storage()
            .instance()
            .get(&DataKey::RetryQueue)
            .unwrap_or_else(|| Vec::new(&env));
        queue.push_back(job);
        env.storage()
            .instance()
            .set(&DataKey::RetryQueue, &queue);
        env.storage()
            .instance()
            .set(&DataKey::NextRetryJobId, &(next_job_id + 1));

        env.events().publish(
            (symbol_short!("gateway"), symbol_short!("retry_q")),
            (next_job_id, target_contract),
        );

        Ok(next_job_id)
    }

    /// Process eligible jobs in the retry queue
    pub fn process_retry_queue(env: Env, caller: Address) -> Result<u32, QuipayError> {
        caller.require_auth();

        let queue: Vec<RetryJob> = env
            .storage()
            .instance()
            .get(&DataKey::RetryQueue)
            .unwrap_or_else(|| Vec::new(&env));

        let current_time = env.ledger().timestamp();
        let mut processed: u32 = 0;
        let mut remaining: Vec<RetryJob> = Vec::new(&env);
        let mut i = 0u32;

        while i < queue.len() {
            if let Some(mut job) = queue.get(i) {
                if job.next_retry_at <= current_time {
                    if job.attempt >= MAX_RETRY_ATTEMPTS {
                        let mut dlq: Vec<RetryJob> = env
                            .storage()
                            .instance()
                            .get(&DataKey::DeadLetterQueue)
                            .unwrap_or_else(|| Vec::new(&env));
                        dlq.push_back(job.clone());
                        env.storage()
                            .instance()
                            .set(&DataKey::DeadLetterQueue, &dlq);

                        env.events().publish(
                            (symbol_short!("gateway"), symbol_short!("job_dead")),
                            job.job_id,
                        );
                    } else {
                        let job_id = job.job_id;
                        let next_attempt = job.attempt + 1;
                        job.next_retry_at = current_time + BACKOFF_DELAYS[next_attempt as usize - 1];
                        remaining.push_back(job);

                        env.events().publish(
                            (symbol_short!("gateway"), symbol_short!("retry_atm")),
                            (job_id, next_attempt),
                        );
                    }
                    processed += 1;
                } else {
                    remaining.push_back(job);
                }
            }
            i += 1;
        }

        env.storage()
            .instance()
            .set(&DataKey::RetryQueue, &remaining);

        Ok(processed)
    }

    /// Get jobs in the dead letter queue
    pub fn get_dead_letter_queue(env: Env) -> Vec<RetryJob> {
        env.storage()
            .instance()
            .get(&DataKey::DeadLetterQueue)
            .unwrap_or_else(|| Vec::new(&env))
    }
}
