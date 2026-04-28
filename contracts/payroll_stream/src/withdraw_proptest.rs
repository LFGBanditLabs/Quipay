#![cfg(test)]
extern crate std;

use crate::{PayrollStream, PayrollStreamClient};
use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger, Address, Env};

mod dummy_vault {
    use soroban_sdk::{contract, contractimpl, Address, Env};

    #[contract]
    pub struct DummyVault;

    #[contractimpl]
    impl DummyVault {
        pub fn check_solvency(_env: Env, _token: Address, _additional_liability: i128) -> bool {
            true
        }
        pub fn add_liability(_env: Env, _token: Address, _amount: i128) {}
        pub fn is_token_allowed(_env: Env, _token: Address) -> bool {
            true
        }
        pub fn remove_liability(_env: Env, _token: Address, _amount: i128) {}
        pub fn payout_liability(_env: Env, _to: Address, _token: Address, _amount: i128) {}
    }
}

fn setup_stream(rate: i128, duration: u64, start_padding: u64) -> (Env, Address, u64, Address) {
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
    client.set_cancellation_grace_period(&0u64);
    client.set_withdrawal_cooldown(&0u64);
    client.set_min_stream_duration(&0u64);
    client.set_min_cancel_notice(&0u32);

    let initial_time = 1_000_000_000u64;
    env.ledger().set_timestamp(initial_time);

    let start_ts = initial_time.saturating_add(start_padding);
    let end_ts = start_ts.saturating_add(duration);
    let stream_id = client.create_stream(
        &employer, &worker, &token, &rate, &0u64, &start_ts, &end_ts, &None, &None,
    );

    (env, contract_id, stream_id, worker)
}

