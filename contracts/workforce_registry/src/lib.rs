#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Worker(Address),
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct WorkerProfile {
    pub name: Bytes,
    pub email: Bytes,
    pub active: bool,
    pub registered_at: u64,
}

#[contract]
pub struct WorkforceRegistry;

#[contractimpl]
impl WorkforceRegistry {
    pub fn initialize(e: Env, admin: Address) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        e.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn register_worker(e: Env, worker: Address, name: Bytes, email: Bytes) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).expect("not initialized");
        admin.require_auth();

        let profile = WorkerProfile {
            name,
            email,
            active: true,
            registered_at: e.ledger().timestamp(),
        };
        
        e.storage().persistent().set(&DataKey::Worker(worker), &profile);
    }

    pub fn update_worker(e: Env, worker: Address, name: Bytes, email: Bytes, active: bool) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).expect("not initialized");
        admin.require_auth();

        let mut profile: WorkerProfile = e.storage().persistent().get(&DataKey::Worker(worker.clone())).expect("worker not found");
        profile.name = name;
        profile.email = email;
        profile.active = active;
        
        e.storage().persistent().set(&DataKey::Worker(worker), &profile);
    }

    pub fn get_worker(e: Env, worker: Address) -> Option<WorkerProfile> {
        e.storage().persistent().get(&DataKey::Worker(worker))
    }
    
    pub fn get_admin(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).expect("not initialized")
    }
}

#[cfg(test)]
mod test;
