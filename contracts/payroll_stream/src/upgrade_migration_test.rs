#![cfg(test)]

use super::*;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger as _},
    Address, Env,
};

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

    pub fn is_token_allowed(_env: Env, _token: Address) -> bool {
        true
    }
}

fn legacy_stream(employer: &Address, worker: &Address, token: &Address) -> Stream {
    Stream {
        employer: employer.clone(),
        worker: worker.clone(),
        token: token.clone(),
        rate: 10,
        cliff_ts: 0,
        start_ts: 0,
        end_ts: 100,
        total_amount: 1000,
        withdrawn_amount: 0,
        last_withdrawal_ts: 0,
        status: StreamStatus::Active,
        created_at: 0,
        closed_at: 0,
        paused_at: 0,
        total_paused_duration: 0,
        metadata_hash: None,
        cancel_effective_at: 0,
        start_ledger: 0,
        speed_curve: stream_curve::SpeedCurve::Linear,
        clawback_authority: None,
        expected_exchange_rate_bps: 10_000,
        max_slippage_bps: 0,
    }
}

fn seed_legacy_state(
    env: &Env,
    contract_id: &Address,
    admin: &Address,
    employer: &Address,
    worker: &Address,
    token: &Address,
    vault_id: &Address,
) {
    env.as_contract(contract_id, || {
        env.storage().instance().set(&DataKey::Admin, admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::Vault, vault_id);
        env.storage()
            .instance()
            .set(&DataKey::RetentionSecs, &DEFAULT_RETENTION_SECS);
        env.storage()
            .instance()
            .set(&DataKey::WithdrawalCooldown, &0u64);
        env.storage().instance().set(&DataKey::NextStreamId, &2u64);
        env.storage().instance().set(&DataKey::NextReceiptId, &2u64);

        let stream = legacy_stream(employer, worker, token);
        env.storage()
            .persistent()
            .set(&StreamKey::Stream(1), &stream);
        env.storage().persistent().set(
            &StreamKey::EmployerStreams(employer.clone()),
            &soroban_sdk::vec![env, 1u64],
        );
        env.storage().persistent().set(
            &StreamKey::WorkerStreams(worker.clone()),
            &soroban_sdk::vec![env, 1u64],
        );
        env.storage()
            .persistent()
            .set(&DataKey::LastWithdrawal(worker.clone()), &33u64);

        let receipt = PaymentReceipt {
            receipt_id: 1,
            stream_id: 1,
            employer: employer.clone(),
            worker: worker.clone(),
            token: token.clone(),
            total_amount: 1000,
            total_paid: 250,
            created_at: 0,
            start_ts: 0,
            end_ts: 100,
            finalized_at: 25,
            status: ReceiptStatus::Cancelled,
        };
        env.storage()
            .persistent()
            .set(&DataKey::ReceiptById(1), &receipt);
        env.storage()
            .persistent()
            .set(&DataKey::ReceiptByStream(1), &1u64);
    });
}

#[test]
fn test_legacy_storage_is_migrated_on_first_read() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);
    let vault_id = env.register_contract(None, DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    seed_legacy_state(
        &env,
        &contract_id,
        &admin,
        &employer,
        &worker,
        &token,
        &vault_id,
    );

    let stream = client.get_stream(&1).unwrap();
    assert_eq!(stream.worker, worker);
    assert_eq!(
        client.get_streams_by_worker(&worker, &None, &None).get(0),
        Some(1u64)
    );
    assert_eq!(client.get_receipt_for_stream(&1).receipt_id, 1);

    env.as_contract(&contract_id, || {
        let storage_version: u32 = env
            .storage()
            .instance()
            .get(&DataKey::StorageVersion)
            .unwrap();
        assert_eq!(storage_version, CURRENT_STORAGE_VERSION);

        let migrated_stream: Stream = env
            .storage()
            .persistent()
            .get(&PersistentDataKey::StreamV2(StreamKey::Stream(1)))
            .unwrap();
        assert_eq!(migrated_stream.employer, employer);

        let worker_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&PersistentDataKey::StreamV2(StreamKey::WorkerStreams(
                worker.clone(),
            )))
            .unwrap();
        assert_eq!(worker_ids.get(0), Some(1u64));

        let receipt_id: u64 = env
            .storage()
            .persistent()
            .get(&PersistentDataKey::ReceiptByStreamV2(1))
            .unwrap();
        assert_eq!(receipt_id, 1u64);
    });
}

#[test]
fn test_legacy_storage_migrates_before_mutation_paths() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    let token = Address::generate(&env);
    let vault_id = env.register_contract(None, DummyVault);
    let contract_id = env.register_contract(None, PayrollStream);
    let client = PayrollStreamClient::new(&env, &contract_id);

    seed_legacy_state(
        &env,
        &contract_id,
        &admin,
        &employer,
        &worker,
        &token,
        &vault_id,
    );

    env.ledger().with_mut(|li| li.timestamp = 50);
    let withdrawn = client.withdraw(&1, &worker);
    assert_eq!(withdrawn, 500);

    let migrated = client.get_stream(&1).unwrap();
    assert_eq!(migrated.withdrawn_amount, 500);

    env.as_contract(&contract_id, || {
        let storage_version: u32 = env
            .storage()
            .instance()
            .get(&DataKey::StorageVersion)
            .unwrap();
        assert_eq!(storage_version, CURRENT_STORAGE_VERSION);

        let last_withdrawal: u64 = env
            .storage()
            .persistent()
            .get(&PersistentDataKey::LastWithdrawalV2(worker.clone()))
            .unwrap();
        assert_eq!(last_withdrawal, 50);
    });
}