fn setup_stream_custom(
    env: &Env,
    admin: &Address,
    employer: &Address,
    worker: &Address,
    token: &Address,
    rate: i128,
    duration: u64,
    start_padding: u64,
    cliff_val: u64,
) -> (Address, u64) {
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(env, &contract_id);
    let vault_id = env.register_contract(None, dummy_vault::DummyVault);

    client.init(admin);
    client.set_vault(&vault_id);
    client.set_cancellation_grace_period(&0u64);
    client.set_withdrawal_cooldown(&0u64);
    client.set_min_stream_duration(&0u64);
    client.set_min_cancel_notice(&0u32);

    let initial_time = 1_000_000_000u64;
    env.ledger().set_timestamp(initial_time);

    let start_ts = initial_time.saturating_add(start_padding);
    let end_ts = start_ts.saturating_add(duration);

    let stream_id = client.create_stream(
        employer, worker, token, &rate, &cliff_val, &start_ts, &end_ts, &None, &None,
    );

    (contract_id, stream_id)
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(10_000))]

    #[test]
    fn prop_extreme_rate_duration_cliff_combinations(
        rate in 1i128..i128::MAX,
        duration in 1u64..u64::MAX,
        cliff_padding in 0u64..u64::MAX,
        elapsed in 0u64..u64::MAX,
    ) {
        let env = Env::default();
        env.mock_all_auths_allowing_non_root_auth();

        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let worker = Address::generate(&env);
        let token = Address::generate(&env);

        let initial_time = 1_000_000_000u64;
        let start_ts = initial_time.saturating_add(10);
        let end_ts = start_ts.saturating_add(duration);
        let cliff_ts = start_ts.saturating_add(cliff_padding);

        let cliff = if cliff_ts <= end_ts && cliff_ts >= start_ts {
            cliff_ts
        } else {
            start_ts
        };

        let contract_id = env.register_contract(None, PayrollStream);
        let client = PayrollStreamClient::new(&env, &contract_id);
        let vault_id = env.register_contract(None, dummy_vault::DummyVault);

        client.init(&admin);
        client.set_vault(&vault_id);
        client.set_cancellation_grace_period(&0u64);
        client.set_withdrawal_cooldown(&0u64);
        client.set_min_stream_duration(&0u64);
        client.set_min_cancel_notice(&0u32);

        env.ledger().set_timestamp(initial_time);

        // Create stream might fail due to overflow, which is acceptable (returns Error)
        // But it MUST NOT panic.
        let try_create = client.try_create_stream(
            &employer,
            &worker,
            &token,
            &rate,
            &cliff,
            &start_ts,
            &end_ts,
            &None,
            &None,
        );

        if let Ok(Ok(stream_id)) = try_create {
            // Stream creation succeeded, now test arithmetic at arbitrary time
            let stream = client.get_stream(&stream_id).unwrap();
            let now = start_ts.saturating_add(elapsed);
            env.ledger().set_timestamp(now);

            // This must not panic
            let accrued = PayrollStream::vested_amount_at(&stream, now);
            prop_assert!(accrued <= stream.total_amount);
            prop_assert!(accrued >= 0);

            // Withdraw must not panic
            let try_withdraw = client.try_withdraw(&stream_id, &worker);

            // Assert that if withdraw succeeded, the withdrawn amount is valid
            if let Ok(Ok(amount)) = try_withdraw {
                prop_assert!(amount >= 0);
            }
        }
    }

    #[test]
    fn prop_withdrawn_never_exceeds_accrued_or_total(
        rate in 1i128..1_000_000_000i128,
        duration in 1u64..31_536_000u64,
        elapsed in 0u64..63_072_000u64,
    ) {
        let (env, contract_id, stream_id, worker) = setup_stream(rate, duration, 10);
        let client = PayrollStreamClient::new(&env, &contract_id);

        let stream_before = client.get_stream(&stream_id).expect("stream must exist");
        let now = stream_before.start_ts.saturating_add(elapsed);
        env.ledger().set_timestamp(now);

        let _ = client.withdraw(&stream_id, &worker);

        let stream_after = client.get_stream(&stream_id).expect("stream must exist");
        let accrued = PayrollStream::vested_amount_at(&stream_after, now);

        prop_assert!(stream_after.withdrawn_amount <= accrued);
        prop_assert!(accrued <= stream_after.total_amount);
    }

    #[test]
    fn prop_double_withdraw_without_new_accrual_never_double_pays(
        rate in 1i128..1_000_000_000i128,
        duration in 2u64..31_536_000u64,
        elapsed_seed in 1u64..31_536_000u64,
    ) {
        let (env, contract_id, stream_id, worker) = setup_stream(rate, duration, 10);
        let client = PayrollStreamClient::new(&env, &contract_id);

        let stream_before = client.get_stream(&stream_id).expect("stream must exist");
        let active_elapsed = 1u64.saturating_add(elapsed_seed % duration.saturating_sub(1));
        let now = stream_before.start_ts.saturating_add(active_elapsed);
        env.ledger().set_timestamp(now);

        let first = client.withdraw(&stream_id, &worker);
        let second = client.withdraw(&stream_id, &worker);

        prop_assert!(first >= 0);
        prop_assert_eq!(second, 0);
    }

    #[test]
    fn prop_cumulative_withdrawals_stay_within_accrual(
        rate in 1i128..1_000_000_000i128,
        duration in 2u64..31_536_000u64,
        elapsed_1_seed in 0u64..31_536_000u64,
        elapsed_2_seed in 0u64..31_536_000u64,
    ) {
        let (env, contract_id, stream_id, worker) = setup_stream(rate, duration, 10);
        let client = PayrollStreamClient::new(&env, &contract_id);

        let stream_before = client.get_stream(&stream_id).expect("stream must exist");
        let t1_elapsed = elapsed_1_seed % duration.saturating_sub(1);
        let remaining = duration.saturating_sub(1).saturating_sub(t1_elapsed);
        let t2_elapsed = t1_elapsed.saturating_add(elapsed_2_seed % remaining.saturating_add(1));

        let t1 = stream_before.start_ts.saturating_add(t1_elapsed);
        let t2 = stream_before.start_ts.saturating_add(t2_elapsed);

        env.ledger().set_timestamp(t1);
        let _ = client.withdraw(&stream_id, &worker);

        env.ledger().set_timestamp(t2);
        let _ = client.withdraw(&stream_id, &worker);

        let stream_after = client.get_stream(&stream_id).expect("stream must exist");
        let accrued_at_t2 = PayrollStream::vested_amount_at(&stream_after, t2);

        prop_assert!(stream_after.withdrawn_amount <= accrued_at_t2);
        prop_assert!(stream_after.withdrawn_amount <= stream_after.total_amount);
    }
}
