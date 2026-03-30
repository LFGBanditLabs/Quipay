#![no_std]
use core::convert::TryFrom;
use quipay_common::{QuipayError, require};
use soroban_sdk::{
    Address, BytesN, Env, IntoVal, Symbol, Vec, contract, contractimpl, contracttype,
};


const MAX_BATCH_CREATE_STREAMS: u32 = 20;
const MAX_BATCH_CLAIM_STREAMS: u32 = 50; // max active streams processed in one batch_claim call
const MAX_BATCH_CANCEL_STREAMS: u32 = 20;
const DEFAULT_MAX_STREAM_DURATION: u64 = 365 * 24 * 60 * 60; // 365 days in seconds
/// Maximum page size for pagination to prevent DoS attacks.
/// Requests exceeding this limit will be capped to this value.
const MAX_PAGE_SIZE: u32 = 1000;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    PendingAdmin,
    Paused,
    NextStreamId,
    RetentionSecs,
    Vault,
    Gateway,
    DaoGovernance,           // Authorized DAO governance contract for gated stream creation
    PendingUpgrade,          // (wasm_hash, execute_after_timestamp)
    EarlyCancelFeeBps,       // Basis points for early cancellation fee (max 1000 = 10%)
    WithdrawalCooldown,      // Minimum seconds a worker must wait between withdrawals
    LastWithdrawal(Address), // Timestamp of last successful withdrawal per worker
    CancellationGracePeriod, // Seconds a stream keeps paying after cancel is requested
    Dispute(u64),            // Active dispute for a stream (stream_id)
    MaxStreamDuration,       // Configurable maximum stream duration in seconds
    MaxStreamsPerEmployer,   // Global default maximum active streams per employer
    EmployerStreamLimit(Address), // Per-employer maximum active stream override
    MinStreamDuration,       // Configurable minimum stream duration in seconds
    Receipt,                 // PayrollReceipt contract address (optional)
    ScheduledPause,          // u64 effective timestamp
    EmergencyMultisig,       // Vec<Address> (3 authorized keys)
    EmergencyPauseVotes,     // Vec<Address> (keys that voted for current pause)
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PendingUpgrade {
    pub wasm_hash: soroban_sdk::BytesN<32>,
    pub execute_after: u64,
    pub proposed_at: u64,
    pub proposed_by: Address,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum StreamStatus {
    Active = 0,
    Canceled = 1,
    Completed = 2,
    Paused = 3,
    PendingCancel = 4,
    Disputed = 5, // New status for streams under dispute
}

/// Resolution outcome chosen by the admin/arbitrator.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]

pub enum DisputeOutcome {
    /// Dispute dismissed — stream unfreezes and resumes from current position.
    Resume = 0,
    /// Stream cancelled; full remaining balance refunded to employer.
    CancelWithRefund = 1,
    /// Stream cancelled; worker gets earned amount, employer gets remainder.
    CancelWithPartialPayout = 2,
}

#[contracttype]
#[derive(Clone)]
pub enum StreamKey {
    Stream(u64),
    EmployerStreams(Address),
    WorkerStreams(Address),
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Stream {
    pub employer: Address,
    pub worker: Address,
    pub token: Address,
    pub rate: i128,
    pub cliff_ts: u64,
    pub start_ts: u64,
    pub end_ts: u64,
    pub total_amount: i128,
    pub withdrawn_amount: i128,
    pub last_withdrawal_ts: u64,
    pub status: StreamStatus,
    pub created_at: u64,
    pub closed_at: u64,
    /// Timestamp when the stream was paused (0 if not currently paused)
    pub paused_at: u64,
    /// Cumulative duration (in seconds) that this stream has been paused.
    ///
    /// This field is used to adjust the effective vesting timeline when calculating
    /// how much has vested. When a stream is paused and resumed, vesting continues
    /// from where it left off by shifting the timeline forward by this amount.
    ///
    /// ### How It Works
    /// - Each time `resume_stream()` is called, the pause duration is added to this field
    /// - The vesting calculation subtracts this from elapsed time: `adjusted_elapsed = elapsed - total_paused_duration`
    /// - This ensures workers are only paid for active (non-paused) time
    ///
    /// ### Example
    /// ```ignore
    /// Stream: 1000 tokens from t=0 to t=100
    /// - Paused at t=30, resumed at t=50: total_paused_duration = 20s
    /// - At t=60: elapsed=60s, adjusted=60-20=40s, vested=400 tokens (correct: 30s + 10s active)
    /// ```
    pub total_paused_duration: u64,
    pub metadata_hash: Option<BytesN<32>>,
    pub cancel_effective_at: u64, // 0 means no pending cancellation; >0 means grace period active
    pub speed_curve: stream_curve::SpeedCurve, // New field for customizable speed curves
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MaybeSpeedCurve {
    None,
    Some(stream_curve::SpeedCurve),
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct StreamParams {
    pub employer: Address,
    pub worker: Address,
    pub token: Address,
    pub rate: i128,
    pub cliff_ts: u64,
    pub start_ts: u64,
    pub end_ts: u64,
    pub metadata_hash: Option<BytesN<32>>,
    pub speed_curve: MaybeSpeedCurve,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct WithdrawResult {
    pub stream_id: u64,
    pub amount: i128,
    pub success: bool,
}

/// Per-stream breakdown emitted inside a BatchClaimed event and returned to callers.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct StreamClaimResult {
    pub stream_id: u64,
    pub token: Address,
    pub amount: i128,
}

/// Return value of `batch_claim`: the per-stream breakdown and the total aggregated
/// per-token payouts that were transferred in this transaction.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct BatchClaimResult {
    pub streams: Vec<StreamClaimResult>,
    pub total_claimed: i128, // sum across all tokens (informational)
}

/// Per-stream result returned by `batch_cancel_streams`.
#[contracttype]
#[derive(Clone, Debug)]
pub struct StreamCancelResult {
    pub stream_id: u64,
    pub success: bool,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct StreamHealth {
    pub solvency_ratio: i128, // Ratio as basis points (10000 = 100%)
    pub days_of_runway: u64,  // Days until insolvency
}

#[contracttype]
#[derive(Clone, Debug)]
struct BatchWithdrawalCandidate {
    stream_id: u64,
    stream: Stream,
    amount: i128,
}

#[contracttype]
#[derive(Clone, Debug)]
enum BatchWithdrawalPlan {
    Result(WithdrawResult),
    Payout(BatchWithdrawalCandidate),
}

const DEFAULT_RETENTION_SECS: u64 = 30 * 24 * 60 * 60;

// Default withdrawal cooldown: 1 hour in seconds
const DEFAULT_WITHDRAWAL_COOLDOWN: u64 = 60 * 60;

// Default cancellation grace period: 7 days in seconds
const DEFAULT_CANCELLATION_GRACE_PERIOD: u64 = 7 * 24 * 60 * 60;

const DEFAULT_MAX_STREAMS_PER_EMPLOYER: u32 = 500;

const DEFAULT_MIN_STREAM_DURATION: u64 = 3600;

// Storage entries (persistent) are automatically archived after their TTL runs out
// unless we explicitly extend TTL. Long-running streams can be left untouched for
// longer than the default TTL, so we bump TTL on each mutation path.
//
// These values are expressed in ledgers (Soroban storage TTL units).
const STORAGE_TTL_THRESHOLD_LEDGER: u32 = 1_000_000;
const STORAGE_TTL_EXTEND_TO_LEDGER: u32 = 1_000_000;

// 48 hours in seconds for timelock
const TIMELOCK_DURATION: u64 = 48 * 60 * 60;

// Maximum early cancellation fee: 1000 basis points = 10%
const MAX_EARLY_CANCEL_FEE_BPS: u32 = 1000;

// Event symbols for timelock
const UPGRADE_PROPOSED: soroban_sdk::Symbol = soroban_sdk::symbol_short!("up_prop");
const UPGRADE_EXECUTED: soroban_sdk::Symbol = soroban_sdk::symbol_short!("up_exec");
const UPGRADE_CANCELED: soroban_sdk::Symbol = soroban_sdk::symbol_short!("up_cancel");
const PAUSE_SCHEDULED: soroban_sdk::Symbol = soroban_sdk::symbol_short!("p_sched");
const PAUSE_CANCELED: soroban_sdk::Symbol = soroban_sdk::symbol_short!("p_cancel");
const EMERGENCY_PAUSED: soroban_sdk::Symbol = soroban_sdk::symbol_short!("em_pause");
const PAUSE_TIMELOCK_DURATION: u64 = 24 * 60 * 60;

#[contract]
pub struct PayrollStream;

#[contractimpl]
impl PayrollStream {
    pub fn init(env: Env, admin: Address) -> Result<(), QuipayError> {
        require!(
            !env.storage().instance().has(&DataKey::Admin),
            QuipayError::AlreadyInitialized
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::NextStreamId, &1u64);
        env.storage()
            .instance()
            .set(&DataKey::RetentionSecs, &DEFAULT_RETENTION_SECS);
        Ok(())
    }

    pub fn set_paused(env: Env, paused: bool) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        if paused {
            let now = env.ledger().timestamp();
            let effective_at = now.saturating_add(PAUSE_TIMELOCK_DURATION);
            env.storage().instance().set(&DataKey::ScheduledPause, &effective_at);
            env.events().publish(
                (Symbol::new(&env, "admin"), PAUSE_SCHEDULED),
                effective_at,
            );
        } else {
            env.storage().instance().set(&DataKey::Paused, &false);
            env.storage().instance().remove(&DataKey::ScheduledPause);
            env.storage().instance().remove(&DataKey::EmergencyPauseVotes);
        }
        Ok(())
    }

    pub fn is_paused(env: Env) -> bool {
        if env.storage().instance().get(&DataKey::Paused).unwrap_or(false) {
            return true;
        }
        if let Some(scheduled_ts) =
            env.storage().instance().get::<DataKey, u64>(&DataKey::ScheduledPause)
        {
            if env.ledger().timestamp() >= scheduled_ts {
                return true;
            }
        }
        false
    }

    pub fn cancel_pause(env: Env) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();

        if env.storage().instance().has(&DataKey::ScheduledPause) {
            env.storage().instance().remove(&DataKey::ScheduledPause);
            env.events().publish((Symbol::new(&env, "admin"), PAUSE_CANCELED), ());
        }
        Ok(())
    }

    pub fn get_scheduled_pause(env: Env) -> Option<u64> {
        env.storage().instance().get(&DataKey::ScheduledPause)
    }

    pub fn set_emergency_multisig(env: Env, addresses: Vec<Address>) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();

        require!(addresses.len() == 3, QuipayError::Custom);
        env.storage().instance().set(&DataKey::EmergencyMultisig, &addresses);
        Ok(())
    }

    pub fn get_emergency_multisig(env: Env) -> Option<Vec<Address>> {
        env.storage().instance().get(&DataKey::EmergencyMultisig)
    }

    pub fn emergency_pause(env: Env, caller: Address) -> Result<(), QuipayError> {
        caller.require_auth();
        let multisig: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::EmergencyMultisig)
            .ok_or(QuipayError::NotInitialized)?;

        let mut is_member = false;
        for i in 0..multisig.len() {
            if multisig.get(i).unwrap() == caller {
                is_member = true;
                break;
            }
        }
        require!(is_member, QuipayError::Unauthorized);

        let mut votes: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::EmergencyPauseVotes)
            .unwrap_or_else(|| Vec::new(&env));

        let mut already_voted = false;
        for i in 0..votes.len() {
            if votes.get(i).unwrap() == caller {
                already_voted = true;
                break;
            }
        }

        if !already_voted {
            votes.push_back(caller);
            env.storage().instance().set(&DataKey::EmergencyPauseVotes, &votes);
        }

        if votes.len() >= 2 {
            env.storage().instance().set(&DataKey::Paused, &true);
            env.storage().instance().remove(&DataKey::ScheduledPause);
            env.storage().instance().remove(&DataKey::EmergencyPauseVotes);
            env.events().publish(
                (Symbol::new(&env, "admin"), EMERGENCY_PAUSED),
                (),
            );
        }
        Ok(())
    }

    pub fn set_retention_secs(env: Env, retention_secs: u64) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::RetentionSecs, &retention_secs);
        Ok(())
    }

    /// Set early cancellation fee as basis points (max 1000 = 10%)
    /// Only admin can call this function
    pub fn set_early_cancel_fee(env: Env, fee_bps: u32) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();

        if fee_bps > MAX_EARLY_CANCEL_FEE_BPS {
            return Err(QuipayError::FeeTooHigh);
        }

        env.storage()
            .instance()
            .set(&DataKey::EarlyCancelFeeBps, &fee_bps);
        Ok(())
    }

    /// Set the minimum seconds a worker must wait between withdrawals.
    /// A value of 0 disables the cooldown entirely. Only admin can call this.
    pub fn set_withdrawal_cooldown(env: Env, seconds: u64) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::WithdrawalCooldown, &seconds);
        Ok(())
    }

    /// Get the currently configured withdrawal cooldown in seconds.
    /// Returns the 1-hour default when the admin has never configured it.
    pub fn get_withdrawal_cooldown(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::WithdrawalCooldown)
            .unwrap_or(DEFAULT_WITHDRAWAL_COOLDOWN)
    }

    /// Set the cancellation grace period in seconds.
    /// During this window the stream keeps paying before it fully stops.
    /// A value of 0 disables the grace period (immediate cancellation). Only admin can call this.
    pub fn set_cancellation_grace_period(env: Env, seconds: u64) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::CancellationGracePeriod, &seconds);
        Ok(())
    }

    /// Get the currently configured cancellation grace period in seconds.
    /// Returns the 7-day default when the admin has never configured it.
    pub fn get_cancellation_grace_period(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::CancellationGracePeriod)
            .unwrap_or(DEFAULT_CANCELLATION_GRACE_PERIOD)
    }

    /// Set the maximum allowed stream duration in seconds.
    /// Only admin can call this. The value must be at least 1 second.
    pub fn set_max_stream_duration(env: Env, seconds: u64) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();

        require!(seconds > 0, QuipayError::InvalidTimeRange);

        env.storage()
            .instance()
            .set(&DataKey::MaxStreamDuration, &seconds);
        Ok(())
    }

    /// Get the currently configured maximum stream duration in seconds.
    /// Returns the 365-day default when the admin has never configured it.
    pub fn get_max_stream_duration(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::MaxStreamDuration)
            .unwrap_or(DEFAULT_MAX_STREAM_DURATION)
    }

    /// Set the minimum allowed duration for a stream in seconds.
    /// Only admin can call this function.
    pub fn set_min_stream_duration(env: Env, seconds: u64) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::MinStreamDuration, &seconds);
        Ok(())
    }

    /// Get the current minimum allowed duration for a stream in seconds.
    pub fn get_min_stream_duration(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::MinStreamDuration)
            .unwrap_or(DEFAULT_MIN_STREAM_DURATION)
    }
 
    /// Set the global default maximum number of active streams per employer.
    /// Only admin can call this function.
    pub fn set_max_streams_per_employer(env: Env, limit: u32) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
 
        env.storage()
            .instance()
            .set(&DataKey::MaxStreamsPerEmployer, &limit);
        Ok(())
    }
 
    /// Get the current global default maximum active streams per employer.
    pub fn get_max_streams_per_employer(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::MaxStreamsPerEmployer)
            .unwrap_or(DEFAULT_MAX_STREAMS_PER_EMPLOYER)
    }
 
    /// Set a custom active stream limit for a specific employer.
    /// This override takes precedence over the global default. Only admin can call this.
    pub fn set_employer_stream_limit(env: Env, employer: Address, limit: u32) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
 
        env.storage()
            .instance()
            .set(&DataKey::EmployerStreamLimit(employer), &limit);
        Ok(())
    }
 
    /// Get the effective active stream limit for a specific employer.
    /// Returns the override if set, otherwise returns the global default.
    pub fn get_employer_stream_limit(env: Env, employer: Address) -> u32 {
        if let Some(limit) = env
            .storage()
            .instance()
            .get(&DataKey::EmployerStreamLimit(employer.clone()))
        {
            limit
        } else {
            Self::get_max_streams_per_employer(env)
        }
    }

    /// Set the vault contract address for payroll operations
    /// Only admin can call this function
    pub fn set_vault(env: Env, vault: Address) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Vault, &vault);
        Ok(())
    }

    /// Register the PayrollReceipt contract so receipts are minted on stream closure.
    /// Pass `None` to disable receipt minting.
    pub fn set_receipt_contract(
        env: Env,
        receipt_contract: Option<Address>,
    ) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        match receipt_contract {
            Some(addr) => env.storage().instance().set(&DataKey::Receipt, &addr),
            None => env.storage().instance().remove(&DataKey::Receipt),
        }
        Ok(())
    }

    pub fn get_receipt_contract(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Receipt)
    }

    pub fn get_admin(env: Env) -> Result<Address, QuipayError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)
    }

    pub fn get_pending_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::PendingAdmin)
    }

    pub fn propose_admin(env: Env, new_admin: Address) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();

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

    pub fn transfer_admin(env: Env, new_admin: Address) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &new_admin);
        env.storage().instance().remove(&DataKey::PendingAdmin);
        Ok(())
    }

    /// Create a new payroll stream.
    ///
    /// ### Time Granularity
    /// - `start_ts` must be greater than or equal to the current ledger timestamp.
    /// - Ledger timestamps have block-level precision (not second-precise).
    /// - Streams starting in the same block as creation (`start_ts == now`) are allowed.
    pub fn create_stream(
        env: Env,
        employer: Address,
        worker: Address,
        token: Address,
        rate: i128,
        cliff_ts: u64,
        start_ts: u64,
        end_ts: u64,
        metadata_hash: Option<BytesN<32>>,
        speed_curve: Option<stream_curve::SpeedCurve>,
    ) -> Result<u64, QuipayError> {
        Self::require_not_paused(&env)?;
        employer.require_auth();

        // Call the internal create stream logic
        let stream_id = Self::create_stream_internal(
            env.clone(),
            employer.clone(),
            worker.clone(),
            token.clone(),
            rate,
            cliff_ts,
            start_ts,
            end_ts,
            metadata_hash,
            speed_curve,
        )?;

        env.events().publish(
            (
                Symbol::new(&env, "stream"),
                Symbol::new(&env, "created"),
                worker,
                employer,
            ),
            (stream_id, token, rate, start_ts, end_ts),
        );

        Ok(stream_id)
    }

    /// Creates multiple streams atomically and optionally deposits a lump sum into the vault.
    /// This is significantly more gas-efficient than calling create_stream individually
    /// as it groups vault interactions into single calls.
    pub fn create_stream_batch(
        env: Env,
        params: Vec<StreamParams>,
        vault_deposit: i128,
    ) -> Result<Vec<u64>, QuipayError> {
        Self::require_not_paused(&env)?;

        if params.len() > MAX_BATCH_CREATE_STREAMS {
            return Err(QuipayError::BatchTooLarge);
        }
        if params.is_empty() {
            return Ok(Vec::new(&env));
        }

        // All streams in a batch must share the same employer and token for atomic funding
        let first_param = params.get(0).ok_or(QuipayError::InvalidAmount)?;
        let authorized_employer = first_param.employer.clone();
        let token = first_param.token.clone();
        authorized_employer.require_auth();

        let vault: Address = env
            .storage()
            .instance()
            .get(&DataKey::Vault)
            .ok_or(QuipayError::NotInitialized)?;

        let mut total_liability: i128 = 0;
        let mut validated_params = Vec::new(&env);

        // Phase 1: Pre-validation and liability calculation
        for param in params.iter() {
            if param.employer != authorized_employer || param.token != token {
                return Err(QuipayError::Custom); // Batch must be homogeneous (same employer/token)
            }
            
            if param.rate <= 0 || param.end_ts <= param.start_ts {
                return Err(QuipayError::InvalidAmount);
            }

            let duration = param.end_ts.saturating_sub(param.start_ts);
            let duration_i = i128::try_from(duration).map_err(|_| QuipayError::Overflow)?;
            let stream_total = param.rate
                .checked_mul(duration_i)
                .ok_or(QuipayError::Overflow)?;
            
            total_liability = total_liability.checked_add(stream_total).ok_or(QuipayError::Overflow)?;
            validated_params.push_back(param);
        }

        // Phase 2: Atomic Vault Interaction
        if vault_deposit > 0 {
            // Optionally fund the treasury first
            env.invoke_contract::<()>(
                &vault,
                &Symbol::new(&env, "deposit"),
                soroban_sdk::vec![&env, authorized_employer.into_val(&env), token.into_val(&env), vault_deposit.into_val(&env)],
            );
        }

        // Single solvency check for the entire batch
        let solvent: bool = env.invoke_contract(
            &vault,
            &Symbol::new(&env, "check_solvency"),
            soroban_sdk::vec![&env, token.clone().into_val(&env), total_liability.into_val(&env)],
        );
        require!(solvent, QuipayError::InsufficientBalance);

        // Single liability update
        env.invoke_contract::<()>(
            &vault,
            &Symbol::new(&env, "add_liability"),
            soroban_sdk::vec![&env, token.clone().into_val(&env), total_liability.into_val(&env)],
        );

        // Phase 3: Record Creation
        let mut next_id: u64 = env.storage().instance().get(&DataKey::NextStreamId).unwrap_or(1);
        let mut created_ids = Vec::new(&env);
        let now = env.ledger().timestamp();

        for param in validated_params.iter() {
            let stream_id = next_id;
            next_id += 1;

            let duration_i = i128::try_from(param.end_ts - param.start_ts)
                .map_err(|_| QuipayError::Overflow)?;
            let total_amount = param.rate
                .checked_mul(duration_i)
                .ok_or(QuipayError::Overflow)?;

            let stream = Stream {
                employer: authorized_employer.clone(),
                worker: param.worker.clone(),
                token: token.clone(),
                rate: param.rate,
                cliff_ts: if param.cliff_ts <= param.start_ts { param.start_ts } else { param.cliff_ts },
                start_ts: param.start_ts,
                end_ts: param.end_ts,
                total_amount,
                withdrawn_amount: 0,
                last_withdrawal_ts: 0,
                status: StreamStatus::Active,
                created_at: now,
                closed_at: 0,
                paused_at: 0,
                total_paused_duration: 0,
                metadata_hash: param.metadata_hash.clone(),
                cancel_effective_at: 0,
                speed_curve: match param.speed_curve { MaybeSpeedCurve::Some(c) => c, _ => stream_curve::SpeedCurve::Linear },
            };

            env.storage().persistent().set(&StreamKey::Stream(stream_id), &stream);
            created_ids.push_back(stream_id);

            // Update employer index
            let emp_key = StreamKey::EmployerStreams(authorized_employer.clone());
            let mut emp_ids: Vec<u64> = env.storage().persistent().get(&emp_key)
                .unwrap_or_else(|| Vec::new(&env));
            emp_ids.push_back(stream_id);
            env.storage().persistent().set(&emp_key, &emp_ids);

            // Update worker index
            let wrk_key = StreamKey::WorkerStreams(param.worker.clone());
            let mut wrk_ids: Vec<u64> = env.storage().persistent().get(&wrk_key)
                .unwrap_or_else(|| Vec::new(&env));
            wrk_ids.push_back(stream_id);
            env.storage().persistent().set(&wrk_key, &wrk_ids);

            // Emit individual events for downstream indexers
            env.events().publish(
                (Symbol::new(&env, "stream"), Symbol::new(&env, "created"), param.worker.clone(), authorized_employer.clone()),
                (stream_id, token.clone(), param.rate, param.start_ts, param.end_ts),
            );
        }

        env.storage().instance().set(&DataKey::NextStreamId, &next_id);
        Ok(created_ids)
    }

    /// Withdraw vested funds from a stream.
    ///
    /// ### Paused Streams
    /// - If a stream is paused, vesting stops at the `paused_at` timestamp.
    /// - The worker can still withdraw any amount that was vested up to the pause time.
    /// - The available amount is calculated as `vested_at(paused_at) - withdrawn_amount`.
    pub fn withdraw(env: Env, stream_id: u64, worker: Address) -> Result<i128, QuipayError> {
        Self::require_not_paused(&env)?;
        worker.require_auth();

        let key = StreamKey::Stream(stream_id);
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(QuipayError::StreamNotFound)?;

        if stream.worker != worker {
            return Err(QuipayError::Unauthorized);
        }
        if Self::is_closed(&stream) {
            return Err(QuipayError::StreamClosed);
        }

        if stream.status == StreamStatus::Disputed {
            return Err(QuipayError::StreamNotFound);
        }

        let now = env.ledger().timestamp();

        // Enforce per-worker withdrawal cooldown
        let cooldown: u64 = env
            .storage()
            .instance()
            .get(&DataKey::WithdrawalCooldown)
            .unwrap_or(DEFAULT_WITHDRAWAL_COOLDOWN);
        if cooldown > 0 {
            let last_ts: u64 = env
                .storage()
                .persistent()
                .get(&DataKey::LastWithdrawal(worker.clone()))
                .unwrap_or(0);
            if now < last_ts.saturating_add(cooldown) {
                return Err(QuipayError::WithdrawalCooldown);
            }
        }

        let vested = Self::vested_amount(&stream, now);
        let available = vested.checked_sub(stream.withdrawn_amount).unwrap_or(0);

        // Keep the stream state and worker index entry alive even if there's
        // nothing available to withdraw yet.
        Self::bump_stream_storage_ttl(&env, stream_id, &worker);

        if available <= 0 {
            return Ok(0);
        }

        let vault: Address = env
            .storage()
            .instance()
            .get(&DataKey::Vault)
            .ok_or(QuipayError::NotInitialized)?;

        Self::call_vault_payout(
            &env,
            &vault,
            worker.clone(),
            stream.token.clone(),
            available,
        );

        stream.withdrawn_amount = stream
            .withdrawn_amount
            .checked_add(available)
            .ok_or(QuipayError::Overflow)?;
        stream.last_withdrawal_ts = now;

        if stream.withdrawn_amount >= stream.total_amount {
            Self::close_stream_internal(&mut stream, now, StreamStatus::Completed);
        }

        env.storage().persistent().set(&key, &stream);

        // Record this withdrawal timestamp for cooldown enforcement
        env.storage()
            .persistent()
            .set(&DataKey::LastWithdrawal(worker.clone()), &now);

        env.events().publish(
            (
                Symbol::new(&env, "stream"),
                Symbol::new(&env, "withdrawn"),
                stream_id,
                worker.clone(),
            ),
            (available, stream.token.clone()),
        );

        // Mint receipt if stream just completed
        if stream.status == StreamStatus::Completed {
            Self::try_mint_receipt(&env, &stream, stream_id, 0u32); // 0 = Completed
        }

        Ok(available)
    }

    /// NOTE: This function is atomic. If any single payout fails, the entire batch reverts.
    /// Invalid, closed, and zero-available streams are pre-validated before payout calls begin.
    pub fn batch_withdraw(
        env: Env,
        stream_ids: Vec<u64>,
        caller: Address,
    ) -> Result<Vec<WithdrawResult>, QuipayError> {
        Self::require_not_paused(&env)?;
        caller.require_auth();

        let now = env.ledger().timestamp();
        let vault: Address = env
            .storage()
            .instance()
            .get(&DataKey::Vault)
            .ok_or(QuipayError::NotInitialized)?;

        // Enforce per-worker withdrawal cooldown for the entire batch
        let cooldown: u64 = env
            .storage()
            .instance()
            .get(&DataKey::WithdrawalCooldown)
            .unwrap_or(DEFAULT_WITHDRAWAL_COOLDOWN);
        if cooldown > 0 {
            let last_ts: u64 = env
                .storage()
                .persistent()
                .get(&DataKey::LastWithdrawal(caller.clone()))
                .unwrap_or(0);
            if now < last_ts.saturating_add(cooldown) {
                return Err(QuipayError::WithdrawalCooldown);
            }
        }

        let mut plans: Vec<BatchWithdrawalPlan> = Vec::new(&env);
        let mut results: Vec<WithdrawResult> = Vec::new(&env);

        let mut idx = 0u32;
        while idx < stream_ids.len() {
            let Some(stream_id) = stream_ids.get(idx) else {
                results.push_back(WithdrawResult {
                    stream_id: 0,
                    amount: 0,
                    success: false,
                });
                idx += 1;
                continue;
            };
            let key = StreamKey::Stream(stream_id);

            let plan = match env.storage().persistent().get::<StreamKey, Stream>(&key) {
                Some(stream) => {
                    if stream.worker != caller {
                        BatchWithdrawalPlan::Result(WithdrawResult {
                            stream_id,
                            amount: 0,
                            success: false,
                        })
                    } else if Self::is_closed(&stream) {
                        BatchWithdrawalPlan::Result(WithdrawResult {
                            stream_id,
                            amount: 0,
                            success: false,
                        })
                    } else if stream.status == StreamStatus::Disputed {
                        BatchWithdrawalPlan::Result(WithdrawResult {
                            stream_id,
                            amount: 0,
                            success: false,
                        })
                    } else {
                        let vested = Self::vested_amount(&stream, now);
                        let available = vested.checked_sub(stream.withdrawn_amount).unwrap_or(0);

                        if available <= 0 {
                            // Keep the stream state and worker index entry alive
                            // even if there's nothing available to withdraw yet.
                            Self::bump_stream_storage_ttl(&env, stream_id, &caller);
                            BatchWithdrawalPlan::Result(WithdrawResult {
                                stream_id,
                                amount: 0,
                                success: true,
                            })
                        } else {
                            BatchWithdrawalPlan::Payout(BatchWithdrawalCandidate {
                                stream_id,
                                stream,
                                amount: available,
                            })
                        }
                    }
                }
                None => BatchWithdrawalPlan::Result(WithdrawResult {
                    stream_id,
                    amount: 0,
                    success: false,
                }),
            };

            plans.push_back(plan);
            idx += 1;
        }

        let mut plan_idx = 0u32;
        while plan_idx < plans.len() {
            let Some(plan) = plans.get(plan_idx) else {
                break;
            };
            let result = match plan {
                BatchWithdrawalPlan::Result(result) => result,
                BatchWithdrawalPlan::Payout(candidate) => {
                    let key = StreamKey::Stream(candidate.stream_id);
                    let mut stream = candidate.stream;
                    let available = candidate.amount;

                    Self::call_vault_payout(
                        &env,
                        &vault,
                        caller.clone(),
                        stream.token.clone(),
                        available,
                    );

                    stream.withdrawn_amount = stream
                        .withdrawn_amount
                        .checked_add(available)
                        .ok_or(QuipayError::Overflow)?;
                    stream.last_withdrawal_ts = now;

                    if stream.withdrawn_amount >= stream.total_amount {
                        Self::close_stream_internal(&mut stream, now, StreamStatus::Completed);
                    }

                    env.storage().persistent().set(&key, &stream);
                    // Keep both the stream state and the worker index entry alive.
                    Self::bump_stream_storage_ttl(&env, candidate.stream_id, &caller);

                    // Record this withdrawal timestamp for cooldown enforcement
                    env.storage()
                        .persistent()
                        .set(&DataKey::LastWithdrawal(caller.clone()), &now);

                    env.events().publish(
                        (
                            Symbol::new(&env, "stream"),
                            Symbol::new(&env, "withdrawn"),
                            candidate.stream_id,
                            caller.clone(),
                        ),
                        (available, stream.token.clone()),
                    );

                    // Mint receipt if stream just completed
                    if stream.status == StreamStatus::Completed {
                        Self::try_mint_receipt(&env, &stream, candidate.stream_id, 0u32);
                    }

                    WithdrawResult {
                        stream_id: candidate.stream_id,
                        amount: available,
                        success: true,
                    }
                }
            };

            results.push_back(result);
            plan_idx += 1;
        }

        Ok(results)
    }

    /// Claim all available funds across **every active stream** belonging to `worker`
    /// in a single transaction.
    ///
    /// Unlike `batch_withdraw` (which requires the caller to supply stream IDs),
    /// `batch_claim` automatically discovers all streams indexed under the worker's
    /// address, filters to those with a positive withdrawable balance, groups the
    /// amounts by token, and issues **one vault payout call per distinct token**.
    ///
    /// ### Returns
    /// A [`BatchClaimResult`] containing:
    /// - `streams`: per-stream breakdown (stream_id, token, amount claimed).
    /// - `total_claimed`: sum of all amounts across all tokens (informational).
    ///
    /// ### Limits
    /// At most `MAX_BATCH_CLAIM_STREAMS` streams are processed per call. Workers
    /// with more streams should use `batch_withdraw` with explicit IDs.
    ///
    /// ### Events
    /// Emits a single `stream / batch_claimed` event carrying the worker address
    /// and the per-stream breakdown, plus individual `stream / withdrawn` events
    /// for each stream that had a positive balance (matching single-`withdraw`
    /// semantics so downstream indexers don't need special-casing).
    pub fn batch_claim(env: Env, worker: Address) -> Result<BatchClaimResult, QuipayError> {
        Self::require_not_paused(&env)?;
        worker.require_auth();

        let now = env.ledger().timestamp();

        // Enforce per-worker withdrawal cooldown across the whole batch.
        let cooldown: u64 = env
            .storage()
            .instance()
            .get(&DataKey::WithdrawalCooldown)
            .unwrap_or(DEFAULT_WITHDRAWAL_COOLDOWN);
        if cooldown > 0 {
            let last_ts: u64 = env
                .storage()
                .persistent()
                .get(&DataKey::LastWithdrawal(worker.clone()))
                .unwrap_or(0);
            if now < last_ts.saturating_add(cooldown) {
                return Err(QuipayError::WithdrawalCooldown);
            }
        }

        let vault: Address = env
            .storage()
            .instance()
            .get(&DataKey::Vault)
            .ok_or(QuipayError::NotInitialized)?;

        // Load all stream IDs for this worker from the persistent index.
        let all_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&StreamKey::WorkerStreams(worker.clone()))
            .unwrap_or_else(|| Vec::new(&env));

        // ── Phase 1: scan streams, collect candidates ─────────────────────
        // ── Phase 1: scan streams, collect candidates ─────────────────────
        // Per-token totals are tracked with parallel vecs (token_keys / token_amounts)
        // to stay no_std compatible without needing Map.
        let mut stream_results: Vec<StreamClaimResult> = Vec::new(&env);
        let mut token_keys: Vec<Address> = Vec::new(&env);
        let mut token_amounts: Vec<i128> = Vec::new(&env);

        // Mutable snapshots we'll write back in phase 2.
        // store as (stream_id, updated_stream) pairs; we reuse the same ordering.
        let mut payable_stream_ids: Vec<u64> = Vec::new(&env);
        let mut payable_streams: Vec<Stream> = Vec::new(&env);
        let mut payable_amounts: Vec<i128> = Vec::new(&env);

        let mut total_claimed: i128 = 0i128;
        let mut processed: u32 = 0;
        let mut idx: u32 = 0;

        while idx < all_ids.len() && processed < MAX_BATCH_CLAIM_STREAMS {
            let Some(stream_id) = all_ids.get(idx) else {
                idx += 1;
                continue;
            };
            idx += 1;

            let key = StreamKey::Stream(stream_id);
            let Some(mut stream) = env.storage().persistent().get::<StreamKey, Stream>(&key) else {
                processed += 1;
                continue;
            };

            // Skip closed streams — they have nothing left to pay.
            if Self::is_closed(&stream) {
                processed += 1;
                continue;
            }

            if stream.status == StreamStatus::Disputed {
                processed += 1;
                continue;
            }

            let vested = Self::vested_amount(&stream, now);
            let available = vested.checked_sub(stream.withdrawn_amount).unwrap_or(0);

            if available <= 0 {
                // Keep storage alive even with zero balance.
                Self::bump_stream_storage_ttl(&env, stream_id, &worker);
                processed += 1;
                continue;
            }

            // Update the stream state immediately (withdrawn_amount, ts, status).
            stream.withdrawn_amount = stream
                .withdrawn_amount
                .checked_add(available)
                .ok_or(QuipayError::Overflow)?;
            stream.last_withdrawal_ts = now;
            if stream.withdrawn_amount >= stream.total_amount {
                Self::close_stream_internal(&mut stream, now, StreamStatus::Completed);
            }

            // Accumulate per-token totals.
            let mut found_token = false;
            let mut tidx: u32 = 0;
            while tidx < token_keys.len() {
                if let (Some(k), Some(v)) = (token_keys.get(tidx), token_amounts.get(tidx)) {
                    if k == stream.token {
                        let new_total = v.checked_add(available).ok_or(QuipayError::Overflow)?;
                        token_amounts.set(tidx, new_total);
                        found_token = true;
                        break;
                    }
                }
                tidx += 1;
            }
            if !found_token {
                token_keys.push_back(stream.token.clone());
                token_amounts.push_back(available);
            }

            total_claimed = total_claimed
                .checked_add(available)
                .ok_or(QuipayError::Overflow)?;

            stream_results.push_back(StreamClaimResult {
                stream_id,
                token: stream.token.clone(),
                amount: available,
            });

            payable_stream_ids.push_back(stream_id);
            payable_streams.push_back(stream);
            payable_amounts.push_back(available);

            processed += 1;
        }

        // Nothing to pay — return early without touching vault or storage.
        if total_claimed == 0 {
            return Ok(BatchClaimResult {
                streams: stream_results,
                total_claimed: 0,
            });
        }

        // ── Phase 2: issue one vault payout per token ─────────────────────
        let mut tidx: u32 = 0;
        while tidx < token_keys.len() {
            if let (Some(token), Some(amount)) = (token_keys.get(tidx), token_amounts.get(tidx)) {
                Self::call_vault_payout(&env, &vault, worker.clone(), token, amount);
            }
            tidx += 1;
        }

        // ── Phase 3: persist updated stream states ────────────────────────
        let mut sidx: u32 = 0;
        while sidx < payable_stream_ids.len() {
            if let (Some(stream_id), Some(stream), Some(amount)) = (
                payable_stream_ids.get(sidx),
                payable_streams.get(sidx),
                payable_amounts.get(sidx),
            ) {
                let key = StreamKey::Stream(stream_id);
                env.storage().persistent().set(&key, &stream);
                Self::bump_stream_storage_ttl(&env, stream_id, &worker);

                // Per-stream withdrawn event (mirrors single withdraw — indexers see it).
                env.events().publish(
                    (
                        Symbol::new(&env, "stream"),
                        Symbol::new(&env, "withdrawn"),
                        stream_id,
                        worker.clone(),
                    ),
                    (amount, stream.token.clone()),
                );
            }
            sidx += 1;
        }

        // Record cooldown timestamp once for the whole batch.
        env.storage()
            .persistent()
            .set(&DataKey::LastWithdrawal(worker.clone()), &now);

        // ── Single BatchClaimed event with full breakdown ──────────────────
        env.events().publish(
            (
                Symbol::new(&env, "stream"),
                Symbol::new(&env, "batch_claimed"),
                worker.clone(),
            ),
            (total_claimed, stream_results.clone()),
        );

        Ok(BatchClaimResult {
            streams: stream_results,
            total_claimed,
        })
    }

    pub fn transfer_stream(
        env: Env,
        stream_id: u64,
        new_recipient: Address,
        employer: Address,
    ) -> Result<(), QuipayError> {
        Self::require_not_paused(&env)?;
        employer.require_auth();

        let key = StreamKey::Stream(stream_id);
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(QuipayError::StreamNotFound)?;

        if stream.status == StreamStatus::Canceled
            || stream.status == StreamStatus::Completed
            || stream.status == StreamStatus::PendingCancel
        {
            return Err(QuipayError::StreamClosed);
        }

        if stream.employer != employer {
            return Err(QuipayError::Unauthorized);
        }

        let old_recipient = stream.worker.clone();
        if old_recipient == new_recipient {
            return Ok(());
        }

        // Update worker indices: remove from old, add to new
        Self::remove_from_index(&env, StreamKey::WorkerStreams(old_recipient.clone()), stream_id);

        let wrk_key = StreamKey::WorkerStreams(new_recipient.clone());
        let mut wrk_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&wrk_key)
            .unwrap_or_else(|| Vec::new(&env));
        wrk_ids.push_back(stream_id);
        env.storage().persistent().set(&wrk_key, &wrk_ids);

        // Update the stream recipient
        stream.worker = new_recipient.clone();
        env.storage().persistent().set(&key, &stream);

        // Ensure the new worker's index and the stream state have their TTL extended
        Self::bump_stream_storage_ttl(&env, stream_id, &new_recipient);

        env.events().publish(
            (
                Symbol::new(&env, "stream"),
                Symbol::new(&env, "transferred"),
                stream_id,
            ),
            (old_recipient, new_recipient),
        );

        Ok(())
    }

    pub fn cancel_stream(
        env: Env,
        stream_id: u64,
        caller: Address,
        gateway: Option<Address>,
    ) -> Result<(), QuipayError> {
        Self::require_not_paused(&env)?;
        caller.require_auth();

        let key = StreamKey::Stream(stream_id);
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(QuipayError::StreamNotFound)?;

        if stream.employer != caller {
            let gateway_addr = gateway.ok_or(QuipayError::Unauthorized)?;
            let admin: Address = env.invoke_contract(
                &gateway_addr,
                &soroban_sdk::Symbol::new(&env, "get_admin"),
                soroban_sdk::vec![&env],
            );
            if admin != stream.employer {
                return Err(QuipayError::Unauthorized);
            }
            let is_auth: bool = env.invoke_contract(
                &gateway_addr,
                &soroban_sdk::Symbol::new(&env, "is_authorized"),
                soroban_sdk::vec![
                    &env,
                    caller.clone().into_val(&env),
                    1u32.into_val(&env), // Permission::ExecutePayroll
                ],
            );
            if !is_auth {
                return Err(QuipayError::Unauthorized);
            }
        }

        if Self::is_closed(&stream) {
            return Ok(());
        }

        let now = env.ledger().timestamp();

        // If already pending cancel → idempotent
        if stream.status == StreamStatus::PendingCancel {
            return Ok(());
        }

        // // If a grace period is already pending and hasn't expired yet, nothing to do.
        // if stream.cancel_effective_at > 0 && now < stream.cancel_effective_at {
        //     return Err(QuipayError::GracePeriodActive);
        // }

        // If the grace period has already elapsed, finalize the cancellation now.
        if stream.cancel_effective_at > 0 && now >= stream.cancel_effective_at {
            return Self::finalize_cancel(&env, stream_id, &key, &mut stream, now);
        }

        // ── First call: set the grace period ────────────────────────────────
        let grace: u64 = env
            .storage()
            .instance()
            .get(&DataKey::CancellationGracePeriod)
            .unwrap_or(DEFAULT_CANCELLATION_GRACE_PERIOD);

        if grace == 0 {
            // Grace period disabled — cancel immediately.
            return Self::finalize_cancel(&env, stream_id, &key, &mut stream, now);
        }

        stream.cancel_effective_at = now.saturating_add(grace);
        stream.status = StreamStatus::PendingCancel;
        env.storage().persistent().set(&key, &stream);

        env.events().publish(
            (
                soroban_sdk::Symbol::new(&env, "stream"),
                soroban_sdk::Symbol::new(&env, "cancel_scheduled"),
                stream_id,
                caller.clone(),
            ),
            (stream.worker.clone(), stream.cancel_effective_at),
        );

        Ok(())
    }

    /// Cancel multiple streams in a single call.
    ///
    /// Requires employer auth once. Each stream is cancelled individually; a
    /// failure on one stream (not found, wrong employer, already closed) is
    /// recorded in the result and does not abort the rest of the batch.
    /// Respects the configured cancellation grace period exactly as the single
    /// `cancel_stream` does, emitting `cancel_scheduled` or `canceled` events
    /// per stream accordingly.
    pub fn batch_cancel_streams(
        env: Env,
        stream_ids: Vec<u64>,
        employer: Address,
    ) -> Result<Vec<StreamCancelResult>, QuipayError> {
        Self::require_not_paused(&env)?;
        employer.require_auth();

        if stream_ids.len() > MAX_BATCH_CANCEL_STREAMS {
            return Err(QuipayError::BatchTooLarge);
        }

        let now = env.ledger().timestamp();
        let grace: u64 = env
            .storage()
            .instance()
            .get(&DataKey::CancellationGracePeriod)
            .unwrap_or(DEFAULT_CANCELLATION_GRACE_PERIOD);

        let mut results: Vec<StreamCancelResult> = Vec::new(&env);
        let mut idx = 0u32;

        while idx < stream_ids.len() {
            let Some(stream_id) = stream_ids.get(idx) else {
                results.push_back(StreamCancelResult {
                    stream_id: 0,
                    success: false,
                });
                idx += 1;
                continue;
            };

            let key = StreamKey::Stream(stream_id);
            let stream_opt: Option<Stream> = env.storage().persistent().get(&key);

            let success = match stream_opt {
                None => false,
                Some(mut stream) => {
                    if stream.employer != employer {
                        false
                    } else if Self::is_closed(&stream) {
                        // Already cancelled or completed — idempotent success.
                        true
                    } else if stream.status == StreamStatus::PendingCancel {
                        // Grace period already running — finalize if elapsed, else idempotent.
                        if stream.cancel_effective_at > 0 && now >= stream.cancel_effective_at {
                            Self::finalize_cancel(&env, stream_id, &key, &mut stream, now)
                                .is_ok()
                        } else {
                            true
                        }
                    } else if grace == 0 {
                        // Grace period disabled — cancel immediately.
                        Self::finalize_cancel(&env, stream_id, &key, &mut stream, now).is_ok()
                    } else {
                        // Schedule cancellation with grace period.
                        stream.cancel_effective_at = now.saturating_add(grace);
                        stream.status = StreamStatus::PendingCancel;
                        env.storage().persistent().set(&key, &stream);
                        Self::bump_stream_storage_ttl(&env, stream_id, &stream.worker);

                        env.events().publish(
                            (
                                Symbol::new(&env, "stream"),
                                Symbol::new(&env, "cancel_scheduled"),
                                stream_id,
                                employer.clone(),
                            ),
                            (stream.worker.clone(), stream.cancel_effective_at),
                        );
                        true
                    }
                }
            };

            results.push_back(StreamCancelResult { stream_id, success });
            idx += 1;
        }

        Ok(results)
    }

    /// Force-cancel a stream immediately, bypassing the grace period.
    /// Only the admin can call this function.
    pub fn force_cancel_stream(env: Env, stream_id: u64) -> Result<(), QuipayError> {
        Self::require_not_paused(&env)?;

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();

        let key = StreamKey::Stream(stream_id);
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(QuipayError::StreamNotFound)?;

        if Self::is_closed(&stream) {
            return Ok(());
        }

        let now = env.ledger().timestamp();
        Self::finalize_cancel(&env, stream_id, &key, &mut stream, now)
    }

    /// Internal helper: pay accrued amount, remove remaining liability, and mark stream Canceled.
    fn finalize_cancel(
        env: &Env,
        stream_id: u64,
        key: &StreamKey,
        stream: &mut Stream,
        now: u64,
    ) -> Result<(), QuipayError> {
        // Use cancel_effective_at as the vesting ceiling when in grace period.
        let vesting_cap = if stream.cancel_effective_at > 0 {
            core::cmp::min(now, stream.cancel_effective_at)
        } else {
            now
        };

        let vested = Self::vested_amount_at(stream, vesting_cap);
        let owed = vested.checked_sub(stream.withdrawn_amount).unwrap_or(0);

        let vault: Address = env
            .storage()
            .instance()
            .get(&DataKey::Vault)
            .ok_or(QuipayError::NotInitialized)?;

        if owed > 0 {
            Self::call_vault_payout(
                env,
                &vault,
                stream.worker.clone(),
                stream.token.clone(),
                owed,
            );
            stream.withdrawn_amount = stream
                .withdrawn_amount
                .checked_add(owed)
                .ok_or(QuipayError::Overflow)?;
            stream.last_withdrawal_ts = now;
        }

        let remaining_liability = stream
            .total_amount
            .checked_sub(stream.withdrawn_amount)
            .ok_or(QuipayError::Overflow)?;

        let cancel_fee = Self::calculate_early_cancel_fee(env, remaining_liability);

        if remaining_liability > 0 {
            Self::call_vault_remove_liability(
                env,
                &vault,
                stream.token.clone(),
                remaining_liability,
            );

            if cancel_fee > 0 {
                Self::call_vault_payout(
                    env,
                    &vault,
                    stream.worker.clone(),
                    stream.token.clone(),
                    cancel_fee,
                );
            }
        }

        Self::close_stream_internal(stream, now, StreamStatus::Canceled);
        env.storage().persistent().set(key, stream);

        env.events().publish(
            (
                soroban_sdk::Symbol::new(env, "stream"),
                soroban_sdk::Symbol::new(env, "canceled"),
                stream_id,
                stream.employer.clone(),
            ),
            (stream.worker.clone(), stream.token.clone()),
        );

        Self::try_mint_receipt(env, stream, stream_id, 1u32); // 1 = Cancelled

        stream.status = StreamStatus::Canceled;
        stream.closed_at = now;

        Ok(())
    }

    /// Set the authorized AutomationGateway contract address.
    /// Only the admin can call this.
    pub fn set_gateway(env: Env, gateway: Address) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Gateway, &gateway);
        Ok(())
    }

    /// Get the authorized AutomationGateway contract address.
    pub fn get_gateway(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Gateway)
    }

    /// Create a stream via an authorized AutomationGateway on behalf of an employer.
    /// Only the registered gateway can call this method.
    pub fn create_stream_via_gateway(
        env: Env,
        employer: Address,
        worker: Address,
        token: Address,
        rate: i128,
        cliff_ts: u64,
        start_ts: u64,
        end_ts: u64,
        metadata_hash: Option<BytesN<32>>,
    ) -> Result<u64, QuipayError> {
        Self::require_not_paused(&env)?;

        // Verify the caller is the authorized gateway
        let gateway: Address = env
            .storage()
            .instance()
            .get(&DataKey::Gateway)
            .ok_or(QuipayError::NotInitialized)?;
        gateway.require_auth();

        // Call the internal create stream logic
        Self::create_stream_internal(
            env,
            employer,
            worker,
            token,
            rate,
            cliff_ts,
            start_ts,
            end_ts,
            metadata_hash,
            core::option::Option::<stream_curve::SpeedCurve>::None, // speed_curve not supported via gateway yet
        )
    }

    /// Set the authorized DAO governance contract address.
    /// Only admin can call this.
    pub fn set_dao_governance(env: Env, dao: Address) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::DaoGovernance, &dao);
        Ok(())
    }

    /// Get the authorized DAO governance contract address.
    pub fn get_dao_governance(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::DaoGovernance)
    }

    /// Create a stream via an executed DAO governance proposal.
    /// Only the registered DaoGovernance contract can call this method.
    pub fn create_stream_via_governance(
        env: Env,
        employer: Address,
        worker: Address,
        token: Address,
        rate: i128,
        cliff_ts: u64,
        start_ts: u64,
        end_ts: u64,
        metadata_hash: Option<BytesN<32>>,
    ) -> Result<u64, QuipayError> {
        Self::require_not_paused(&env)?;

        // Verify the caller is the authorized DAO governance contract
        let dao: Address = env
            .storage()
            .instance()
            .get(&DataKey::DaoGovernance)
            .ok_or(QuipayError::NotInitialized)?;
        dao.require_auth();

        let stream_id = Self::create_stream_internal(
            env.clone(),
            employer.clone(),
            worker.clone(),
            token.clone(),
            rate,
            cliff_ts,
            start_ts,
            end_ts,
            metadata_hash,
            core::option::Option::<stream_curve::SpeedCurve>::None,
        )?;

        env.events().publish(
            (
                Symbol::new(&env, "stream"),
                Symbol::new(&env, "created_via_governance"),
                worker,
                employer,
            ),
            (stream_id, token, rate, start_ts, end_ts),
        );

        Ok(stream_id)
    }


    pub fn cancel_stream_via_gateway(
        env: Env,
        stream_id: u64,
        employer: Address,
    ) -> Result<(), QuipayError> {
        Self::require_not_paused(&env)?;

        // Verify the caller is the authorized gateway
        let gateway: Address = env
            .storage()
            .instance()
            .get(&DataKey::Gateway)
            .ok_or(QuipayError::NotInitialized)?;
        gateway.require_auth();

        let key = StreamKey::Stream(stream_id);
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(QuipayError::StreamNotFound)?;

        if stream.employer != employer {
            return Err(QuipayError::NotEmployer);
        }
        if Self::is_closed(&stream) {
            return Ok(());
        }

        let now = env.ledger().timestamp();

        // If a grace period is already active, reject duplicate request.
        if stream.cancel_effective_at > 0 && now < stream.cancel_effective_at {
            return Err(QuipayError::GracePeriodActive);
        }

        // If the grace period has elapsed, finalize now.
        if stream.cancel_effective_at > 0 && now >= stream.cancel_effective_at {
            return Self::finalize_cancel(&env, stream_id, &key, &mut stream, now);
        }

        let grace: u64 = env
            .storage()
            .instance()
            .get(&DataKey::CancellationGracePeriod)
            .unwrap_or(DEFAULT_CANCELLATION_GRACE_PERIOD);

        if grace == 0 {
            return Self::finalize_cancel(&env, stream_id, &key, &mut stream, now);
        }

        stream.cancel_effective_at = now.saturating_add(grace);
        env.storage().persistent().set(&key, &stream);

        env.events().publish(
            (
                Symbol::new(&env, "stream"),
                Symbol::new(&env, "cancel_scheduled_via_gateway"),
                stream_id,
                employer.clone(),
            ),
            (stream.worker.clone(), stream.cancel_effective_at),
        );

        Ok(())
    }

    // Internal helper for creating streams (used by both create_stream and create_stream_via_gateway)
    fn create_stream_internal(
        env: Env,
        employer: Address,
        worker: Address,
        token: Address,
        rate: i128,
        cliff_ts: u64,
        start_ts: u64,
        end_ts: u64,
        metadata_hash: Option<BytesN<32>>,
        speed_curve: Option<stream_curve::SpeedCurve>,
    ) -> Result<u64, QuipayError> {
        if rate <= 0 {
            return Err(QuipayError::InvalidAmount);
        }
        if end_ts <= start_ts {
            return Err(QuipayError::InvalidTimeRange);
        }

        let duration = end_ts.saturating_sub(start_ts);
        if duration > Self::get_max_stream_duration(env.clone()) {
            return Err(QuipayError::InvalidTimeRange);
        }
        if duration < Self::get_min_stream_duration(env.clone()) {
            return Err(QuipayError::DurationTooShort);
        }

        let limit = Self::get_employer_stream_limit(env.clone(), employer.clone());
        let emp_key = StreamKey::EmployerStreams(employer.clone());
        let emp_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&emp_key)
            .unwrap_or_else(|| Vec::new(&env));

        let mut active_count = 0u32;
        let mut i = 0u32;
        while i < emp_ids.len() {
            if let Some(id) = emp_ids.get(i) {
                if let Some(s) = env
                    .storage()
                    .persistent()
                    .get::<StreamKey, Stream>(&StreamKey::Stream(id))
                {
                    if !Self::is_closed(&s) {
                        active_count += 1;
                    }
                }
            }
            i += 1;
        }

        if active_count >= limit {
            return Err(QuipayError::StreamLimitReached);
        }

        let effective_cliff = if cliff_ts <= start_ts {
            start_ts
        } else {
            cliff_ts
        };
        if effective_cliff > end_ts {
            return Err(QuipayError::InvalidCliff);
        }

        let now = env.ledger().timestamp();
        if start_ts < now {
            return Err(QuipayError::StartTimeInPast);
        }

        let duration = end_ts - start_ts;
        let duration_i = i128::try_from(duration).map_err(|_| QuipayError::Overflow)?;
        let total_amount = rate
            .checked_mul(duration_i)
            .ok_or(QuipayError::Overflow)?;

        let vault: Address = env
            .storage()
            .instance()
            .get(&DataKey::Vault)
            .ok_or(QuipayError::NotInitialized)?;

        use soroban_sdk::{IntoVal, Symbol, vec};

        // Block stream creation if treasury would be insolvent
        let solvent: bool = env.invoke_contract(
            &vault,
            &Symbol::new(&env, "check_solvency"),
            vec![
                &env,
                token.clone().into_val(&env),
                total_amount.into_val(&env),
            ],
        );
        require!(solvent, QuipayError::InsufficientBalance);

        env.invoke_contract::<()>(
            &vault,
            &Symbol::new(&env, "add_liability"),
            vec![
                &env,
                token.clone().into_val(&env),
                total_amount.into_val(&env),
            ],
        );

        let mut next_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextStreamId)
            .unwrap_or(1u64);
        let stream_id = next_id;
        next_id = next_id.checked_add(1).ok_or(QuipayError::Overflow)?;
        env.storage()
            .instance()
            .set(&DataKey::NextStreamId, &next_id);

        let stream = Stream {
            employer: employer.clone(),
            worker: worker.clone(),
            token: token.clone(),
            rate,
            cliff_ts: effective_cliff,
            start_ts,
            end_ts,
            total_amount,
            withdrawn_amount: 0,
            last_withdrawal_ts: 0,
            status: StreamStatus::Active,
            created_at: now,
            closed_at: 0,
            paused_at: 0,
            total_paused_duration: 0,
            metadata_hash,
            cancel_effective_at: 0,
            speed_curve: speed_curve.unwrap_or(stream_curve::SpeedCurve::Linear),
        };

        env.storage()
            .persistent()
            .set(&StreamKey::Stream(stream_id), &stream);

        let emp_key = StreamKey::EmployerStreams(employer.clone());
        let mut emp_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&emp_key)
            .unwrap_or_else(|| Vec::new(&env));
        emp_ids.push_back(stream_id);
        env.storage().persistent().set(&emp_key, &emp_ids);

        let wrk_key = StreamKey::WorkerStreams(worker.clone());
        let mut wrk_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&wrk_key)
            .unwrap_or_else(|| Vec::new(&env));
        wrk_ids.push_back(stream_id);
        env.storage().persistent().set(&wrk_key, &wrk_ids);

        // Keep the new stream state and its worker index entry alive.
        Self::bump_stream_storage_ttl(&env, stream_id, &worker);

        env.events().publish(
            (
                Symbol::new(&env, "stream"),
                Symbol::new(&env, "created_via_gateway"),
                worker.clone(),
                employer.clone(),
            ),
            (stream_id, token, rate, start_ts, end_ts),
        );

        Ok(stream_id)
    }

    pub fn get_stream(env: Env, stream_id: u64) -> Option<Stream> {
        env.storage()
            .persistent()
            .get(&StreamKey::Stream(stream_id))
    }

    /// Returns the optional metadata hash for a stream.
    /// The hash references an off-chain record (e.g. IPFS CID or database key)
    /// containing human-readable context such as description, department, and payment type.
    pub fn get_stream_metadata(env: Env, stream_id: u64) -> Option<BytesN<32>> {
        let stream: Stream = env
            .storage()
            .persistent()
            .get(&StreamKey::Stream(stream_id))?;
        stream.metadata_hash
    }

    pub fn get_withdrawable(env: Env, stream_id: u64) -> Option<i128> {
        let key = StreamKey::Stream(stream_id);
        let stream: Stream = env.storage().persistent().get(&key)?;

        if Self::is_closed(&stream) {
            return Some(0);
        }

        let now = env.ledger().timestamp();
        let vested = Self::vested_amount(&stream, now);
        Some(vested.checked_sub(stream.withdrawn_amount).unwrap_or(0))
    }

    /// Pure view: returns claimable amount without mutating state.
    /// Claimable = min(streamed_amount - withdrawn_amount, vault_available_balance).
    pub fn get_claimable(env: Env, stream_id: u64) -> Option<i128> {
        let key = StreamKey::Stream(stream_id);
        let stream: Stream = env.storage().persistent().get(&key)?;

        if Self::is_closed(&stream) {
            return Some(0);
        }

        let vault: Address = env.storage().instance().get(&DataKey::Vault)?;
        let now = env.ledger().timestamp();
        let vested = Self::vested_amount(&stream, now);
        let streamed_claimable = vested.checked_sub(stream.withdrawn_amount).unwrap_or(0);
        if streamed_claimable <= 0 {
            return Some(0);
        }

        use soroban_sdk::{IntoVal, Symbol, vec};
        let vault_balance: i128 = env.invoke_contract(
            &vault,
            &Symbol::new(&env, "get_balance"),
            vec![&env, stream.token.clone().into_val(&env)],
        );
        if vault_balance <= 0 {
            return Some(0);
        }

        Some(core::cmp::min(streamed_claimable, vault_balance))
    }

    /// Returns the accrued (vested) balance of a stream at a specific historical timestamp.
    ///
    /// Read-only; does not modify state. Useful for point-in-time accounting and
    /// month-end close queries without requiring an external indexer.
    ///
    /// Returns `Err(QuipayError::StreamNotFound)` when no stream exists for `stream_id`.
    /// Returns `Err(QuipayError::InvalidTimeRange)` when `timestamp` is outside
    /// `[stream.start_ts, stream.end_ts]`.
    pub fn simulate_balance_at(
        env: Env,
        stream_id: u64,
        timestamp: u64,
    ) -> Result<i128, QuipayError> {
        let stream: Stream = env
            .storage()
            .persistent()
            .get(&StreamKey::Stream(stream_id))
            .ok_or(QuipayError::StreamNotFound)?;

        if timestamp < stream.start_ts || timestamp > stream.end_ts {
            return Err(QuipayError::InvalidTimeRange);
        }

        Ok(Self::vested_amount_at(&stream, timestamp))
    }

    /// Check if a stream is currently solvent (vault has enough funds to cover remaining liability)
    pub fn is_stream_solvent(env: Env, stream_id: u64) -> Option<bool> {
        let key = StreamKey::Stream(stream_id);
        let stream: Stream = env.storage().persistent().get(&key)?;

        // If stream is closed, it's considered solvent
        if Self::is_closed(&stream) {
            return Some(true);
        }

        let vault: Address = env.storage().instance().get(&DataKey::Vault)?;

        // Calculate remaining liability
        let remaining_liability = stream
            .total_amount
            .checked_sub(stream.withdrawn_amount)
            .unwrap_or(0);

        // Check vault solvency for this stream's remaining liability
        use soroban_sdk::{IntoVal, Symbol, vec};
        let solvent: bool = env.invoke_contract(
            &vault,
            &Symbol::new(&env, "check_solvency"),
            vec![
                &env,
                stream.token.clone().into_val(&env),
                remaining_liability.into_val(&env),
            ],
        );

        Some(solvent)
    }

    /// Get stream health information including solvency ratio and days of runway
    pub fn get_stream_health(env: Env, stream_id: u64) -> Option<StreamHealth> {
        let key = StreamKey::Stream(stream_id);
        let stream: Stream = env.storage().persistent().get(&key)?;

        // If stream is closed, return perfect health
        if Self::is_closed(&stream) {
            return Some(StreamHealth {
                solvency_ratio: 10000,    // 100%
                days_of_runway: u64::MAX, // Infinite runway
            });
        }

        let vault: Address = env.storage().instance().get(&DataKey::Vault)?;

        let remaining_liability = stream
            .total_amount
            .checked_sub(stream.withdrawn_amount)
            .unwrap_or(0);

        // If no remaining liability, stream is fully funded
        if remaining_liability == 0 {
            return Some(StreamHealth {
                solvency_ratio: 10000,    // 100%
                days_of_runway: u64::MAX, // Infinite runway
            });
        }

        use soroban_sdk::{IntoVal, Symbol, vec};

        // Get vault balance and liability for this token
        let vault_balance: i128 = env.invoke_contract(
            &vault,
            &Symbol::new(&env, "get_balance"),
            vec![&env, stream.token.clone().into_val(&env)],
        );

        let vault_liability: i128 = env.invoke_contract(
            &vault,
            &Symbol::new(&env, "get_liability"),
            vec![&env, stream.token.clone().into_val(&env)],
        );

        let available_balance = vault_balance.saturating_sub(vault_liability);

        // Calculate solvency ratio as basis points (10000 = 100%)
        let solvency_ratio = if remaining_liability > 0 {
            let ratio = available_balance
                .checked_mul(10000)
                .unwrap_or(0)
                .checked_div(remaining_liability)
                .unwrap_or(0);
            ratio.min(10000) // Cap at 100%
        } else {
            10000
        };

        // Calculate days of runway based on stream rate
        let days_of_runway = if stream.rate > 0 && available_balance > 0 {
            let seconds_of_runway = available_balance / stream.rate;
            (seconds_of_runway / (24 * 60 * 60)) as u64 // Convert to days
        } else if available_balance >= remaining_liability {
            u64::MAX // Infinite runway if fully funded
        } else {
            0 // No runway if insufficient funds
        };

        Some(StreamHealth {
            solvency_ratio,
            days_of_runway,
        })
    }

    pub fn get_streams_by_employer(
        env: Env,
        employer: Address,
        offset: Option<u32>,
        limit: Option<u32>,
    ) -> Vec<u64> {
        let ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&StreamKey::EmployerStreams(employer))
            .unwrap_or_else(|| Vec::new(&env));

        Self::paginate(&env, ids, offset, limit)
    }

    pub fn get_streams_by_worker(
        env: Env,
        worker: Address,
        offset: Option<u32>,
        limit: Option<u32>,
    ) -> Vec<u64> {
        let ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&StreamKey::WorkerStreams(worker))
            .unwrap_or_else(|| Vec::new(&env));

        Self::paginate(&env, ids, offset, limit)
    }

    /// Paginate a list of stream IDs with bounds checking.
    ///
    /// ### DoS Protection
    /// The `limit` parameter is capped at `MAX_PAGE_SIZE` (1000) to prevent
    /// performance issues from excessively large page requests.
    ///
    /// ### Parameters
    /// - `ids`: Full list of stream IDs to paginate
    /// - `offset`: Starting index (default: 0)
    /// - `limit`: Maximum items to return (default: all, capped at MAX_PAGE_SIZE)
    ///
    /// ### Returns
    /// A subset of `ids` from `offset` to `offset + min(limit, MAX_PAGE_SIZE)`
    fn paginate(env: &Env, ids: Vec<u64>, offset: Option<u32>, limit: Option<u32>) -> Vec<u64> {
        let offset = offset.unwrap_or(0);
        let ids_len = ids.len();
        // Cap limit at MAX_PAGE_SIZE to prevent DoS
        let requested_limit = limit.unwrap_or(ids_len);
        let limit = requested_limit.min(MAX_PAGE_SIZE).min(ids_len);

        let mut result = Vec::new(env);
        if offset >= ids_len {
            return result;
        }

        let end = (offset + limit).min(ids_len);

        for i in offset..end {
            if let Some(id) = ids.get(i) {
                result.push_back(id);
            }
        }
        result
    }

    pub fn cleanup_stream(env: Env, stream_id: u64) -> Result<(), QuipayError> {
        let key = StreamKey::Stream(stream_id);
        let stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(QuipayError::StreamNotFound)?;

        require!(Self::is_closed(&stream), QuipayError::StreamNotClosed);

        let retention: u64 = env
            .storage()
            .instance()
            .get(&DataKey::RetentionSecs)
            .unwrap_or(DEFAULT_RETENTION_SECS);

        let now = env.ledger().timestamp();
        if now < stream.closed_at.saturating_add(retention) {
            return Err(QuipayError::RetentionNotMet);
        }

        Self::remove_from_index(&env, StreamKey::EmployerStreams(stream.employer), stream_id);
        Self::remove_from_index(&env, StreamKey::WorkerStreams(stream.worker), stream_id);

        env.storage().persistent().remove(&key);
        Ok(())
    }

    /// Propose an upgrade with a 48-hour timelock
    /// Only admin can call this function
    pub fn propose_upgrade(
        env: Env,
        new_wasm_hash: soroban_sdk::BytesN<32>,
    ) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();

        let now = env.ledger().timestamp();
        let execute_after = now.saturating_add(TIMELOCK_DURATION);

        // Check if there's already a pending upgrade
        if env.storage().instance().has(&DataKey::PendingUpgrade) {
            return Err(QuipayError::Custom);
        }

        let pending_upgrade = PendingUpgrade {
            wasm_hash: new_wasm_hash.clone(),
            execute_after,
            proposed_at: now,
            proposed_by: admin.clone(),
        };

        env.storage()
            .instance()
            .set(&DataKey::PendingUpgrade, &pending_upgrade);

        // Emit upgrade proposed event
        #[allow(deprecated)]
        env.events()
            .publish((UPGRADE_PROPOSED, admin), (new_wasm_hash, execute_after));

        Ok(())
    }

    /// Execute a proposed upgrade after timelock period
    /// Only admin can call this function
    pub fn execute_upgrade(env: Env) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();

        let pending_upgrade: PendingUpgrade = env
            .storage()
            .instance()
            .get(&DataKey::PendingUpgrade)
            .ok_or(QuipayError::Custom)?;

        let now = env.ledger().timestamp();
        if now < pending_upgrade.execute_after {
            return Err(QuipayError::Custom);
        }

        // Perform the upgrade
        env.deployer()
            .update_current_contract_wasm(pending_upgrade.wasm_hash.clone());

        // Clear pending upgrade
        env.storage().instance().remove(&DataKey::PendingUpgrade);

        // Emit upgrade executed event
        #[allow(deprecated)]
        env.events()
            .publish((UPGRADE_EXECUTED, admin), (pending_upgrade.wasm_hash, now));

        Ok(())
    }

    /// Cancel a pending upgrade
    /// Only admin can call this function
    pub fn cancel_upgrade(env: Env) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();

        let pending_upgrade: PendingUpgrade = env
            .storage()
            .instance()
            .get(&DataKey::PendingUpgrade)
            .ok_or(QuipayError::Custom)?;

        // Clear pending upgrade
        env.storage().instance().remove(&DataKey::PendingUpgrade);

        // Emit upgrade canceled event
        #[allow(deprecated)]
        env.events().publish(
            (UPGRADE_CANCELED, admin),
            (pending_upgrade.wasm_hash, pending_upgrade.execute_after),
        );

        Ok(())
    }

    /// Get the current pending upgrade (if any)
    pub fn get_pending_upgrade(env: Env) -> Option<PendingUpgrade> {
        env.storage().instance().get(&DataKey::PendingUpgrade)
    }

    /// Get the current early cancellation fee in basis points
    pub fn get_early_cancel_fee(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::EarlyCancelFeeBps)
            .unwrap_or(0)
    }

    fn require_not_paused(env: &Env) -> Result<(), QuipayError> {
        if Self::is_paused(env.clone()) {
            return Err(QuipayError::ProtocolPaused);
        }
        Ok(())
    }

    fn is_closed(stream: &Stream) -> bool {
        stream.status == StreamStatus::Canceled || stream.status == StreamStatus::Completed
    }

    fn bump_stream_storage_ttl(env: &Env, stream_id: u64, worker: &Address) {
        let stream_key = StreamKey::Stream(stream_id);
        env.storage().persistent().extend_ttl(
            &stream_key,
            STORAGE_TTL_THRESHOLD_LEDGER,
            STORAGE_TTL_EXTEND_TO_LEDGER,
        );

        let worker_key = StreamKey::WorkerStreams(worker.clone());
        env.storage().persistent().extend_ttl(
            &worker_key,
            STORAGE_TTL_THRESHOLD_LEDGER,
            STORAGE_TTL_EXTEND_TO_LEDGER,
        );
    }

    fn close_stream_internal(stream: &mut Stream, now: u64, status: StreamStatus) {
        stream.status = status;
        stream.closed_at = now;
    }

    fn remove_from_index(env: &Env, key: StreamKey, stream_id: u64) {
        let ids: Vec<u64> = match env.storage().persistent().get(&key) {
            Some(v) => v,
            None => return,
        };
        let mut new_ids: Vec<u64> = Vec::new(env);
        let mut i = 0u32;
        while i < ids.len() {
            if let Some(id) = ids.get(i) {
                if id != stream_id {
                    new_ids.push_back(id);
                }
            }
            i += 1;
        }
        if new_ids.len() == 0 {
            env.storage().persistent().remove(&key);
        } else {
            env.storage().persistent().set(&key, &new_ids);
        }
    }

    fn vested_amount(stream: &Stream, now: u64) -> i128 {
        Self::vested_amount_at(stream, now)
    }

    /// Calculate early cancellation fee based on remaining amount
    fn calculate_early_cancel_fee(env: &Env, remaining_amount: i128) -> i128 {
        let fee_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::EarlyCancelFeeBps)
            .unwrap_or(0); // Default to 0 if not set

        if fee_bps == 0 || remaining_amount <= 0 {
            return 0;
        }

        remaining_amount
            .checked_mul(fee_bps as i128)
            .unwrap_or(0)
            .checked_div(10000) // Convert basis points to actual amount
            .unwrap_or(0)
    }

    /// Invoke `payout_liability` on the vault contract.
    pub(crate) fn call_vault_payout(
        env: &Env,
        vault: &Address,
        worker: Address,
        token: Address,
        amount: i128,
    ) {
        use soroban_sdk::{IntoVal, Symbol, vec};
        env.invoke_contract::<()>(
            vault,
            &Symbol::new(env, "payout_liability"),
            vec![
                env,
                worker.into_val(env),
                token.into_val(env),
                amount.into_val(env),
            ],
        );
    }

    /// Invoke `remove_liability` on the vault contract.
    pub(crate) fn call_vault_remove_liability(
        env: &Env,
        vault: &Address,
        token: Address,
        amount: i128,
    ) {
        use soroban_sdk::{IntoVal, Symbol, vec};
        env.invoke_contract::<()>(
            vault,
            &Symbol::new(env, "remove_liability"),
            vec![env, token.into_val(env), amount.into_val(env)],
        );
    }

    /// If a PayrollReceipt contract is registered, mint a receipt for the closed stream.
    /// Failures are silently ignored so they never block stream closure.
    pub(crate) fn try_mint_receipt(
        env: &Env,
        stream: &Stream,
        stream_id: u64,
        reason: u32, // 0 = Completed, 1 = Cancelled
    ) {
        use soroban_sdk::{IntoVal, Symbol, vec};
        let Some(receipt_addr): Option<Address> =
            env.storage().instance().get(&DataKey::Receipt)
        else {
            return;
        };
        // ClosureReason enum discriminant is passed as u32 to avoid a cross-crate
        // contracttype dependency at the call site.
        let _ = env.try_invoke_contract::<u64, soroban_sdk::Error>(
            &receipt_addr,
            &Symbol::new(env, "mint"),
            vec![
                env,
                stream_id.into_val(env),
                stream.employer.clone().into_val(env),
                stream.worker.clone().into_val(env),
                stream.token.clone().into_val(env),
                stream.withdrawn_amount.into_val(env),
                stream.start_ts.into_val(env),
                stream.end_ts.into_val(env),
                stream.closed_at.into_val(env),
                reason.into_val(env),
            ],
        );
    }

    /// Calculate the vested amount at a specific timestamp, accounting for pauses.
    ///
    /// Subtracts `total_paused_duration` from elapsed time so workers are only
    /// paid for active (non-paused) time. Caps the result at `total_amount`.
    pub(crate) fn vested_amount_at(stream: &Stream, timestamp: u64) -> i128 {
        let is_closed = Self::is_closed(stream);
        let mut effective_ts = if is_closed {
            core::cmp::min(timestamp, stream.closed_at)
        } else {
            timestamp
        };

        // Adjust effective_ts for currently paused streams
        if stream.status == StreamStatus::Paused {
            effective_ts = core::cmp::min(effective_ts, stream.paused_at);
        }

        // Cap vesting at cancel_effective_at when a grace period is pending
        if !is_closed && stream.cancel_effective_at > 0 {
            effective_ts = core::cmp::min(effective_ts, stream.cancel_effective_at);
        }

        // Subtract total paused duration from the elapsed time
        let elapsed_reduction = stream.total_paused_duration;

        if effective_ts < stream.cliff_ts {
            return 0;
        }

        let start_with_pauses = stream.start_ts.saturating_add(elapsed_reduction);

        if effective_ts <= start_with_pauses {
            if effective_ts == start_with_pauses && stream.end_ts == stream.start_ts {
                return stream.total_amount;
            }
            return 0;
        }

        let end_with_pauses = stream.end_ts.saturating_add(elapsed_reduction);

        if effective_ts >= end_with_pauses
            || (stream.status == StreamStatus::Completed && effective_ts >= stream.closed_at)
        {
            return stream.total_amount;
        }

        let elapsed: u64 = effective_ts.saturating_sub(start_with_pauses);
        let duration: u64 = stream.end_ts.saturating_sub(stream.start_ts);
        if duration == 0 {
            return stream.total_amount;
        }

        // Delegate to the curve module — all three curves share the same
        // boundary guarantees and integer-safe implementation.
        stream_curve::compute_vested(elapsed, duration, stream.total_amount, stream.speed_curve)
    }

    pub fn raise_dispute(
        env: Env,
        stream_id: u64,
        caller: Address,
        reason_hash: soroban_sdk::BytesN<32>,
    ) -> Result<(), QuipayError> {
        Self::require_not_paused(&env)?;
        dispute::raise_dispute(&env, stream_id, &caller, reason_hash)
    }

    pub fn resolve_dispute(
        env: Env,
        stream_id: u64,
        arbitrator: Address,
        outcome: DisputeOutcome,
    ) -> Result<(), QuipayError> {
        Self::require_not_paused(&env)?;
        dispute::resolve_dispute(&env, stream_id, &arbitrator, outcome)
    }

    pub fn get_dispute(env: Env, stream_id: u64) -> Option<dispute::Dispute> {
        dispute::get_dispute(&env, stream_id)
    }

    pub fn has_open_dispute(env: Env, stream_id: u64) -> bool {
        dispute::has_open_dispute(&env, stream_id)
    }
}

mod dispute;
mod extension_test;
mod pause_test;
mod pause_timelock_test;
mod stream_extension;
mod stream_pause;

mod stream_curve;
mod test;

#[cfg(test)]
mod duration_test;

#[cfg(test)]
mod batch_cancel_test;

#[cfg(test)]
mod batch_claim_test;

#[cfg(test)]
mod cancel_grace_test;

#[cfg(test)]
mod integration_test;

#[cfg(test)]
mod proptest;

#[cfg(test)]
mod withdraw_proptest;
mod upgrade_migration_test;
