use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Bytes, Env, Symbol, Vec,
};
use quipay_common::error::QuipayError;

// ─── Types ───────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReceiptMetadata {
    pub employer: Address,
    pub worker: Address,
    pub token: Address,
    pub total_paid: i128,
    pub stream_id: u64,
    pub start_date: u64,
    pub end_date: u64,
    pub completion_date: u64,
    pub receipt_type: ReceiptType,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ReceiptType {
    Completed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Receipt {
    pub id: u64,
    pub metadata: ReceiptMetadata,
    pub minted_at: u64,
    pub owner: Address,
}

// ─── Storage ─────────────────────────────────────────────────────────────

#[contracttype]
pub struct DataKey;

impl DataKey {
    pub const ADMIN: DataKey = DataKey;
    pub const NEXT_RECEIPT_ID: DataKey = DataKey;
    pub const RECEIPT: DataKey = DataKey;
    pub const RECEIPT_BY_STREAM: DataKey = DataKey;
    pub const RECEIPTS_BY_WORKER: DataKey = DataKey;
    pub const RECEIPTS_BY_EMPLOYER: DataKey = DataKey;
}

// ─── Contract ─────────────────────────────────────────────────────────────

#[contract]
pub struct PayrollReceipt;

#[contractimpl]
impl PayrollReceipt {
    /// Initialize the receipt contract
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::ADMIN) {
            panic!("already initialized");
        }
        env.storage()
            .instance()
            .set(&DataKey::ADMIN, &admin);
        env.storage()
            .instance()
            .set(&DataKey::NEXT_RECEIPT_ID, &1u64);
    }

    /// Mint a receipt for a completed or cancelled stream
    pub fn mint_receipt(
        env: Env,
        employer: Address,
        worker: Address,
        token: Address,
        total_paid: i128,
        stream_id: u64,
        start_date: u64,
        end_date: u64,
        receipt_type: ReceiptType,
    ) -> u64 {
        // Only authorized contracts can mint receipts
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::ADMIN)
            .unwrap_or_else(|| panic!("contract not initialized"));

        let caller = env.invoker();
        if caller != admin {
            panic!("unauthorized");
        }

        // Check if receipt already exists for this stream
        if env
            .storage()
            .instance()
            .has(&DataKey::RECEIPT_BY_STREAM)
        {
            let receipts_by_stream: Vec<u64> = env
                .storage()
                .instance()
                .get(&DataKey::RECEIPT_BY_STREAM)
                .unwrap();
            
            for receipt_id in receipts_by_stream.iter() {
                if let Some(receipt) = Self::get_receipt(env, receipt_id) {
                    if receipt.metadata.stream_id == stream_id {
                        panic!("receipt already exists for stream");
                    }
                }
            }
        }

        let receipt_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NEXT_RECEIPT_ID)
            .unwrap_or(1u64);

        let metadata = ReceiptMetadata {
            employer,
            worker,
            token,
            total_paid,
            stream_id,
            start_date,
            end_date,
            completion_date: env.ledger().timestamp(),
            receipt_type,
        };

        let receipt = Receipt {
            id: receipt_id,
            metadata,
            minted_at: env.ledger().timestamp(),
            owner: worker, // Receipt belongs to worker
        };

        // Store receipt
        env.storage()
            .instance()
            .set(&DataKey::RECEIPT, &receipt_id, &receipt);

        // Update indexes
        let mut receipts_by_stream: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::RECEIPT_BY_STREAM)
            .unwrap_or(Vec::new(&env));
        receipts_by_stream.push_back(receipt_id);
        env.storage()
            .instance()
            .set(&DataKey::RECEIPT_BY_STREAM, &receipts_by_stream);

        let mut receipts_by_worker: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::RECEIPTS_BY_WORKER)
            .unwrap_or(Vec::new(&env));
        receipts_by_worker.push_back(receipt_id);
        env.storage()
            .instance()
            .set(&DataKey::RECEIPTS_BY_WORKER, &receipts_by_worker);

        let mut receipts_by_employer: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::RECEIPTS_BY_EMPLOYER)
            .unwrap_or(Vec::new(&env));
        receipts_by_employer.push_back(receipt_id);
        env.storage()
            .instance()
            .set(&DataKey::RECEIPTS_BY_EMPLOYER, &receipts_by_employer);

        // Increment next ID
        env.storage()
            .instance()
            .set(&DataKey::NEXT_RECEIPT_ID, &(receipt_id + 1));

        receipt_id
    }

    /// Get receipt by ID
    pub fn get_receipt(env: Env, receipt_id: u64) -> Option<Receipt> {
        env.storage()
            .instance()
            .get(&DataKey::RECEIPT, &receipt_id)
    }

    /// Get receipts for a worker
    pub fn get_receipts_by_worker(env: Env, worker: Address) -> Vec<u64> {
        let receipts_by_worker: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::RECEIPTS_BY_WORKER)
            .unwrap_or(Vec::new(&env));
        
        receipts_by_worker
    }

    /// Get receipts for an employer
    pub fn get_receipts_by_employer(env: Env, employer: Address) -> Vec<u64> {
        let receipts_by_employer: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::RECEIPTS_BY_EMPLOYER)
            .unwrap_or(Vec::new(&env));
        
        receipts_by_employer
    }

    /// Get receipt ID for a specific stream
    pub fn get_receipt_by_stream(env: Env, stream_id: u64) -> Option<u64> {
        let receipts_by_stream: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::RECEIPT_BY_STREAM)
            .unwrap_or(Vec::new(&env));
        
        for receipt_id in receipts_by_stream.iter() {
            if let Some(receipt) = Self::get_receipt(env, receipt_id) {
                if receipt.metadata.stream_id == stream_id {
                    return Some(receipt_id);
                }
            }
        }
        None
    }

    /// Verify receipt authenticity
    pub fn verify_receipt(env: Env, receipt_id: u64) -> bool {
        env.storage()
            .instance()
            .has(&DataKey::RECEIPT, &receipt_id)
    }

    /// Get receipt metadata for display
    pub fn get_receipt_metadata(env: Env, receipt_id: u64) -> Option<ReceiptMetadata> {
        if let Some(receipt) = Self::get_receipt(env, receipt_id) {
            Some(receipt.metadata)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod test;
