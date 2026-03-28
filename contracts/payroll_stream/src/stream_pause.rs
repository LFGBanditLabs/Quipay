use super::*;

#[soroban_sdk::contractimpl]
impl PayrollStream {
    pub fn pause_stream(env: Env, stream_id: u64, employer: Address) -> Result<(), QuipayError> {
        Self::require_not_paused(&env)?;
        employer.require_auth();

        let key = StreamKey::Stream(stream_id);
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(QuipayError::StreamNotFound)?;

        if stream.employer != employer {
            return Err(QuipayError::Unauthorized);
        }

        if stream.status != StreamStatus::Active {
            return Err(QuipayError::StreamClosed);
        }

        let now = env.ledger().timestamp();
        stream.status = StreamStatus::Paused;
        stream.paused_at = now;

        env.storage().persistent().set(&key, &stream);
        Self::bump_stream_storage_ttl(&env, stream_id, &stream.worker);

        env.events().publish(
            (
                Symbol::new(&env, "stream"),
                Symbol::new(&env, "paused"),
                stream_id,
                employer,
            ),
            (now,),
        );

        Ok(())
    }

    pub fn resume_stream(env: Env, stream_id: u64, employer: Address) -> Result<(), QuipayError> {
        Self::require_not_paused(&env)?;
        employer.require_auth();

        let key = StreamKey::Stream(stream_id);
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(QuipayError::StreamNotFound)?;

        if stream.employer != employer {
            return Err(QuipayError::Unauthorized);
        }

        if stream.status != StreamStatus::Paused {
            return Err(QuipayError::Custom); // Should be Active or something else
        }

        let now = env.ledger().timestamp();
        let paused_duration = now.saturating_sub(stream.paused_at);

        stream.status = StreamStatus::Active;
        stream.total_paused_duration = stream.total_paused_duration.saturating_add(paused_duration);
        stream.paused_at = 0;

        env.storage().persistent().set(&key, &stream);
        Self::bump_stream_storage_ttl(&env, stream_id, &stream.worker);

        env.events().publish(
            (
                Symbol::new(&env, "stream"),
                Symbol::new(&env, "resumed"),
                stream_id,
                employer,
            ),
            (now, paused_duration, stream.total_paused_duration),
        );

        Ok(())
    }

    pub fn admin_pause_stream(env: Env, stream_id: u64) -> Result<(), QuipayError> {
        let admin = Self::get_admin(env.clone())?;
        admin.require_auth();

        let key = StreamKey::Stream(stream_id);
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(QuipayError::StreamNotFound)?;

        if stream.status != StreamStatus::Active {
            return Err(QuipayError::StreamClosed);
        }

        let now = env.ledger().timestamp();
        stream.status = StreamStatus::Paused;
        stream.paused_at = now;

        env.storage().persistent().set(&key, &stream);
        Self::bump_stream_storage_ttl(&env, stream_id, &stream.worker);

        env.events().publish(
            (
                Symbol::new(&env, "stream"),
                Symbol::new(&env, "paused"),
                stream_id,
                admin,
            ),
            (now,),
        );

        Ok(())
    }

    /// Returns `true` if the stream is currently paused, `false` if active.
    /// Returns `StreamNotFound` if no stream with the given id exists.
    pub fn is_stream_paused(env: Env, stream_id: u64) -> Result<bool, QuipayError> {
        let stream: Stream = env
            .storage()
            .persistent()
            .get(&StreamKey::Stream(stream_id))
            .ok_or(QuipayError::StreamNotFound)?;

        Ok(stream.status == StreamStatus::Paused)
    }

    /// Returns `Some(timestamp)` of when the stream was paused, or `None` if it is not paused.
    /// Returns `StreamNotFound` if no stream with the given id exists.
    pub fn get_stream_paused_at(env: Env, stream_id: u64) -> Result<Option<u64>, QuipayError> {
        let stream: Stream = env
            .storage()
            .persistent()
            .get(&StreamKey::Stream(stream_id))
            .ok_or(QuipayError::StreamNotFound)?;

        if stream.status == StreamStatus::Paused {
            Ok(Some(stream.paused_at))
        } else {
            Ok(None)
        }
    }

    pub fn admin_resume_stream(env: Env, stream_id: u64) -> Result<(), QuipayError> {
        let admin = Self::get_admin(env.clone())?;
        admin.require_auth();

        let key = StreamKey::Stream(stream_id);
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(QuipayError::StreamNotFound)?;

        if stream.status != StreamStatus::Paused {
            return Err(QuipayError::Custom);
        }

        let now = env.ledger().timestamp();
        let paused_duration = now.saturating_sub(stream.paused_at);

        stream.status = StreamStatus::Active;
        stream.total_paused_duration = stream.total_paused_duration.saturating_add(paused_duration);
        stream.paused_at = 0;

        env.storage().persistent().set(&key, &stream);
        Self::bump_stream_storage_ttl(&env, stream_id, &stream.worker);

        env.events().publish(
            (
                Symbol::new(&env, "stream"),
                Symbol::new(&env, "resumed"),
                stream_id,
                admin,
            ),
            (now, paused_duration, stream.total_paused_duration),
        );

        Ok(())
    }
}
