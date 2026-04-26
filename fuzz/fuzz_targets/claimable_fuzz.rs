#![no_main]

use libfuzzer_sys::fuzz_target;
use payroll_stream::{PayrollStream, PayrollStreamClient};
use soroban_sdk::{Address, Env, testutils::Address as _, testutils::Ledger};
use arbitrary::Arbitrary;

mod dummy_vault {
    use soroban_sdk::{Address, Env, contract, contractimpl};
    #[contract]
    pub struct DummyVault;
    #[contractimpl]
    impl DummyVault {
        pub fn check_solvency(_env: Env, _token: Address, _additional_liability: i128) -> bool { true }
        pub fn add_liability(_env: Env, _token: Address, _amount: i128) {}
        pub fn get_balance(_env: Env, _token: Address) -> i128 { 1_000_000_000_000 }
    }
}

#[derive(Arbitrary, Debug)]
struct ClaimableInput {
    rate: i128,
    duration: u32,
    time_advance: u32,
}

fuzz_target!(|input: ClaimableInput| {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);
    let vault_id = env.register_contract(None, dummy_vault::DummyVault);

    let _ = client.try_init(&admin);
    let _ = client.try_set_vault(&vault_id);

    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);

    let now = 1_700_000_000u64;
    env.ledger().set_timestamp(now);

    let start_ts = now;
    let end_ts = now.saturating_add(input.duration as u64);

    let result = client.try_create_stream(
        &employer,
        &worker,
        &token,
        &input.rate,
        &start_ts,
        &start_ts,
        &end_ts,
        &None,
        &None,
    );

    if let Ok(Ok(stream_id)) = result {
        env.ledger().set_timestamp(now.saturating_add(input.time_advance as u64));
        let _ = client.get_claimable(&stream_id);
    }
});
