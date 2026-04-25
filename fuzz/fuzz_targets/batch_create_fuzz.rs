#![no_main]

use libfuzzer_sys::fuzz_target;
use payroll_stream::{PayrollStream, PayrollStreamClient, StreamParams, MaybeSpeedCurve};
use soroban_sdk::{Address, Env, testutils::Address as _, testutils::Ledger, Vec};
use arbitrary::Arbitrary;

mod dummy_vault {
    use soroban_sdk::{Address, Env, contract, contractimpl};
    #[contract]
    pub struct DummyVault;
    #[contractimpl]
    impl DummyVault {
        pub fn check_solvency(_env: Env, _token: Address, _additional_liability: i128) -> bool { true }
        pub fn add_liability(_env: Env, _token: Address, _amount: i128) {}
    }
}

#[derive(Arbitrary, Debug)]
struct BatchInput {
    params_count: u8,
    vault_deposit: i128,
    rate: i128,
    duration: u32,
}

fuzz_target!(|input: BatchInput| {
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

    let mut params = Vec::new(&env);
    let count = (input.params_count % 30) as u32; 

    for _ in 0..count {
        params.push_back(StreamParams {
            employer: employer.clone(),
            worker: worker.clone(),
            token: token.clone(),
            rate: input.rate,
            cliff_ts: 0,
            start_ts: 0,
            end_ts: input.duration as u64,
            metadata_hash: None,
            speed_curve: MaybeSpeedCurve::None,
            clawback_authority: None,
        });
    }

    let _ = client.try_create_stream_batch(&params, &input.vault_deposit);
});
