#![cfg(test)]
extern crate std;

use crate::{PayrollStream, PayrollStreamClient, Stream, StreamStatus};
use proptest::prelude::*;
use soroban_sdk::{Address, Env, testutils::Address as _, testutils::Ledger};

mod dummy_vault {
    use soroban_sdk::{Address, Env, contract, contractimpl};
    #[contract]
    pub struct DummyVault;
    #[contractimpl]
    impl DummyVault {
        pub fn check_solvency(_env: Env, _token: Address, _additional_liability: i128) -> bool {
            true
        }
        pub fn add_liability(_env: Env, _token: Address, _amount: i128) {}
        pub fn remove_liability(_env: Env, _token: Address, _amount: i128) {}
        pub fn payout_liability(_env: Env, _to: Address, _token: Address, _amount: i128) {}
    }
}

fn time_leap_strategy() -> impl Strategy<Value = u64> {
    0u64..50_000_000u64
}

fn action_strategy() -> impl Strategy<Value = u32> {
    0u32..2u32
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(500))]
    #[test]
    fn fuzz_stream_invariant(
        rate in 1i128..1_000_000_000_000i128,
        start_offset in 10u64..10_000u64,
        duration in 1u64..31_536_000u64,
        time_leaps in prop::collection::vec(time_leap_strategy(), 1..50),
        actions in prop::collection::vec(action_strategy(), 1..50)
    ) {
        let env = Env::default();
        env.mock_all_auths_allowing_non_root_auth();

        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let worker = Address::generate(&env);
        let token = Address::generate(&env);

        let contract_id = env.register_contract(None, PayrollStream);
        let client = PayrollStreamClient::new(&env, &contract_id);

        let vault_id = env.register_contract(None, dummy_vault::DummyVault);

        client.init(&admin);
        client.set_vault(&vault_id);
        client.set_cancellation_grace_period(&0u64); // disable grace period for prop tests

        let initial_time = 1_000_000_000u64;
        env.ledger().set_timestamp(initial_time);

        let start_ts = initial_time.saturating_add(start_offset);
        let end_ts = start_ts.saturating_add(duration);

        let stream_id = client.create_stream(&employer, &worker, &token, &rate, &0u64, &start_ts, &end_ts, &None);

        let mut current_time = initial_time;
        let steps = std::cmp::min(time_leaps.len(), actions.len());

        for i in 0..steps {
            current_time = current_time.saturating_add(time_leaps[i]);
            env.ledger().set_timestamp(current_time);

            if actions[i] == 0 {
                let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    client.withdraw(&stream_id, &worker);
                }));
            } else {
                let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    client.cancel_stream(&stream_id, &employer, &None);
                }));
            }

            if let Some(stream) = client.get_stream(&stream_id) {
                let withdrawn = stream.withdrawn_amount;
                let total = stream.total_amount;

                let is_closed = stream.status == StreamStatus::Canceled || stream.status == StreamStatus::Completed;
                let effective_now = if is_closed { stream.closed_at } else { current_time };

                let accrued = if effective_now <= stream.start_ts {
                    0
                } else if effective_now >= stream.end_ts {
                    total
                } else {
                    let elapsed = effective_now - stream.start_ts;
                    let duration = stream.end_ts - stream.start_ts;
                    (total * (elapsed as i128)) / (duration as i128)
                };

                assert!(withdrawn <= accrued, "INVARIANT VIOLATION: Withdrawn ({}) > Accrued ({})", withdrawn, accrued);
                assert!(accrued <= total, "INVARIANT VIOLATION: Accrued ({}) > Total ({})", accrued, total);
                assert!(withdrawn >= 0, "Withdrawn is negative: {}", withdrawn);
            }
        }
    }

    #[test]
    fn prop_vested_mid_stream_active(
        start_ts in 100_000u64..200_000u64,
        duration in 10_000u64..100_000u64,
        total in 1_000i128..1_000_000_000_000i128,
        query_offset in 1u64..9_999u64,
    ) {
        let env = Env::default();
        let end_ts = start_ts + duration;
        let query_ts = start_ts + query_offset;
        let stream = construct_stream(&env, start_ts, end_ts, 0, total, StreamStatus::Active, 0);
        let vested = PayrollStream::vested_amount_at(&stream, query_ts);
        prop_assert!(vested >= 0);
        prop_assert!(vested <= total);
        let expected = (total * (query_offset as i128)) / (duration as i128);
        prop_assert_eq!(vested, expected);
    }

    #[test]
    fn prop_vested_pre_start(
        start_ts in 100_000u64..200_000u64,
        duration in 10_000u64..100_000u64,
        total in 1_000i128..1_000_000_000_000i128,
        pre_offset in 1u64..100_000u64,
    ) {
        let env = Env::default();
        let query_ts = start_ts - pre_offset;
        let stream = construct_stream(&env, start_ts, start_ts + duration, 0, total, StreamStatus::Active, 0);
        let vested = PayrollStream::vested_amount_at(&stream, query_ts);
        prop_assert_eq!(vested, 0);
    }

    #[test]
    fn prop_vested_post_end(
        start_ts in 100_000u64..200_000u64,
        duration in 10_000u64..100_000u64,
        total in 1_000i128..1_000_000_000_000i128,
        post_offset in 0u64..100_000u64,
    ) {
        let env = Env::default();
        let end_ts = start_ts + duration;
        let query_ts = end_ts + post_offset;
        let stream = construct_stream(&env, start_ts, end_ts, 0, total, StreamStatus::Active, 0);
        let vested = PayrollStream::vested_amount_at(&stream, query_ts);
        prop_assert_eq!(vested, total);
    }

    #[test]
    fn prop_vested_pre_cliff(
        start_ts in 100_000u64..200_000u64,
        cliff_dur in 1_000u64..10_000u64,
        duration in 20_000u64..100_000u64,
        total in 1_000i128..1_000_000_000_000i128,
        query_offset in 1u64..999u64,
    ) {
        let env = Env::default();
        let cliff_ts = start_ts + cliff_dur;
        let query_ts = start_ts + query_offset;
        let stream = construct_stream(&env, start_ts, start_ts + duration, cliff_ts, total, StreamStatus::Active, 0);
        let vested = PayrollStream::vested_amount_at(&stream, query_ts);
        prop_assert_eq!(vested, 0);
    }

    #[test]
    fn prop_vested_post_cliff(
        start_ts in 100_000u64..200_000u64,
        cliff_dur in 1_000u64..10_000u64,
        duration in 20_000u64..100_000u64,
        total in 1_000i128..1_000_000_000_000i128,
        query_offset in 10_000u64..19_999u64,
    ) {
        let env = Env::default();
        let cliff_ts = start_ts + cliff_dur;
        let query_ts = start_ts + query_offset;
        let stream = construct_stream(&env, start_ts, start_ts + duration, cliff_ts, total, StreamStatus::Active, 0);
        let vested = PayrollStream::vested_amount_at(&stream, query_ts);
        let expected = (total * (query_offset as i128)) / (duration as i128);
        prop_assert_eq!(vested, expected);
        prop_assert!(vested >= 0);
        prop_assert!(vested <= total);
    }

    #[test]
    fn prop_vested_canceled_mid_stream_queried_after(
        start_ts in 100_000u64..200_000u64,
        duration in 20_000u64..100_000u64,
        total in 1_000i128..1_000_000_000_000i128,
        cancel_offset in 1u64..19_999u64,
        query_post_offset in 1u64..50_000u64,
    ) {
        let env = Env::default();
        let end_ts = start_ts + duration;
        let closed_at = start_ts + cancel_offset;
        let query_ts = closed_at + query_post_offset;
        let stream = construct_stream(&env, start_ts, end_ts, 0, total, StreamStatus::Canceled, closed_at);
        let vested = PayrollStream::vested_amount_at(&stream, query_ts);
        let expected = (total * (cancel_offset as i128)) / (duration as i128);
        prop_assert_eq!(vested, expected);
        prop_assert!(vested >= 0);
        prop_assert!(vested <= total);
    }

    #[test]
    fn prop_vested_canceled_mid_stream_queried_before_cancel(
        start_ts in 100_000u64..200_000u64,
        duration in 20_000u64..100_000u64,
        total in 1_000i128..1_000_000_000_000i128,
        cancel_offset in 10_000u64..19_999u64,
        query_offset in 1u64..9_999u64,
    ) {
        let env = Env::default();
        let end_ts = start_ts + duration;
        let closed_at = start_ts + cancel_offset;
        let query_ts = start_ts + query_offset;
        let stream = construct_stream(&env, start_ts, end_ts, 0, total, StreamStatus::Canceled, closed_at);
        let vested = PayrollStream::vested_amount_at(&stream, query_ts);
        let expected = (total * (query_offset as i128)) / (duration as i128);
        prop_assert_eq!(vested, expected);
        prop_assert!(vested >= 0);
        prop_assert!(vested <= total);
    }

    #[test]
    fn prop_vested_canceled_before_cliff(
        start_ts in 100_000u64..200_000u64,
        cliff_dur in 10_000u64..20_000u64,
        duration in 30_000u64..100_000u64,
        total in 1_000i128..1_000_000_000_000i128,
        cancel_offset in 1u64..9_999u64,
        query_offset in 1u64..50_000u64,
    ) {
        let env = Env::default();
        let cliff_ts = start_ts + cliff_dur;
        let closed_at = start_ts + cancel_offset;
        let end_ts = start_ts + duration;
        let query_ts = cliff_ts + query_offset;
        let stream = construct_stream(&env, start_ts, end_ts, cliff_ts, total, StreamStatus::Canceled, closed_at);
        let vested = PayrollStream::vested_amount_at(&stream, query_ts);
        prop_assert_eq!(vested, 0);
    }

    #[test]
    fn prop_vested_completed_mid_stream(
        start_ts in 100_000u64..200_000u64,
        duration in 20_000u64..100_000u64,
        total in 1_000i128..1_000_000_000_000i128,
        closed_offset in 10_000u64..19_999u64,
        query_offset in 20_000u64..50_000u64,
    ) {
        let env = Env::default();
        let end_ts = start_ts + duration;
        let closed_at = start_ts + closed_offset;
        let query_ts = start_ts + query_offset;
        let stream = construct_stream(&env, start_ts, end_ts, 0, total, StreamStatus::Completed, closed_at);
        let vested = PayrollStream::vested_amount_at(&stream, query_ts);
        prop_assert_eq!(vested, total);
    }

    #[test]
    fn prop_vested_completed_after_end(
        start_ts in 100_000u64..200_000u64,
        duration in 20_000u64..100_000u64,
        total in 1_000i128..1_000_000_000_000i128,
        closed_post_offset in 10u64..10_000u64,
        query_post_offset in 20u64..50_000u64,
    ) {
        let env = Env::default();
        let end_ts = start_ts + duration;
        let closed_at = end_ts + closed_post_offset;
        let query_ts = end_ts + query_post_offset;
        let stream = construct_stream(&env, start_ts, end_ts, 0, total, StreamStatus::Completed, closed_at);
        let vested = PayrollStream::vested_amount_at(&stream, query_ts);
        prop_assert_eq!(vested, total);
    }

    #[test]
    fn prop_vested_zero_duration(
        start_ts in 100_000u64..200_000u64,
        total in 1_000i128..1_000_000_000_000i128,
        query_offset in 0u64..10_000u64,
    ) {
        let env = Env::default();
        let end_ts = start_ts;
        let query_ts = start_ts + query_offset;
        let stream = construct_stream(&env, start_ts, end_ts, 0, total, StreamStatus::Active, 0);
        let vested = PayrollStream::vested_amount_at(&stream, query_ts);
        prop_assert_eq!(vested, total);
        prop_assert!(vested >= 0);
        prop_assert!(vested <= total);
    }

    #[test]
    fn prop_vested_invariant_bounds(
        start_ts in 0u64..1_000_000u64,
        duration in 0u64..1_000_000u64,
        cliff_dur in 0u64..1_000_000u64,
        total in 0i128..1_000_000_000_000i128,
        query_ts in 0u64..2_000_000u64,
        status in prop::sample::select(std::vec![StreamStatus::Active, StreamStatus::Canceled, StreamStatus::Completed]),
        closed_at in 0u64..2_000_000u64,
    ) {
        let env = Env::default();
        let end_ts = start_ts.saturating_add(duration);
        let cliff_ts = start_ts.saturating_add(cliff_dur);
        let stream = construct_stream(&env, start_ts, end_ts, cliff_ts, total, status, closed_at);
        let vested = PayrollStream::vested_amount_at(&stream, query_ts);
        prop_assert!(vested >= 0, "vested({}) is negative", vested);
        prop_assert!(vested <= total, "vested({}) exceeds total({})", vested, total);
    }
}

