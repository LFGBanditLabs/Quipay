#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, String};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct WorkerProfile {
    pub wallet: Address,
    pub preferred_token: Address,
    pub metadata_hash: String,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Worker(Address),
}

#[contract]
pub struct WorkforceRegistryContract;

#[contractimpl]
impl WorkforceRegistryContract {
    /// Registers a new worker profile.
    /// 
    /// # Arguments
    /// * `e` - The environment.
    /// * `worker` - The address of the worker registering.
    /// * `preferred_token` - The address of the preferred payment token.
    /// * `metadata_hash` - A hash string pointing to metadata (e.g., IPFS/Arweave).
    pub fn register_worker(
        e: Env,
        worker: Address,
        preferred_token: Address,
        metadata_hash: String,
    ) {
        worker.require_auth();
        
        let key = DataKey::Worker(worker.clone());
        if e.storage().persistent().has(&key) {
            panic!("Worker already registered");
        }
        
        let profile = WorkerProfile {
            wallet: worker.clone(),
            preferred_token: preferred_token.clone(),
            metadata_hash: metadata_hash.clone(),
        };
        
        e.storage().persistent().set(&key, &profile);

        e.events().publish(
            (
                symbol_short!("registry"),
                symbol_short!("registered"),
                worker.clone(),
                preferred_token.clone(),
            ),
            (metadata_hash.clone()),
        );
    }

    /// Updates an existing worker profile.
    /// 
    /// # Arguments
    /// * `e` - The environment.
    /// * `worker` - The address of the worker updating their profile.
    /// * `preferred_token` - The new preferred payment token address.
    /// * `metadata_hash` - The new metadata hash string.
    pub fn update_worker(
        e: Env,
        worker: Address,
        preferred_token: Address,
        metadata_hash: String,
    ) {
        worker.require_auth();
        
        let key = DataKey::Worker(worker.clone());
        if !e.storage().persistent().has(&key) {
            panic!("Worker not registered");
        }
        
        let profile = WorkerProfile {
            wallet: worker.clone(),
            preferred_token: preferred_token.clone(),
            metadata_hash: metadata_hash.clone(),
        };
        
        e.storage().persistent().set(&key, &profile);

        e.events().publish(
            (
                symbol_short!("registry"),
                symbol_short!("updated"),
                worker.clone(),
                preferred_token.clone(),
            ),
            (metadata_hash),
        );
    }

    /// Retrieves a worker's profile.
    /// 
    /// # Arguments
    /// * `e` - The environment.
    /// * `worker` - The address of the worker to look up.
    /// 
    /// # Returns
    /// * `Option<WorkerProfile>` - The worker profile if found, None otherwise.
    pub fn get_worker(e: Env, worker: Address) -> Option<WorkerProfile> {
        let key = DataKey::Worker(worker);
        e.storage().persistent().get(&key)
    }

    /// Checks if a worker is registered.
    /// 
    /// # Arguments
    /// * `e` - The environment.
    /// * `worker` - The address of the worker to check.
    /// 
    /// # Returns
    /// * `bool` - True if registered, False otherwise.
    pub fn is_registered(e: Env, worker: Address) -> bool {
        let key = DataKey::Worker(worker);
        e.storage().persistent().has(&key)
    }
}

mod test;
