#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
}

#[contract]
pub struct PayrollStream;

#[contractimpl]
impl PayrollStream {
    /// Initialize the contract with an admin.
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
    }

    /// Set the paused status of the contract.
    /// Only the admin can call this.
    pub fn set_paused(env: Env, paused: bool) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &paused);
    }

    /// Check if the contract is paused.
    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    /// Create a new payroll stream.
    /// Fails if the contract is paused.
    pub fn create_stream(env: Env, _employer: Address, _worker: Address, _amount: i128) {
        Self::require_not_paused(&env);
        // TODO: Implement actual stream creation logic
    }

    /// Withdraw funds from a stream.
    /// Fails if the contract is paused.
    pub fn withdraw(env: Env, _worker: Address) {
        Self::require_not_paused(&env);
        // TODO: Implement actual withdrawal logic
    }

    /// Cancel a payroll stream.
    /// Fails if the contract is paused.
    pub fn cancel_stream(env: Env, _employer: Address, _worker: Address) {
        Self::require_not_paused(&env);
        // TODO: Implement actual cancellation logic
    }

    /// Internal helper to ensure the contract is not paused.
    fn require_not_paused(env: &Env) {
        if env.storage().instance().get(&DataKey::Paused).unwrap_or(false) {
            panic!("protocol is paused");
        }
    }
}

mod test;
