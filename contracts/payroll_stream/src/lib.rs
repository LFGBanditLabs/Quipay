#![no_std]
use quipay_common::{require, QuipayError};
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    NextStreamId,
    RetentionSecs,
    Vault,
    Gateway,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum StreamStatus {
    Active = 0,
    Canceled = 1,
    Completed = 2,
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
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct WithdrawResult {
    pub stream_id: u64,
    pub amount: i128,
    pub success: bool,
}

const DEFAULT_RETENTION_SECS: u64 = 30 * 24 * 60 * 60;

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

    pub fn set_vault(env: Env, vault: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();
        env.storage().instance().set(&DataKey::Vault, &vault);
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
        Self::create_stream_internal(
            env, employer, worker, token, rate, cliff_ts, start_ts, end_ts,
        )?;

        // Publish the standard creation event
        let stream_id = env
            .storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::NextStreamId)
            .unwrap_or(1u64)
            .saturating_sub(1);

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

    pub fn withdraw(env: Env, stream_id: u64, worker: Address) -> Result<i128, QuipayError> {
        Self::require_not_paused(&env)?;
        worker.require_auth();

        let key = StreamKey::Stream(stream_id);
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .expect("stream not found");

        if stream.worker != worker {
            panic!("not worker");
        }
        if Self::is_closed(&stream) {
            panic!("stream closed");
        }

        let now = env.ledger().timestamp();
        let vested = Self::vested_amount(&stream, now);
        let available = vested.checked_sub(stream.withdrawn_amount).unwrap_or(0);

        if available <= 0 {
            return Ok(0);
        }

        stream.withdrawn_amount = stream
            .withdrawn_amount
            .checked_add(available)
            .expect("withdrawn overflow");
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

    pub fn batch_withdraw(env: Env, stream_ids: Vec<u64>, caller: Address) -> Vec<WithdrawResult> {
        Self::require_not_paused(&env).unwrap();
        caller.require_auth();

        let now = env.ledger().timestamp();
        let mut results: Vec<WithdrawResult> = Vec::new(&env);

        let mut idx = 0u32;
        while idx < stream_ids.len() {
            let stream_id = stream_ids.get(idx).unwrap();
            let key = StreamKey::Stream(stream_id);

            let result = match env.storage().persistent().get::<StreamKey, Stream>(&key) {
                Some(mut stream) => {
                    if stream.worker != caller {
                        WithdrawResult {
                            stream_id,
                            amount: 0,
                            success: false,
                        }
                    } else if Self::is_closed(&stream) {
                        WithdrawResult {
                            stream_id,
                            amount: 0,
                            success: false,
                        }
                    } else {
                        let vested = Self::vested_amount(&stream, now);
                        let available = vested.checked_sub(stream.withdrawn_amount).unwrap_or(0);

                        if available <= 0 {
                            WithdrawResult {
                                stream_id,
                                amount: 0,
                                success: true,
                            }
                        } else {
                            stream.withdrawn_amount = stream
                                .withdrawn_amount
                                .checked_add(available)
                                .expect("withdrawn overflow");
                            stream.last_withdrawal_ts = now;

                            if stream.withdrawn_amount >= stream.total_amount {
                                Self::close_stream_internal(
                                    &mut stream,
                                    now,
                                    StreamStatus::Completed,
                                );
                            }

                            env.storage().persistent().set(&key, &stream);

                            env.events().publish(
                                (
                                    Symbol::new(&env, "stream"),
                                    Symbol::new(&env, "withdrawn"),
                                    stream_id,
                                    caller.clone(),
                                ),
                                (available, stream.token.clone()),
                            );

                            WithdrawResult {
                                stream_id,
                                amount: available,
                                success: true,
                            }
                        }
                    }
                }
                None => WithdrawResult {
                    stream_id,
                    amount: 0,
                    success: false,
                },
            };

            results.push_back(result);
            idx += 1;
        }

        results
    }

    pub fn cancel_stream(env: Env, stream_id: u64, employer: Address) -> Result<(), QuipayError> {
        Self::require_not_paused(&env)?;
        employer.require_auth();

        let key = StreamKey::Stream(stream_id);
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .expect("stream not found");

        if stream.employer != employer {
            panic!("not employer");
        }
        if Self::is_closed(&stream) {
            return Ok(());
        }

        let now = env.ledger().timestamp();
        Self::close_stream_internal(&mut stream, now, StreamStatus::Canceled);
        env.storage().persistent().set(&key, &stream);

        env.events().publish(
            (
                Symbol::new(&env, "stream"),
                Symbol::new(&env, "canceled"),
                stream_id,
                employer.clone(),
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
        env.storage()
            .instance()
            .get(&DataKey::Gateway)
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
            return Err(QuipayError::Custom);
        }

        let effective_cliff = if cliff_ts == 0 { start_ts } else { cliff_ts };
        if effective_cliff > end_ts {
            return Err(QuipayError::Custom);
        }

        let now = env.ledger().timestamp();
        if start_ts < now {
            return Err(QuipayError::Custom);
        }

        let duration = end_ts - start_ts;
        let total_amount = rate
            .checked_mul(i128::from(duration as i64))
            .ok_or(QuipayError::Custom)?;

        let vault: Address = env
            .storage()
            .instance()
            .get(&DataKey::Vault)
            .ok_or(QuipayError::NotInitialized)?;

        use soroban_sdk::{vec, IntoVal, Symbol};
        env.invoke_contract::<()>(
            &vault,
            &Symbol::new(&env, "add_liability"),
            vec![&env, token.clone().into_val(&env), total_amount.into_val(&env)],
        );

        let mut next_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextStreamId)
            .unwrap_or(1u64);
        let stream_id = next_id;
        next_id = next_id.checked_add(1).ok_or(QuipayError::Custom)?;
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

    /// Calculate how much salary has accrued (earned but not yet withdrawn) at a given timestamp.
    ///
    /// - Active streams accrue linearly between `start_ts` and `end_ts`.
    /// - Completed streams accrue up to `total_amount`.
    /// - Canceled streams accrue only up to `closed_at` (the cancellation time).
    /// - If `timestamp` is before `start_ts`, accrued is 0.
    /// - Returned value is net of `withdrawn_amount` and is never negative.
    pub fn calculate_accrued(env: Env, stream_id: u64, timestamp: u64) -> i128 {
        let key = StreamKey::Stream(stream_id);
        let stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .expect("stream not found");

        let vested = Self::vested_amount_at(&stream, timestamp);
        vested.checked_sub(stream.withdrawn_amount).unwrap_or(0).max(0)
    }

    pub fn get_employer_streams(env: Env, employer: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&StreamKey::EmployerStreams(employer))
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn get_worker_streams(env: Env, worker: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&StreamKey::WorkerStreams(worker))
            .unwrap_or_else(|| Vec::new(&env))
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
            panic!("retention period not met");
        }

        Self::remove_from_index(&env, StreamKey::EmployerStreams(stream.employer), stream_id);
        Self::remove_from_index(&env, StreamKey::WorkerStreams(stream.worker), stream_id);

        env.storage().persistent().remove(&key);
        Ok(())
    }

    fn require_not_paused(env: &Env) -> Result<(), QuipayError> {
        if env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
        {
            panic!("protocol paused");
        }
        Ok(())
    }

    fn is_closed(stream: &Stream) -> bool {
        stream.status == StreamStatus::Canceled || stream.status == StreamStatus::Completed
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
            let id = ids.get(i).unwrap();
            if id != stream_id {
                new_ids.push_back(id);
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

    fn vested_amount_at(stream: &Stream, timestamp: u64) -> i128 {
        let is_closed = stream.status == StreamStatus::Canceled || stream.status == StreamStatus::Completed;

        let effective_ts = if is_closed {
            core::cmp::min(timestamp, stream.closed_at)
        } else {
            timestamp
        };

        if effective_ts < stream.cliff_ts {
            return 0;
        }
        if effective_ts <= stream.start_ts {
            return 0;
        }

        if effective_ts >= stream.end_ts || (stream.status == StreamStatus::Completed && effective_ts >= stream.closed_at) {
            return stream.total_amount;
        }

        let elapsed: u64 = effective_ts - stream.start_ts;
        let duration: u64 = stream.end_ts - stream.start_ts;
        if duration == 0 {
            return stream.total_amount;
        }

        let elapsed_i: i128 = elapsed as i128;
        let duration_i: i128 = duration as i128;

        stream
            .total_amount
            .checked_mul(elapsed_i)
            .expect("accrued mul overflow")
            .checked_div(duration_i)
            .expect("accrued div overflow")
    }
}

mod test;

#[cfg(test)]
mod proptest;
