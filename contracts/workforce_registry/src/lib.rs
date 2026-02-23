#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol, Vec,
};

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
    EmployerActiveWorkerCount(Address),
    EmployerActiveWorkerByIndex(Address, u32),
    EmployerActiveWorkerIndex(Address, Address),
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
                Symbol::new(&e, "registered"),
                worker.clone(),
                preferred_token.clone(),
            ),
            metadata_hash.clone(),
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
            metadata_hash,
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

    pub fn set_stream_active(e: Env, employer: Address, worker: Address, active: bool) {
        employer.require_auth();

        let worker_key = DataKey::Worker(worker.clone());
        if !e.storage().persistent().has(&worker_key) {
            panic!("Worker not registered");
        }

        let idx_key = DataKey::EmployerActiveWorkerIndex(employer.clone(), worker.clone());
        let is_active = e.storage().persistent().has(&idx_key);

        if active {
            if is_active {
                return;
            }

            let count_key = DataKey::EmployerActiveWorkerCount(employer.clone());
            let count: u32 = e.storage().persistent().get(&count_key).unwrap_or(0);

            let by_index_key = DataKey::EmployerActiveWorkerByIndex(employer.clone(), count);
            e.storage().persistent().set(&by_index_key, &worker);

            let stored_index: u32 = count + 1;
            e.storage().persistent().set(&idx_key, &stored_index);
            e.storage().persistent().set(&count_key, &(count + 1));

            e.events().publish(
                (
                    symbol_short!("stream"),
                    symbol_short!("active"),
                    employer.clone(),
                    worker.clone(),
                ),
                (),
            );
        } else {
            if !is_active {
                return;
            }

            let count_key = DataKey::EmployerActiveWorkerCount(employer.clone());
            let count: u32 = e.storage().persistent().get(&count_key).unwrap_or(0);
            if count == 0 {
                e.storage().persistent().remove(&idx_key);
                return;
            }

            let stored_index: u32 = e.storage().persistent().get(&idx_key).unwrap();
            let remove_pos: u32 = stored_index - 1;
            let last_pos: u32 = count - 1;

            if remove_pos != last_pos {
                let last_key = DataKey::EmployerActiveWorkerByIndex(employer.clone(), last_pos);
                let last_worker: Address = e.storage().persistent().get(&last_key).unwrap();

                let remove_key =
                    DataKey::EmployerActiveWorkerByIndex(employer.clone(), remove_pos);
                e.storage().persistent().set(&remove_key, &last_worker);

                let last_worker_idx_key =
                    DataKey::EmployerActiveWorkerIndex(employer.clone(), last_worker.clone());
                e.storage().persistent().set(&last_worker_idx_key, &(remove_pos + 1));

                e.storage().persistent().remove(&last_key);
            } else {
                let last_key = DataKey::EmployerActiveWorkerByIndex(employer.clone(), last_pos);
                e.storage().persistent().remove(&last_key);
            }

            e.storage().persistent().remove(&idx_key);
            e.storage().persistent().set(&count_key, &(count - 1));

            e.events().publish(
                (
                    symbol_short!("stream"),
                    symbol_short!("inactive"),
                    employer.clone(),
                    worker.clone(),
                ),
                (),
            );
        }
    }

    pub fn get_workers_by_employer(e: Env, employer: Address, start: u32, limit: u32) -> Vec<WorkerProfile> {
        let count_key = DataKey::EmployerActiveWorkerCount(employer.clone());
        let count: u32 = e.storage().persistent().get(&count_key).unwrap_or(0);

        if start >= count || limit == 0 {
            return Vec::new(&e);
        }

        let end_exclusive = if start.saturating_add(limit) > count {
            count
        } else {
            start + limit
        };

        let mut out: Vec<WorkerProfile> = Vec::new(&e);
        let mut i = start;
        while i < end_exclusive {
            let by_index_key = DataKey::EmployerActiveWorkerByIndex(employer.clone(), i);
            let worker: Address = e.storage().persistent().get(&by_index_key).unwrap();
            let worker_key = DataKey::Worker(worker);
            let profile: WorkerProfile = e.storage().persistent().get(&worker_key).unwrap();
            out.push_back(profile);
            i += 1;
        }

        out
    }
}

mod test;
