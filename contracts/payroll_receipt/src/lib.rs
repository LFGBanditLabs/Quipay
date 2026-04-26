#![no_std]

use quipay_common::{QuipayError, require};
use soroban_sdk::{Address, Env, contract, contractimpl, contracttype, symbol_short};

#[cfg(test)]
mod test;

// ── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    PendingAdmin,
    /// Authorised minter (PayrollStream contract address)
    Minter,
    NextReceiptId,
    Receipt(u64),
    /// Index: all receipt IDs for a given worker
    WorkerReceipts(Address),
}

// ── Data types ────────────────────────────────────────────────────────────────

/// How the stream ended.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ClosureReason {
    Completed = 0,
    Cancelled = 1,
    Burned = 2,
}

/// Immutable, non-transferable proof-of-payment record.
///
/// Minted once per stream closure. Useful for proof-of-income and tax records.
#[contracttype]
#[derive(Clone, Debug)]
pub struct PayrollReceipt {
    pub receipt_id: u64,
    pub stream_id: u64,
    pub employer: Address,
    pub worker: Address,
    pub token: Address,
    /// Total amount actually paid out to the worker (in token base units).
    pub total_paid: i128,
    pub stream_start_ts: u64,
    pub stream_end_ts: u64,
    /// Ledger timestamp when the receipt was minted (stream closed).
    pub closed_at: u64,
    pub reason: ClosureReason,
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

    /// Burn a receipt to mark it as invalid/reversed.
    ///
    /// Only the receipt owner (worker) or the contract admin can burn.
    /// Mark the receipt as Burned rather than deleting storage for auditability.
    pub fn burn_receipt(env: Env, receipt_id: u64, caller: Address) -> Result<(), QuipayError> {
        caller.require_auth();

        let mut receipt = Self::get_receipt(env.clone(), receipt_id)?;

        require!(
            receipt.reason != ClosureReason::Burned,
            QuipayError::AlreadyBurned
        );

        let admin = Self::get_admin(env.clone())?;
        require!(
            caller == receipt.worker || caller == admin,
            QuipayError::Unauthorized
        );

        receipt.reason = ClosureReason::Burned;

        env.storage()
            .persistent()
            .set(&DataKey::Receipt(receipt_id), &receipt);

        env.events().publish(
            (
                symbol_short!("receipt"),
                symbol_short!("burned"),
                receipt_id,
                caller,
            ),
            env.ledger().timestamp(),
        );

        Ok(())
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

    // ── Internal helpers ──────────────────────────────────────────────────

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
