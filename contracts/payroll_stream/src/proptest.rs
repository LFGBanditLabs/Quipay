#![cfg(test)]
extern crate std;

use crate::{PayrollStream, PayrollStreamClient};
use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger, Address, Env};

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
        total_amount in 1i128..1_000_000_000_000i128,
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

        client.init(&admin);

        let initial_time = 1_000_000_000u64;
        env.ledger().set_timestamp(initial_time);

        let start_ts = initial_time.saturating_add(start_offset);
        let end_ts = start_ts.saturating_add(duration);

        let stream_id = client.create_stream(&employer, &worker, &token, &total_amount, &start_ts, &end_ts);

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
                    client.cancel_stream(&stream_id, &employer);
                }));
            }

            if let Some(stream) = client.get_stream(&stream_id) {
                let withdrawn = stream.withdrawn_amount;
                let total = stream.total_amount;

                let is_closed = (stream.status_bits & 2) != 0 || (stream.status_bits & 4) != 0;
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
}
