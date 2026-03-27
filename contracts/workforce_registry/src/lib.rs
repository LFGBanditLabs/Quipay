#![no_std]
use quipay_common::{QuipayError, require};
use soroban_sdk::{Address, Env, String, Vec, contract, contractimpl, contracttype, symbol_short};

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
    Admin,
    PendingAdmin,
    Worker(Address),
    EmployerActiveWorkerCount(Address),
    EmployerActiveWorkerByIndex(Address, u32),
    EmployerActiveWorkerIndex(Address, Address),
    BlacklistedWorker(Address),
}

#[contract]
pub struct WorkforceRegistryContract;

#[contractimpl]
impl WorkforceRegistryContract {
    /// Initialize the contract with an admin
    pub fn initialize(e: Env, admin: Address) -> Result<(), QuipayError> {
        if e.storage().persistent().has(&DataKey::Admin) {
            return Err(QuipayError::AlreadyInitialized);
        }

        e.storage().persistent().set(&DataKey::Admin, &admin);
        Ok(())
    }

    /// Get the current admin address
    pub fn get_admin(e: Env) -> Result<Address, QuipayError> {
        e.storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)
    }

    /// Propose a new admin address (first step of two-step transfer)
    pub fn propose_admin(e: Env, new_admin: Address) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();

        e.storage()
            .persistent()
            .set(&DataKey::PendingAdmin, &new_admin);
        Ok(())
    }

    /// Get the pending admin address (if any)
    pub fn get_pending_admin(e: Env) -> Option<Address> {
        e.storage().persistent().get(&DataKey::PendingAdmin)
    }

    /// Accept the admin role (second step of two-step transfer)
    pub fn accept_admin(e: Env) -> Result<(), QuipayError> {
        let pending_admin =
            Self::get_pending_admin(e.clone()).ok_or(QuipayError::NoPendingAdmin)?;

        pending_admin.require_auth();

        // Set the new admin
        e.storage()
            .persistent()
            .set(&DataKey::Admin, &pending_admin);

        // Clear the pending admin
        e.storage().persistent().remove(&DataKey::PendingAdmin);

        Ok(())
    }

    /// Transfer admin rights to a new address (one-step, backward compatible)
    pub fn transfer_admin(e: Env, new_admin: Address) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();

        e.storage().persistent().set(&DataKey::Admin, &new_admin);
        Ok(())
    }

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
    ) -> Result<(), QuipayError> {
        worker.require_auth();

        // Check if worker is blacklisted
        let blacklist_key = DataKey::BlacklistedWorker(worker.clone());
        require!(
            !e.storage()
                .persistent()
                .get(&blacklist_key)
                .unwrap_or(false),
            QuipayError::AddressBlacklisted
        );

        let key = DataKey::Worker(worker.clone());
        require!(
            !e.storage().persistent().has(&key),
            QuipayError::AlreadyInitialized
        );

        let profile = WorkerProfile {
            wallet: worker.clone(),
            preferred_token: preferred_token.clone(),
            metadata_hash: metadata_hash.clone(),
        };

        e.storage().persistent().set(&key, &profile);

        e.events().publish(
            (
                symbol_short!("w_reg"),
                symbol_short!("reg"),
                worker.clone(),
                preferred_token.clone(),
            ),
            metadata_hash.clone(),
        );

        Ok(())
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
    ) -> Result<(), QuipayError> {
        worker.require_auth();

        // Check if worker is blacklisted
        let blacklist_key = DataKey::BlacklistedWorker(worker.clone());
        require!(
            !e.storage()
                .persistent()
                .get(&blacklist_key)
                .unwrap_or(false),
            QuipayError::AddressBlacklisted
        );

        let key = DataKey::Worker(worker.clone());
        require!(
            e.storage().persistent().has(&key),
            QuipayError::WorkerNotFound
        );

        let profile = WorkerProfile {
            wallet: worker.clone(),
            preferred_token: preferred_token.clone(),
            metadata_hash: metadata_hash.clone(),
        };

        e.storage().persistent().set(&key, &profile);

        e.events().publish(
            (
                symbol_short!("w_reg"),
                symbol_short!("upd"),
                worker.clone(),
                preferred_token.clone(),
            ),
            metadata_hash,
        );

        Ok(())
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

    pub fn set_stream_active(
        e: Env,
        employer: Address,
        worker: Address,
        active: bool,
    ) -> Result<(), QuipayError> {
        employer.require_auth();

        // Check if worker is blacklisted
        let blacklist_key = DataKey::BlacklistedWorker(worker.clone());
        require!(
            !e.storage()
                .persistent()
                .get(&blacklist_key)
                .unwrap_or(false),
            QuipayError::AddressBlacklisted
        );

        let worker_key = DataKey::Worker(worker.clone());
        require!(
            e.storage().persistent().has(&worker_key),
            QuipayError::WorkerNotFound
        );

        let idx_key = DataKey::EmployerActiveWorkerIndex(employer.clone(), worker.clone());
        let is_active = e.storage().persistent().has(&idx_key);

        if active {
            if is_active {
                return Ok(());
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
                    symbol_short!("w_reg"),
                    symbol_short!("st_act"),
                    employer.clone(),
                    worker.clone(),
                ),
                true,
            );
        } else {
            if !is_active {
                return Ok(());
            }

            let count_key = DataKey::EmployerActiveWorkerCount(employer.clone());
            let count: u32 = e.storage().persistent().get(&count_key).unwrap_or(0);
            if count == 0 {
                e.storage().persistent().remove(&idx_key);
                return Ok(());
            }

            let stored_index: u32 = e
                .storage()
                .persistent()
                .get(&idx_key)
                .ok_or(QuipayError::StorageError)?;
            let remove_pos: u32 = stored_index - 1;
            let last_pos: u32 = count - 1;

            if remove_pos != last_pos {
                let last_key = DataKey::EmployerActiveWorkerByIndex(employer.clone(), last_pos);
                let last_worker: Address = e
                    .storage()
                    .persistent()
                    .get(&last_key)
                    .ok_or(QuipayError::StorageError)?;

                let remove_key = DataKey::EmployerActiveWorkerByIndex(employer.clone(), remove_pos);
                e.storage().persistent().set(&remove_key, &last_worker);

                let last_worker_idx_key =
                    DataKey::EmployerActiveWorkerIndex(employer.clone(), last_worker.clone());
                e.storage()
                    .persistent()
                    .set(&last_worker_idx_key, &(remove_pos + 1));

                e.storage().persistent().remove(&last_key);
            } else {
                let last_key = DataKey::EmployerActiveWorkerByIndex(employer.clone(), last_pos);
                e.storage().persistent().remove(&last_key);
            }

            e.storage().persistent().remove(&idx_key);
            e.storage().persistent().set(&count_key, &(count - 1));

            e.events().publish(
                (
                    symbol_short!("w_reg"),
                    symbol_short!("st_act"),
                    employer.clone(),
                    worker.clone(),
                ),
                false,
            );
        }

        Ok(())
    }

    pub fn get_workers_by_employer(
        e: Env,
        employer: Address,
        start: u32,
        limit: u32,
    ) -> Vec<WorkerProfile> {
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
            if let Some(worker) = e
                .storage()
                .persistent()
                .get::<DataKey, Address>(&by_index_key)
            {
                let worker_key = DataKey::Worker(worker);
                if let Some(profile) = e
                    .storage()
                    .persistent()
                    .get::<DataKey, WorkerProfile>(&worker_key)
                {
                    out.push_back(profile);
                }
            }
            i += 1;
        }

        out
    }

    pub fn remove_worker(e: Env, employer: Address, worker: Address) -> Result<(), QuipayError> {
        employer.require_auth();

        let key = DataKey::Worker(worker.clone());
        require!(
            e.storage().persistent().has(&key),
            QuipayError::WorkerNotFound
        );

        // Check and remove from employer active list if needed
        let idx_key = DataKey::EmployerActiveWorkerIndex(employer.clone(), worker.clone());
        if e.storage().persistent().has(&idx_key) {
            Self::set_stream_active(e.clone(), employer.clone(), worker.clone(), false)?;
        }

        e.storage().persistent().remove(&key);

        e.events().publish(
            (
                symbol_short!("w_reg"),
                symbol_short!("rem"),
                employer,
                worker,
            ),
            (),
        );

        Ok(())
    }

    /// Sets blacklist status for a worker (admin only)
    ///
    /// # Arguments
    /// * `e` - The environment.
    /// * `worker` - The worker address to blacklist/unblacklist.
    /// * `blacklisted` - True to blacklist, false to unblacklist.
    pub fn set_blacklisted(e: Env, worker: Address, blacklisted: bool) -> Result<(), QuipayError> {
        let admin = Self::get_admin(e.clone())?;
        admin.require_auth();

        let key = DataKey::BlacklistedWorker(worker.clone());

        if blacklisted {
            e.storage().persistent().set(&key, &true);
        } else {
            e.storage().persistent().remove(&key);
        }

        e.events().publish(
            (
                symbol_short!("registry"),
                symbol_short!("blacklist"),
                worker.clone(),
                blacklisted,
            ),
            (),
        );

        Ok(())
    }

    /// Checks if a worker is blacklisted
    ///
    /// # Arguments
    /// * `e` - The environment.
    /// * `worker` - The worker address to check.
    ///
    /// # Returns
    /// * `bool` - True if blacklisted, False otherwise.
    pub fn is_blacklisted(e: Env, worker: Address) -> bool {
        let key = DataKey::BlacklistedWorker(worker);
        e.storage().persistent().get(&key).unwrap_or(false)
    }
}

mod test;
