use super::*;

#[soroban_sdk::contractimpl]
impl PayrollStream {
    /// Extends a stream by increasing the total amount, the end time, or both.
    ///
    /// The stream rate is recomputed as `total_amount / (end_ts - start_ts)` using
    /// integer division. Any remainder is truncated, so extensions that produce
    /// short durations relative to the total amount can lose precision in the
    /// resulting per-second rate.
    pub fn extend_stream(
        env: Env,
        stream_id: u64,
        additional_amount: i128,
        new_end_time: u64,
    ) -> Result<(), QuipayError> {
        Self::require_not_paused(&env)?;

        let key = StreamKey::Stream(stream_id);
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(QuipayError::StreamNotFound)?;

        // Authorization: Only the employer of the stream can extend it
        stream.employer.require_auth();

        // Validation: Stream must be active
        if stream.status != StreamStatus::Active {
            return Err(QuipayError::StreamClosed);
        }

        // Validation: New end time must be greater than or equal to current end time
        if new_end_time < stream.end_ts {
            return Err(QuipayError::InvalidTimeRange);
        }

        // Validation: New end time must be strictly after stream start time (no zero-duration)
        if new_end_time <= stream.start_ts {
            return Err(QuipayError::InvalidTimeRange);
        }

        // Validation: additional_amount must be non-negative
        if additional_amount < 0 {
            return Err(QuipayError::InvalidAmount);
        }

        // Validation: Minimum duration check
        let duration = new_end_time.saturating_sub(stream.start_ts);
        if duration < Self::get_min_stream_duration(env.clone()) {
            return Err(QuipayError::DurationTooShort);
        }
        
        // Validation: Maximum duration check
        if duration > Self::get_max_stream_duration(env.clone()) {
            return Err(QuipayError::InvalidTimeRange);
        }

        // If additional amount is provided, we need to deposit it into the vault
        if additional_amount > 0 {
            let vault: Address = env
                .storage()
                .instance()
                .get(&DataKey::Vault)
                .ok_or(QuipayError::NotInitialized)?;

            use soroban_sdk::{IntoVal, Symbol, vec};

            // Check solvency for the additional amount
            let solvent: bool = env.invoke_contract(
                &vault,
                &Symbol::new(&env, "check_solvency"),
                vec![
                    &env,
                    stream.token.clone().into_val(&env),
                    additional_amount.into_val(&env),
                ],
            );
            require!(solvent, QuipayError::InsufficientBalance);

            // Add liability to the vault
            env.invoke_contract::<()>(
                &vault,
                &Symbol::new(&env, "add_liability"),
                vec![
                    &env,
                    stream.token.clone().into_val(&env),
                    additional_amount.into_val(&env),
                ],
            );

            // Update stream total amount
            stream.total_amount = stream
                .total_amount
                .checked_add(additional_amount)
                .ok_or(QuipayError::Overflow)?;
        }

        // Update end time
        let old_end_ts = stream.end_ts;
        stream.end_ts = new_end_time;

        // Recalculate rate based on the total amount and the entire duration.
        // This uses integer division and therefore rounds down toward zero.
        // Very small durations can magnify the discarded remainder, so callers
        // should avoid extensions that compress large totals into tiny windows.
        let duration = stream
            .end_ts
            .checked_sub(stream.start_ts)
            .ok_or(QuipayError::Overflow)?;
        if duration > 0 {
            stream.rate = stream
                .total_amount
                .checked_div(duration as i128)
                .ok_or(QuipayError::Overflow)?;
        }

        // Save updated stream
        env.storage().persistent().set(&key, &stream);
        Self::bump_stream_storage_ttl(&env, stream_id, &stream.worker);

        // Emit extension event
        env.events().publish(
            (
                Symbol::new(&env, "stream"),
                Symbol::new(&env, "extended"),
                stream_id,
                stream.employer.clone(),
            ),
            (additional_amount, old_end_ts, new_end_time, stream.rate),
        );

        Ok(())
    }
}
