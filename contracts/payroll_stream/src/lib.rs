#![no_std]
use soroban_sdk::{Address, Env, contract, contractimpl, contracttype};
use quipay_common::{QuipayError, require};

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
    pub fn init(env: Env, admin: Address) -> Result<(), QuipayError> {
        require!(
            !env.storage().instance().has(&DataKey::Admin),
            QuipayError::AlreadyInitialized
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        Ok(())
    }

    /// Set the paused status of the contract.
    /// Only the admin can call this.
    pub fn set_paused(env: Env, paused: bool) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &paused);
        Ok(())
    }

    /// Check if the contract is paused.
    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    /// Create a new payroll stream.
    /// Fails if the contract is paused.
    pub fn create_stream(env: Env, _employer: Address, _worker: Address, _amount: i128) -> Result<(), QuipayError> {
        Self::require_not_paused(&env)?;
        // TODO: Implement actual stream creation logic
        Ok(())
    }

    /// Withdraw funds from a stream.
    /// Fails if the contract is paused.
    pub fn withdraw(env: Env, _worker: Address) -> Result<(), QuipayError> {
        Self::require_not_paused(&env)?;
        // TODO: Implement actual withdrawal logic
        Ok(())
    }

    /// Cancel a payroll stream.
    /// Fails if the contract is paused.
    pub fn cancel_stream(env: Env, _employer: Address, _worker: Address) -> Result<(), QuipayError> {
        Self::require_not_paused(&env)?;
        // TODO: Implement actual cancellation logic
        Ok(())
    }

    /// Internal helper to ensure the contract is not paused.
    fn require_not_paused(env: &Env) -> Result<(), QuipayError> {
        if env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
        {
            return Err(QuipayError::ProtocolPaused);
        }
        Ok(())
    }
}

mod test;
