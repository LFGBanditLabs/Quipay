#![no_std]

use quipay_common::{QuipayError, require};
use soroban_sdk::{Address, Bytes, Env, String, contract, contractimpl, contracttype, symbol_short};

#[cfg(test)]
mod test;

// ── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    PendingAdmin,
    Minter,
    NextReceiptId,
    Receipt(u64),
    WorkerReceipts(Address),
    BaseUri,
}

// ── Data types ────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ClosureReason {
    Completed = 0,
    Cancelled = 1,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct PayrollReceipt {
    pub receipt_id: u64,
    pub stream_id: u64,
    pub employer: Address,
    pub worker: Address,
    pub token: Address,
    pub total_paid: i128,
    pub stream_start_ts: u64,
    pub stream_end_ts: u64,
    pub closed_at: u64,
    pub reason: ClosureReason,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct ReceiptMetadata {
    pub name: String,
    pub description: String,
    pub amount: i128,
    pub timestamp: u64,
    pub recipient: Address,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct PayrollReceiptContract;

#[contractimpl]
impl PayrollReceiptContract {
    // ── Initialisation ────────────────────────────────────────────────────

    /// Initialise the contract.
    ///
    /// `minter` should be the deployed PayrollStream contract address.
    pub fn init(env: Env, admin: Address, minter: Address) -> Result<(), QuipayError> {
        require!(
            !env.storage().instance().has(&DataKey::Admin),
            QuipayError::AlreadyInitialized
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Minter, &minter);
        env.storage().instance().set(&DataKey::NextReceiptId, &1u64);
        Ok(())
    }

    // ── Admin helpers ─────────────────────────────────────────────────────

    pub fn set_minter(env: Env, minter: Address) -> Result<(), QuipayError> {
        Self::require_admin(&env)?;
        env.storage().instance().set(&DataKey::Minter, &minter);
        Ok(())
    }

    pub fn propose_admin(env: Env, new_admin: Address) -> Result<(), QuipayError> {
        Self::require_admin(&env)?;
        env.storage()
            .instance()
            .set(&DataKey::PendingAdmin, &new_admin);
        Ok(())
    }

    pub fn accept_admin(env: Env) -> Result<(), QuipayError> {
        let pending: Address = env
            .storage()
            .instance()
            .get(&DataKey::PendingAdmin)
            .ok_or(QuipayError::NoPendingAdmin)?;
        pending.require_auth();
        env.storage().instance().set(&DataKey::Admin, &pending);
        env.storage().instance().remove(&DataKey::PendingAdmin);
        Ok(())
    }

    // ── Minting ───────────────────────────────────────────────────────────

    /// Mint a receipt for a completed or cancelled stream.
    ///
    /// Only the authorised minter (PayrollStream) may call this.
    /// Receipts are non-transferable: once written they are immutable.
    pub fn mint(
        env: Env,
        stream_id: u64,
        employer: Address,
        worker: Address,
        token: Address,
        total_paid: i128,
        stream_start_ts: u64,
        stream_end_ts: u64,
        closed_at: u64,
        reason: ClosureReason,
    ) -> Result<u64, QuipayError> {
        // Only the registered minter may call this.
        let minter: Address = env
            .storage()
            .instance()
            .get(&DataKey::Minter)
            .ok_or(QuipayError::NotInitialized)?;
        minter.require_auth();

        let receipt_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextReceiptId)
            .unwrap_or(1u64);

        let receipt = PayrollReceipt {
            receipt_id,
            stream_id,
            employer: employer.clone(),
            worker: worker.clone(),
            token: token.clone(),
            total_paid,
            stream_start_ts,
            stream_end_ts,
            closed_at,
            reason,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Receipt(receipt_id), &receipt);

        // Append to worker index
        let index_key = DataKey::WorkerReceipts(worker.clone());
        let mut ids: soroban_sdk::Vec<u64> = env
            .storage()
            .persistent()
            .get(&index_key)
            .unwrap_or_else(|| soroban_sdk::Vec::new(&env));
        ids.push_back(receipt_id);
        env.storage().persistent().set(&index_key, &ids);

        env.storage()
            .instance()
            .set(&DataKey::NextReceiptId, &(receipt_id + 1));

        env.events().publish(
            (
                symbol_short!("receipt"),
                symbol_short!("minted"),
                worker,
                employer,
            ),
            (receipt_id, stream_id, token, total_paid, reason),
        );

        Ok(receipt_id)
    }

    // ── Queries ───────────────────────────────────────────────────────────

    pub fn get_receipt(env: Env, receipt_id: u64) -> Result<PayrollReceipt, QuipayError> {
        env.storage()
            .persistent()
            .get(&DataKey::Receipt(receipt_id))
            .ok_or(QuipayError::ReceiptNotFound)
    }

    /// Return all receipt IDs for a given worker (paginated).
    pub fn get_worker_receipts(
        env: Env,
        worker: Address,
        offset: u32,
        limit: u32,
    ) -> soroban_sdk::Vec<u64> {
        let ids: soroban_sdk::Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::WorkerReceipts(worker))
            .unwrap_or_else(|| soroban_sdk::Vec::new(&env));

        let total = ids.len();
        if offset >= total {
            return soroban_sdk::Vec::new(&env);
        }

        let end = core::cmp::min(offset + limit, total);
        let mut page = soroban_sdk::Vec::new(&env);
        let mut i = offset;
        while i < end {
            if let Some(id) = ids.get(i) {
                page.push_back(id);
            }
            i += 1;
        }
        page
    }

    pub fn get_admin(env: Env) -> Result<Address, QuipayError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)
    }

    pub fn set_base_uri(env: Env, admin: Address, uri: String) -> Result<(), QuipayError> {
        admin.require_auth();
        env.storage().instance().set(&DataKey::BaseUri, &uri);
        env.events().publish(
            (symbol_short!("receipt"), symbol_short!("uri_set")),
            (),
        );
        Ok(())
    }

    pub fn token_uri(env: Env, receipt_id: u64) -> String {
        let base_uri: String = env
            .storage()
            .instance()
            .get(&DataKey::BaseUri)
            .unwrap_or_else(|| String::from_str(&env, ""));

        if base_uri.is_empty() {
            return String::from_str(&env, "");
        }

        let mut uri_bytes = base_uri.to_bytes();
        uri_bytes.push_back(b'/');

        let id_bytes_arr = receipt_id.to_le_bytes();
        for b in id_bytes_arr.iter() {
            let hex = if *b < 10 { b'0' + *b } else { b'a' + (*b - 10) };
            uri_bytes.push_back(hex);
        }

        String::from(&uri_bytes)
    }

    pub fn get_receipt_metadata(
        env: Env,
        receipt_id: u64,
    ) -> Result<ReceiptMetadata, QuipayError> {
        let receipt = Self::get_receipt(env.clone(), receipt_id)?;

        let mut name_bytes = Bytes::from_slice(&env, b"Payroll Receipt #");
        let id_bytes_arr = receipt_id.to_le_bytes();
        for b in id_bytes_arr.iter() {
            let hex = if *b < 10 { b'0' + *b } else { b'a' + (*b - 10) };
            name_bytes.push_back(hex);
        }
        let name = String::from(&name_bytes);

        let mut desc_bytes = Bytes::from_slice(&env, b"Receipt for stream ");
        let stream_bytes_arr = receipt.stream_id.to_le_bytes();
        for b in stream_bytes_arr.iter() {
            let hex = if *b < 10 { b'0' + *b } else { b'a' + (*b - 10) };
            desc_bytes.push_back(hex);
        }
        let description = String::from(&desc_bytes);

        Ok(ReceiptMetadata {
            name,
            description,
            amount: receipt.total_paid,
            timestamp: receipt.closed_at,
            recipient: receipt.worker,
        })
    }

    fn require_admin(env: &Env) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        Ok(())
    }
}
