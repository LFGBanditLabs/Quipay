//! contracts/payroll_stream/src/dispute.rs
//!
//! Stream dispute resolution — issue #510.
//!
//! Integrates with the existing lib.rs conventions:
//!   - Uses `QuipayError` from `quipay_common` (not raw panic codes)
//!   - Adds `DataKey::Dispute(u64)` to the existing DataKey enum
//!   - Uses `StreamStatus::Disputed` as the freeze mechanism, consistent with
//!     how `StreamStatus::Paused` and `StreamStatus::PendingCancel` work
//!   - Returns `Result<_, QuipayError>` everywhere
//!   - Event topics follow the existing (Symbol, Symbol, stream_id, actor) pattern
//!   - Token transfers go through existing `call_vault_payout` / `call_vault_remove_liability`

use quipay_common::QuipayError;
use soroban_sdk::{contracttype, Address, BytesN, Env, Symbol};

use crate::{DataKey, DisputeOutcome, PayrollStream, Stream, StreamKey, StreamStatus};

// ─── Types ────────────────────────────────────────────────────────────────────

/// Persistent on-chain dispute record.
/// Stored at `DataKey::Dispute(stream_id)` in persistent storage.
// #[contracttype]
// #[derive(Clone, Debug)]
// pub struct Dispute {
//     pub stream_id: u64,
//     /// Employer or worker that raised the dispute.
//     pub raised_by: Address,
//     /// 32-byte commitment hash pointing to the off-chain reason document.
//     pub reason_hash: BytesN<32>,
//     /// Ledger timestamp when the dispute was raised.
//     pub raised_at: u64,
//     /// True once the arbitrator has resolved the dispute.
//     pub resolved: bool,
//     /// Arbitrator's chosen outcome (None until resolved).
//     pub outcome: Option<DisputeOutcome>,
// }

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MaybeOutcome {
    None,
    Some(DisputeOutcome),
}
/// Persistent on-chain dispute record.
/// Stored at `DataKey::Dispute(stream_id)` in persistent storage.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Dispute {
    pub stream_id: u64,
    /// Employer or worker that raised the dispute.
    pub raised_by: Address,
    /// 32-byte commitment hash pointing to the off-chain reason document.
    pub reason_hash: BytesN<32>,
    /// Ledger timestamp when the dispute was raised.
    pub raised_at: u64,
    /// True once the arbitrator has resolved the dispute.
    pub resolved: bool,
    /// Arbitrator's chosen outcome (None until resolved).
    //pub outcome: Option<DisputeOutcome>,
    pub outcome: MaybeOutcome,
}

// ─── raise_dispute ────────────────────────────────────────────────────────────

/// Raise a dispute on a stream.
///
/// Callable by the stream's employer or worker. Immediately sets
/// `stream.status = StreamStatus::Disputed`, which causes all withdrawal
/// paths (`withdraw`, `batch_withdraw`, `batch_claim`) to return
/// `QuipayError::StreamNotActive` until the dispute is resolved.
///
/// # Errors
/// - `QuipayError::StreamNotFound` — stream does not exist.
/// - `QuipayError::Unauthorized`   — caller is neither employer nor worker.
/// - `QuipayError::StreamClosed`   — stream is already Canceled or Completed.
/// - `QuipayError::Custom`         — stream already has an open (unresolved) dispute.
pub fn raise_dispute(
    env: &Env,
    stream_id: u64,
    caller: &Address,
    reason_hash: BytesN<32>,
) -> Result<(), QuipayError> {
    caller.require_auth();

    let mut stream: Stream =
        PayrollStream::get_stored_stream(env, stream_id).ok_or(QuipayError::StreamNotFound)?;

    // Auth: caller must be a participant
    if *caller != stream.employer && *caller != stream.worker {
        return Err(QuipayError::Unauthorized);
    }

    // Status guards
    match stream.status {
        // Terminal states — cannot dispute a closed stream
        StreamStatus::Canceled | StreamStatus::Completed => {
            return Err(QuipayError::StreamClosed);
        }
        // Already disputed — reject duplicate open dispute
        StreamStatus::Disputed => {
            if has_open_dispute(env, stream_id) {
                return Err(QuipayError::Custom); // AlreadyDisputed
            }
            // Previous dispute is resolved — allow a fresh one to be raised
        }
        // Active, Paused, PendingCancel — all valid states to raise a dispute
        StreamStatus::Active | StreamStatus::Paused | StreamStatus::PendingCancel => {}
    }

    let now = env.ledger().timestamp();

    PayrollStream::set_stored_dispute(
        env,
        stream_id,
        &Dispute {
            stream_id,
            raised_by: caller.clone(),
            reason_hash: reason_hash.clone(),
            raised_at: now,
            resolved: false,
            outcome: MaybeOutcome::None,
        },
    );

    // Freeze stream by transitioning to Disputed status
    stream.status = StreamStatus::Disputed;
    PayrollStream::set_stored_stream(env, stream_id, &stream);

    env.events().publish(
        (
            Symbol::new(env, "stream"),
            Symbol::new(env, "dispute_raised"),
            stream_id,
            caller.clone(),
        ),
        (stream.worker.clone(), stream.employer.clone(), reason_hash),
    );

    Ok(())
}

// ─── resolve_dispute ──────────────────────────────────────────────────────────

