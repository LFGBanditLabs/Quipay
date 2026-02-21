#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    NextStreamId,
    RetentionSecs,
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
#[derive(Clone, Debug)]
pub struct Stream {
    pub employer: Address,
    pub worker: Address,
    pub total_amount: i128,
    pub withdrawn_amount: i128,
    pub start_ts: u64,
    pub end_ts: u64,
    pub status_bits: u32,
    pub closed_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum StreamKey {
    Stream(u64),
}

const DEFAULT_RETENTION_SECS: u64 = 30 * 24 * 60 * 60;

#[contract]
pub struct PayrollStream;

#[contractimpl]
impl PayrollStream {
    /// Initialize the contract with an admin.
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::NextStreamId, &1u64);
        env.storage().instance().set(&DataKey::RetentionSecs, &DEFAULT_RETENTION_SECS);
    }

    /// Set the paused status of the contract.
    /// Only the admin can call this.
    pub fn set_paused(env: Env, paused: bool) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &paused);
    }

    /// Check if the contract is paused.
    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    pub fn set_retention_secs(env: Env, retention_secs: u64) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();
        env.storage().instance().set(&DataKey::RetentionSecs, &retention_secs);
    }

    /// Create a new payroll stream.
    /// Fails if the contract is paused.
    pub fn create_stream(env: Env, employer: Address, worker: Address, amount: i128, start_ts: u64, end_ts: u64) -> u64 {
        Self::require_not_paused(&env);
        employer.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }
        if end_ts <= start_ts {
            panic!("invalid time range");
        }

        let mut next_id: u64 = env.storage().instance().get(&DataKey::NextStreamId).unwrap_or(1u64);
        let stream_id = next_id;
        next_id = next_id.checked_add(1).expect("stream id overflow");
        env.storage().instance().set(&DataKey::NextStreamId, &next_id);

        let stream = Stream {
            employer,
            worker,
            total_amount: amount,
            withdrawn_amount: 0,
            start_ts,
            end_ts,
            status_bits: 1u32 << (StreamStatus::Active as u32),
            closed_at: 0,
        };

        env.storage()
            .persistent()
            .set(&StreamKey::Stream(stream_id), &stream);

        stream_id
    }

    /// Withdraw funds from a stream.
    /// Fails if the contract is paused.
    pub fn withdraw(env: Env, stream_id: u64, worker: Address) -> i128 {
        Self::require_not_paused(&env);
        worker.require_auth();

        let key = StreamKey::Stream(stream_id);
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .expect("stream not found");

        if stream.worker != worker {
            panic!("not stream worker");
        }
        if Self::is_closed(&stream) {
            panic!("stream is closed");
        }

        let now = env.ledger().timestamp();
        let vested = Self::vested_amount(&stream, now);
        let available = vested
            .checked_sub(stream.withdrawn_amount)
            .unwrap_or(0);

        if available <= 0 {
            return 0;
        }

        stream.withdrawn_amount = stream
            .withdrawn_amount
            .checked_add(available)
            .expect("withdrawn overflow");

        if stream.withdrawn_amount >= stream.total_amount {
            Self::close_stream_internal(&mut stream, now, StreamStatus::Completed);
        }

        env.storage().persistent().set(&key, &stream);
        available
    }

    /// Cancel a payroll stream.
    /// Fails if the contract is paused.
    pub fn cancel_stream(env: Env, stream_id: u64, employer: Address) {
        Self::require_not_paused(&env);
        employer.require_auth();

        let key = StreamKey::Stream(stream_id);
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .expect("stream not found");

        if stream.employer != employer {
            panic!("not stream employer");
        }
        if Self::is_closed(&stream) {
            return;
        }

        let now = env.ledger().timestamp();
        Self::close_stream_internal(&mut stream, now, StreamStatus::Canceled);
        env.storage().persistent().set(&key, &stream);
    }

    pub fn get_stream(env: Env, stream_id: u64) -> Option<Stream> {
        env.storage().persistent().get(&StreamKey::Stream(stream_id))
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

    pub fn cleanup_stream(env: Env, stream_id: u64) {
        let key = StreamKey::Stream(stream_id);
        let stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .expect("stream not found");

        if !Self::is_closed(&stream) {
            panic!("stream not closed");
        }

        let retention: u64 = env
            .storage()
            .instance()
            .get(&DataKey::RetentionSecs)
            .unwrap_or(DEFAULT_RETENTION_SECS);

        let now = env.ledger().timestamp();
        if now < stream.closed_at.saturating_add(retention) {
            panic!("retention period not met");
        }

        env.storage().persistent().remove(&key);
    }

    /// Internal helper to ensure the contract is not paused.
    fn require_not_paused(env: &Env) {
        if env.storage().instance().get(&DataKey::Paused).unwrap_or(false) {
            panic!("protocol is paused");
        }
    }

    fn is_closed(stream: &Stream) -> bool {
        (stream.status_bits & (1u32 << (StreamStatus::Canceled as u32))) != 0
            || (stream.status_bits & (1u32 << (StreamStatus::Completed as u32))) != 0
    }

    fn close_stream_internal(stream: &mut Stream, now: u64, status: StreamStatus) {
        stream.status_bits &= !(1u32 << (StreamStatus::Active as u32));
        stream.status_bits |= 1u32 << (status as u32);
        stream.closed_at = now;
    }

    fn vested_amount(stream: &Stream, now: u64) -> i128 {
        Self::vested_amount_at(stream, now)
    }

    fn vested_amount_at(stream: &Stream, timestamp: u64) -> i128 {
        let is_canceled = (stream.status_bits & (1u32 << (StreamStatus::Canceled as u32))) != 0;
        let is_completed = (stream.status_bits & (1u32 << (StreamStatus::Completed as u32))) != 0;
        let is_closed = is_canceled || is_completed;

        let effective_ts = if is_closed {
            core::cmp::min(timestamp, stream.closed_at)
        } else {
            timestamp
        };

        if effective_ts <= stream.start_ts {
            return 0;
        }

        if effective_ts >= stream.end_ts || (is_completed && effective_ts >= stream.closed_at) {
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
