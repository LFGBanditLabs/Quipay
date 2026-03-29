#![cfg(test)]
extern crate std;

use crate::{PayrollStream, PayrollStreamClient};
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

    let initial_time = 1_000_000_000u64;
    env.ledger().set_timestamp(initial_time);

    let start_ts = initial_time.saturating_add(start_padding);
    let end_ts = start_ts.saturating_add(duration);
    let stream_id = client.create_stream(
        &employer,
        &worker,
        &token,
        &rate,
        &0u64,
        &start_ts,
        &end_ts,
        &None,
        &None,
    );

    (env, contract_id, stream_id, worker)
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(10_000))]

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