/// Resolve an open dispute and apply the chosen outcome.
///
/// Only the contract admin may call this. Applies one of three outcomes,
/// performs vault transfers inline, and updates stream status.
///
/// # Errors
/// - `QuipayError::NotInitialized` — contract not set up.
/// - `QuipayError::Unauthorized`   — caller is not the admin.
/// - `QuipayError::StreamNotFound` — stream does not exist.
/// - `QuipayError::Custom`         — no dispute exists, or already resolved.
/// - `QuipayError::Overflow`       — arithmetic overflow during payout split.
pub fn resolve_dispute(
    env: &Env,
    stream_id: u64,
    arbitrator: &Address,
    outcome: DisputeOutcome,
) -> Result<(), QuipayError> {
    arbitrator.require_auth();

    // Auth: only admin can resolve
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(QuipayError::NotInitialized)?;
    if *arbitrator != admin {
        return Err(QuipayError::Unauthorized);
    }

    // Load and validate dispute
    let mut dispute: Dispute =
        PayrollStream::get_stored_dispute(env, stream_id).ok_or(QuipayError::Custom)?; // NoOpenDispute

    if dispute.resolved {
        return Err(QuipayError::Custom); // DisputeAlreadyResolved
    }

    let mut stream: Stream =
        PayrollStream::get_stored_stream(env, stream_id).ok_or(QuipayError::StreamNotFound)?;

    let vault: Address = env
        .storage()
        .instance()
        .get(&DataKey::Vault)
        .ok_or(QuipayError::NotInitialized)?;

    let now = env.ledger().timestamp();

    match &outcome {
        DisputeOutcome::FullWorker => {
            let remaining = stream
                .total_amount
                .checked_sub(stream.withdrawn_amount)
                .ok_or(QuipayError::Overflow)?;

            if remaining > 0 {
                PayrollStream::call_vault_payout(
                    env,
                    &vault,
                    stream.worker.clone(),
                    stream.token.clone(),
                    remaining,
                );
                stream.withdrawn_amount = stream
                    .withdrawn_amount
                    .checked_add(remaining)
                    .ok_or(QuipayError::Overflow)?;
                stream.last_withdrawal_ts = now;
            }

            stream.status = StreamStatus::Completed;
            stream.closed_at = now;
        }

        DisputeOutcome::FullEmployer => {
            let remaining = stream
                .total_amount
                .checked_sub(stream.withdrawn_amount)
                .ok_or(QuipayError::Overflow)?;

            if remaining > 0 {
                PayrollStream::call_vault_remove_liability(
                    env,
                    &vault,
                    stream.token.clone(),
                    remaining,
                );
                PayrollStream::call_vault_payout(
                    env,
                    &vault,
                    stream.employer.clone(),
                    stream.token.clone(),
                    remaining,
                );
            }

            stream.status = StreamStatus::Canceled;
            stream.closed_at = now;
        }

        DisputeOutcome::Split(ratio) => {
            if *ratio > 10000 {
                return Err(QuipayError::Custom); // Invalid ratio
            }

            let remaining = stream
                .total_amount
                .checked_sub(stream.withdrawn_amount)
                .ok_or(QuipayError::Overflow)?;

            let worker_payout = (remaining
                .checked_mul(*ratio as i128)
                .ok_or(QuipayError::Overflow)?
                / 10000);
            let employer_refund = remaining
                .checked_sub(worker_payout)
                .ok_or(QuipayError::Overflow)?;

            if worker_payout > 0 {
                PayrollStream::call_vault_payout(
                    env,
                    &vault,
                    stream.worker.clone(),
                    stream.token.clone(),
                    worker_payout,
                );
                stream.withdrawn_amount = stream
                    .withdrawn_amount
                    .checked_add(worker_payout)
                    .ok_or(QuipayError::Overflow)?;
                stream.last_withdrawal_ts = now;
            }

            if employer_refund > 0 {
                PayrollStream::call_vault_remove_liability(
                    env,
                    &vault,
                    stream.token.clone(),
                    employer_refund,
                );
                PayrollStream::call_vault_payout(
                    env,
                    &vault,
                    stream.employer.clone(),
                    stream.token.clone(),
                    employer_refund,
                );
            }

            stream.status = StreamStatus::Canceled; // Or completed based on business logic, canceled makes sense
            stream.closed_at = now;
        }
    }

    // Mark dispute resolved
    dispute.resolved = true;
    dispute.outcome = MaybeOutcome::Some(outcome.clone());
    PayrollStream::set_stored_dispute(env, stream_id, &dispute);

    PayrollStream::set_stored_stream(env, stream_id, &stream);

    env.events().publish(
        (
            Symbol::new(env, "stream"),
            Symbol::new(env, "dispute_resolved"),
            stream_id,
            arbitrator.clone(),
        ),
        (stream.worker.clone(), stream.employer.clone(), outcome),
    );

    Ok(())
}

// ─── View helpers ─────────────────────────────────────────────────────────────

pub fn get_dispute(env: &Env, stream_id: u64) -> Option<Dispute> {
    PayrollStream::get_stored_dispute(env, stream_id)
}

pub fn has_open_dispute(env: &Env, stream_id: u64) -> bool {
    match get_dispute(env, stream_id) {
        Some(d) => !d.resolved,
        None => false,
    }
}
