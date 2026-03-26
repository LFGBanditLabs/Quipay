#![no_std]
use core::convert::TryFrom;
use quipay_common::{QuipayError, require};
use soroban_sdk::{Address, Env, IntoVal, Symbol, Vec, contract, contractimpl, contracttype};

const MAX_BATCH_CREATE_STREAMS: u32 = 20;
const MAX_STREAM_DURATION: u64 = 365 * 24 * 60 * 60; // 365 days in seconds

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
    PendingUpgrade,    // (wasm_hash, execute_after_timestamp)
    EarlyCancelFeeBps, // Basis points for early cancellation fee (max 1000 = 10%)
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
    pub paused_at: u64,
    pub total_paused_duration: u64,
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
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct WithdrawResult {
    pub stream_id: u64,
    pub amount: i128,
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
        env.storage().instance().set(&DataKey::Paused, &paused);
        Ok(())
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
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

    pub fn create_stream(
        env: Env,
        employer: Address,
        worker: Address,
        token: Address,
        rate: i128,
        cliff_ts: u64,
        start_ts: u64,
        end_ts: u64,
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

    pub fn batch_create_streams(
        env: Env,
        params: Vec<StreamParams>,
    ) -> Result<Vec<u32>, QuipayError> {
        Self::require_not_paused(&env)?;

        if params.len() > MAX_BATCH_CREATE_STREAMS {
            return Err(QuipayError::BatchTooLarge);
        }

        if params.is_empty() {
            return Ok(Vec::new(&env));
        }

        let first_param = params.get(0).ok_or(QuipayError::InvalidAmount)?;
        let authorized_employer = first_param.employer.clone();
        authorized_employer.require_auth();

        let mut stream_ids = Vec::new(&env);
        let mut index = 0u32;

        while index < params.len() {
            let Some(param) = params.get(index) else {
                index += 1;
                continue;
            };

            if param.employer != authorized_employer {
                return Err(QuipayError::Unauthorized);
            }

            let stream_id = Self::create_stream_internal(
                env.clone(),
                param.employer.clone(),
                param.worker.clone(),
                param.token.clone(),
                param.rate,
                param.cliff_ts,
                param.start_ts,
                param.end_ts,
            )?;

            env.events().publish(
                (
                    Symbol::new(&env, "stream"),
                    Symbol::new(&env, "created"),
                    param.worker,
                    param.employer,
                ),
                (
                    stream_id,
                    param.token,
                    param.rate,
                    param.start_ts,
                    param.end_ts,
                ),
            );

            let stream_id = u32::try_from(stream_id).map_err(|_| QuipayError::Overflow)?;
            stream_ids.push_back(stream_id);
            index += 1;
        }

        Ok(stream_ids)
    }

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

        let now = env.ledger().timestamp();
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

        Self::call_vault_payout(&env, &vault, worker.clone(), stream.token.clone(), available);

        stream.withdrawn_amount = stream
            .withdrawn_amount
            .checked_add(available)
            .ok_or(QuipayError::Overflow)?;
        stream.last_withdrawal_ts = now;

        if stream.withdrawn_amount >= stream.total_amount {
            Self::close_stream_internal(&mut stream, now, StreamStatus::Completed);
        }

        env.storage().persistent().set(&key, &stream);

        env.events().publish(
            (
                Symbol::new(&env, "stream"),
                Symbol::new(&env, "withdrawn"),
                stream_id,
                worker.clone(),
            ),
            (available, stream.token.clone()),
        );

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
                Some(mut stream) => {
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

                    Self::call_vault_payout(&env, &vault, caller.clone(), stream.token.clone(), available);

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

                    env.events().publish(
                        (
                            Symbol::new(&env, "stream"),
                            Symbol::new(&env, "withdrawn"),
                            candidate.stream_id,
                            caller.clone(),
                        ),
                        (available, stream.token.clone()),
                    );

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

        // Calculate accrued (vested) amount up to now
        let vested = Self::vested_amount(&stream, now);
        let owed = vested.checked_sub(stream.withdrawn_amount).unwrap_or(0);

        let vault: Address = env
            .storage()
            .instance()
            .get(&DataKey::Vault)
            .ok_or(QuipayError::NotInitialized)?;

        // Pay out owed amount to worker
        if owed > 0 {
            Self::call_vault_payout(&env, &vault, stream.worker.clone(), stream.token.clone(), owed);
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

        // Calculate and charge early cancellation fee
        let cancel_fee = Self::calculate_early_cancel_fee(&env, remaining_liability);

        if remaining_liability > 0 {
            // Remove remaining liability from vault
            Self::call_vault_remove_liability(&env, &vault, stream.token.clone(), remaining_liability);

            // If there's a cancellation fee, pay it to worker
            if cancel_fee > 0 {
                Self::call_vault_payout(&env, &vault, stream.worker.clone(), stream.token.clone(), cancel_fee);
            }
        }

        Self::close_stream_internal(&mut stream, now, StreamStatus::Canceled);
        env.storage().persistent().set(&key, &stream);

        env.events().publish(
            (
                soroban_sdk::Symbol::new(&env, "stream"),
                soroban_sdk::Symbol::new(&env, "canceled"),
                stream_id,
                caller.clone(),
            ),
            (stream.worker.clone(), stream.token.clone()),
        );

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
            env, employer, worker, token, rate, cliff_ts, start_ts, end_ts,
        )
    }

    /// Cancel a stream via an authorized AutomationGateway on behalf of an employer.
    /// Only the registered gateway can call this method.
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

        let vested = Self::vested_amount(&stream, now);
        let owed = vested.checked_sub(stream.withdrawn_amount).unwrap_or(0);

        let vault: Address = env
            .storage()
            .instance()
            .get(&DataKey::Vault)
            .ok_or(QuipayError::NotInitialized)?;

        if owed > 0 {
            Self::call_vault_payout(&env, &vault, stream.worker.clone(), stream.token.clone(), owed);
            stream.withdrawn_amount = stream
                .withdrawn_amount
                .checked_add(owed)
                .ok_or(QuipayError::Custom)?;
            stream.last_withdrawal_ts = now;
        }

        let remaining_liability = stream
            .total_amount
            .checked_sub(stream.withdrawn_amount)
            .ok_or(QuipayError::Custom)?;

        // Calculate and charge early cancellation fee
        let cancel_fee = Self::calculate_early_cancel_fee(&env, remaining_liability);

        if remaining_liability > 0 {
            // Remove remaining liability from vault
            Self::call_vault_remove_liability(&env, &vault, stream.token.clone(), remaining_liability);

            // If there's a cancellation fee, pay it to worker
            if cancel_fee > 0 {
                Self::call_vault_payout(&env, &vault, stream.worker.clone(), stream.token.clone(), cancel_fee);
            }
        }

        Self::close_stream_internal(&mut stream, now, StreamStatus::Canceled);
        env.storage().persistent().set(&key, &stream);

        env.events().publish(
            (
                Symbol::new(&env, "stream"),
                Symbol::new(&env, "canceled_via_gateway"),
                stream_id,
                employer.clone(),
            ),
            (stream.worker.clone(), stream.token.clone()),
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
    ) -> Result<u64, QuipayError> {
        if rate <= 0 {
            return Err(QuipayError::InvalidAmount);
        }
        if end_ts <= start_ts {
            return Err(QuipayError::InvalidTimeRange);
        }

        if end_ts.saturating_sub(start_ts) > MAX_STREAM_DURATION {
            return Err(QuipayError::InvalidTimeRange);
        }

        let effective_cliff = if cliff_ts == 0 { start_ts } else { cliff_ts };
        if effective_cliff > end_ts {
            return Err(QuipayError::InvalidCliff);
        }

        let now = env.ledger().timestamp();
        if start_ts < now {
            return Err(QuipayError::StartTimeInPast);
        }

        let duration = end_ts - start_ts;
        let total_amount = rate
            .checked_mul(i128::from(duration as i64))
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

    fn paginate(env: &Env, ids: Vec<u64>, offset: Option<u32>, limit: Option<u32>) -> Vec<u64> {
        let offset = offset.unwrap_or(0);
        let ids_len = ids.len();
        let limit = limit.unwrap_or(ids_len);

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
    fn call_vault_payout(env: &Env, vault: &Address, worker: Address, token: Address, amount: i128) {
        use soroban_sdk::{IntoVal, Symbol, vec};
        env.invoke_contract::<()>(
            vault,
            &Symbol::new(env, "payout_liability"),
            vec![env, worker.into_val(env), token.into_val(env), amount.into_val(env)],
        );
    }

    /// Invoke `remove_liability` on the vault contract.
    fn call_vault_remove_liability(env: &Env, vault: &Address, token: Address, amount: i128) {
        use soroban_sdk::{IntoVal, Symbol, vec};
        env.invoke_contract::<()>(
            vault,
            &Symbol::new(env, "remove_liability"),
            vec![env, token.into_val(env), amount.into_val(env)],
        );
    }

    fn vested_amount_at(stream: &Stream, timestamp: u64) -> i128 {
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

        // Subtract total paused duration from the elapsed time
        let mut elapsed_reduction = stream.total_paused_duration;

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

        let elapsed_i: i128 = elapsed as i128;
        let duration_i: i128 = duration as i128;

        stream
            .total_amount
            .checked_mul(elapsed_i)
            .unwrap_or(stream.total_amount)
            .checked_div(duration_i)
            .unwrap_or(stream.total_amount)
    }
}

mod stream_extension;
mod stream_pause;
mod extension_test;
mod pause_test;
mod test;

#[cfg(test)]
mod integration_test;

#[cfg(test)]
mod proptest;