fn construct_stream(
    env: &Env,
    start_ts: u64,
    end_ts: u64,
    cliff_ts: u64,
    total_amount: i128,
    status: StreamStatus,
    closed_at: u64,
) -> Stream {
    Stream {
        employer: Address::generate(env),
        worker: Address::generate(env),
        token: Address::generate(env),
        rate: 100,
        cliff_ts,
        start_ts,
        end_ts,
        total_amount,
        withdrawn_amount: 0,
        last_withdrawal_ts: 0,
        status,
        created_at: start_ts.saturating_sub(100),
        closed_at,
        paused_at: 0,
        total_paused_duration: 0,
        metadata_hash: None,
        cancel_effective_at: 0,
    }
}

#[test]
#[ignore = "fuzz-style coverage for streamed amount edge cases"]
fn fuzz_compute_streamed_edge_cases() {
    let env = Env::default();
    let start_ts = 1_700_000_000u64;
    let mut seed = 0xDEADBEEFCAFEBABEu64;

    for _ in 0..10_000 {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        let total_amount = ((seed >> 1) % 1_000_000_000u64) as i128;

        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        let duration = seed % 10_000u64;

        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        let query_offset = seed % (duration.saturating_add(5_001));

        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        let mut t1_offset = seed % (duration.saturating_add(1));

        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        let mut t2_offset = seed % (duration.saturating_add(1));

        if t1_offset > t2_offset {
            core::mem::swap(&mut t1_offset, &mut t2_offset);
        }

        let end_ts = start_ts.saturating_add(duration);
        let stream = construct_stream(
            &env,
            start_ts,
            end_ts,
            0,
            total_amount,
            StreamStatus::Active,
            0,
        );

        let streamed_at_query =
            PayrollStream::vested_amount_at(&stream, start_ts.saturating_add(query_offset));
        let streamed_at_end = PayrollStream::vested_amount_at(&stream, end_ts);
        let streamed_t1 =
            PayrollStream::vested_amount_at(&stream, start_ts.saturating_add(t1_offset));
        let streamed_t2 =
            PayrollStream::vested_amount_at(&stream, start_ts.saturating_add(t2_offset));

        assert!(
            streamed_at_query <= total_amount,
            "streamed amount exceeded total: streamed={}, total={}, duration={}, query_offset={}",
            streamed_at_query,
            total_amount,
            duration,
            query_offset
        );
        assert_eq!(
            streamed_at_end, total_amount,
            "streamed amount at end should equal total: total={}, duration={}",
            total_amount, duration
        );
        assert!(
            streamed_t1 <= streamed_t2,
            "streamed amount must be monotonic: t1={}, t2={}, streamed_t1={}, streamed_t2={}, duration={}, total={}",
            t1_offset,
            t2_offset,
            streamed_t1,
            streamed_t2,
            duration,
            total_amount
        );
    }
}
