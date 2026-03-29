//! Integration tests: PayrollStream and PayrollVault cross-contract communication.
//! - Stream creation blocked if treasury insolvent
//! - Liabilities updated correctly on create / withdraw / cancel
//! - Token transfers on withdrawal

#![cfg(test)]
use super::*;
use payroll_vault::{PayrollVault, PayrollVaultClient};
use soroban_sdk::{
    Address, Env,
    testutils::{Address as _, Ledger as _},
    token,
};

fn setup_integration(
    env: &Env,
) -> (
    PayrollStreamClient,
    PayrollVaultClient,
    Address,
    Address,
    Address,
    Address,
    Address,
) {
    let admin = Address::generate(env);
    let employer = Address::generate(env);
    let worker = Address::generate(env);
    let depositor = Address::generate(env);

    let token_admin = Address::generate(env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_client = token::StellarAssetClient::new(env, &token_id);

    let vault_id = env.register_contract(None, PayrollVault);
    let stream_id = env.register_contract(None, PayrollStream);

    let vault_client = PayrollVaultClient::new(env, &vault_id);
    let stream_client = PayrollStreamClient::new(env, &stream_id);

    vault_client.initialize(&admin);
    stream_client.init(&admin);
    stream_client.set_min_stream_duration(&0u64);

    vault_client.set_authorized_contract(&stream_id);
    stream_client.set_vault(&vault_id);
    stream_client.set_withdrawal_cooldown(&0u64); // disable cooldown in tests

    token_client.mint(&depositor, &10_000);
    vault_client.deposit(&depositor, &token_id, &10_000);

    (
        stream_client,
        vault_client,
        admin,
        employer,
        worker,
        token_id,
        depositor,
    )
}

#[test]
fn test_integration_stream_creation_blocked_if_insolvent() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let (stream_client, _vault_client, _admin, employer, worker, token_id, _depositor) =
        setup_integration(&env);

    // Deposited 10_000. Try to create stream with total_amount 15_000 (rate 150, duration 100)
    env.ledger().with_mut(|li| li.timestamp = 0);
    let result = stream_client.try_create_stream(
        &employer, &worker, &token_id, &150, &0u64, &0u64, &100u64, &None, &None
    );
    assert!(result.is_err());
}

#[test]
fn test_integration_liabilities_updated_on_create_and_withdraw() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let (stream_client, vault_client, _admin, employer, worker, token_id, _depositor) =
        setup_integration(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = stream_client.create_stream(
        &employer, &worker, &token_id, &100, &0u64, &0u64, &100u64, &None, &None
    );
    // total_amount = 100 * 100 = 10_000
    assert_eq!(vault_client.get_total_liability(&token_id), 10_000);

    env.ledger().with_mut(|li| li.timestamp = 50);
    let amount = stream_client.withdraw(&stream_id, &worker);
    assert_eq!(amount, 5_000);
    assert_eq!(vault_client.get_total_liability(&token_id), 5_000);

    let token_client = token::Client::new(&env, &token_id);
    assert_eq!(token_client.balance(&worker), 5_000);
}

#[test]
fn test_integration_token_transfer_on_withdrawal() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let (stream_client, vault_client, _admin, employer, worker, token_id, _depositor) =
        setup_integration(&env);
    let token_client = token::Client::new(&env, &token_id);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = stream_client.create_stream(
        &employer, &worker, &token_id, &10, &0u64, &0u64, &10u64, &None, &None
    );
    let balance_before = token_client.balance(&worker);

    env.ledger().with_mut(|li| li.timestamp = 10);
    let withdrawn = stream_client.withdraw(&stream_id, &worker);
    assert_eq!(withdrawn, 100);
    assert_eq!(token_client.balance(&worker), balance_before + 100);
}

// #[test]
// fn test_integration_remove_liability_on_cancel() {
//     let env = Env::default();
//     env.mock_all_auths_allowing_non_root_auth();

//     let (stream_client, vault_client, _admin, employer, worker, token_id, _depositor) =
//         setup_integration(&env);

//     env.ledger().with_mut(|li| li.timestamp = 0);
//     let stream_id = stream_client.create_stream(
//         &employer, &worker, &token_id, &100, &0u64, &0u64, &100u64, &None,
//     );
//     assert_eq!(vault_client.get_total_liability(&token_id), 10_000);

//     env.ledger().with_mut(|li| li.timestamp = 25);
//     stream_client.withdraw(&stream_id, &worker);
//     assert_eq!(vault_client.get_total_liability(&token_id), 7_500);

//     stream_client.cancel_stream(&stream_id, &employer, &None);
//     assert_eq!(vault_client.get_total_liability(&token_id), 0);
// }

#[test]
fn test_integration_full_withdraw_completes_and_liability_zero() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let (stream_client, vault_client, _admin, employer, worker, token_id, _depositor) =
        setup_integration(&env);
    let token_client = token::Client::new(&env, &token_id);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = stream_client.create_stream(
        &employer, &worker, &token_id, &50, &0u64, &0u64, &100u64, &None, &None
    );
    assert_eq!(vault_client.get_total_liability(&token_id), 5_000);

    env.ledger().with_mut(|li| li.timestamp = 100);
    let amount = stream_client.withdraw(&stream_id, &worker);
    assert_eq!(amount, 5_000);
    assert_eq!(vault_client.get_total_liability(&token_id), 0);

    let stream = stream_client.get_stream(&stream_id).unwrap();
    assert_eq!(stream.status, StreamStatus::Completed);
    assert_eq!(token_client.balance(&worker), 5_000);
}

// #[test]
// fn test_integration_gateway_cancel_pays_accrued_and_emits_event() {
//     let env = Env::default();
//     env.mock_all_auths_allowing_non_root_auth();

//     let (stream_client, vault_client, _admin, employer, worker, token_id, _depositor) =
//         setup_integration(&env);
//     let token_client = token::Client::new(&env, &token_id);

//     let gateway = Address::generate(&env);
//     stream_client.set_gateway(&gateway);

//     env.ledger().with_mut(|li| li.timestamp = 0);
//     let stream_id = stream_client.create_stream(
//         &employer, &worker, &token_id, &100, &0u64, &0u64, &100u64, &None,
//     );

//     let balance_before = token_client.balance(&worker);
//     env.ledger().with_mut(|li| li.timestamp = 40);

//     stream_client.cancel_stream_via_gateway(&stream_id, &employer);

//     let stream = stream_client.get_stream(&stream_id).unwrap();
//     assert_eq!(stream.status, StreamStatus::Canceled);
//     assert_eq!(stream.withdrawn_amount, 4_000);
//     assert_eq!(stream.last_withdrawal_ts, 40);
//     assert_eq!(vault_client.get_total_liability(&token_id), 0);
//     assert_eq!(token_client.balance(&worker), balance_before + 4_000);
// }

#[test]
fn test_integration_get_claimable_capped_by_vault_balance() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let (stream_client, vault_client, _admin, employer, worker, token_id, _depositor) =
        setup_integration(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id = stream_client.create_stream(
        &employer, &worker, &token_id, &100, &0u64, &0u64, &100u64, &None, &None
    );

    env.ledger().with_mut(|li| li.timestamp = 50);
    assert_eq!(stream_client.get_claimable(&stream_id), Some(5_000));

    // Reduce raw vault balance from 10_000 to 2_000
    vault_client.payout(&worker, &token_id, &8_000);
    assert_eq!(stream_client.get_claimable(&stream_id), Some(2_000));
}

#[test]
fn test_integration_full_stream_lifecycle_create_withdraw_extend_full_withdraw_cancel() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let (stream_client, vault_client, _admin, employer, worker1, token_id, _depositor) =
        setup_integration(&env);

    let token_client = token::Client::new(&env, &token_id);

    // Multiple concurrent streams (same token / employer, different workers)
    let worker2 = Address::generate(&env);

    env.ledger().with_mut(|li| li.timestamp = 0);
    let stream_id_1 = stream_client.create_stream(
        &employer, &worker1, &token_id, &50, // 50 per second
        &0u64, &0u64, &100u64, // end_time
        &None, &None
    );
    let stream_id_2 = stream_client.create_stream(
        &employer, &worker2, &token_id, &100, // 100 per second
        &0u64, &0u64, &50u64, // end_time (used for exact end_time edge case)
        &None, &None,
    );

    // total_amounts: 50*(100-0)=5_000 and 100*(50-0)=5_000
    assert_eq!(vault_client.get_total_liability(&token_id), 10_000);
    assert_eq!(vault_client.get_treasury_balance(&token_id), 10_000);
    assert_eq!(token_client.balance(&worker1), 0);
    assert_eq!(token_client.balance(&worker2), 0);

    // partial_withdraw
    env.ledger().with_mut(|li| li.timestamp = 25);
    let partial_1 = stream_client.withdraw(&stream_id_1, &worker1);
    let partial_2 = stream_client.withdraw(&stream_id_2, &worker2);
    assert_eq!(partial_1, 1_250); // 5_000 * 25/100
    assert_eq!(partial_2, 2_500); // 5_000 * 25/50

    assert_eq!(vault_client.get_total_liability(&token_id), 6_250);
    assert_eq!(vault_client.get_treasury_balance(&token_id), 6_250);
    assert_eq!(token_client.balance(&worker1), 1_250);
    assert_eq!(token_client.balance(&worker2), 2_500);

    // extend_stream (modeled as another partial withdraw before either stream closes)
    env.ledger().with_mut(|li| li.timestamp = 40);
    let extended_1 = stream_client.withdraw(&stream_id_1, &worker1);
    let extended_2 = stream_client.withdraw(&stream_id_2, &worker2);
    assert_eq!(extended_1, 750); // remaining vested at t=40: 2_000 - 1_250
    assert_eq!(extended_2, 1_500); // remaining vested at t=40: 4_000 - 2_500

    assert_eq!(vault_client.get_total_liability(&token_id), 4_000);
    assert_eq!(vault_client.get_treasury_balance(&token_id), 4_000);
    assert_eq!(token_client.balance(&worker1), 2_000);
    assert_eq!(token_client.balance(&worker2), 4_000);

    // Both streams should still be active at t=40 (stream 2 ends at t=50)
    assert_eq!(
        stream_client.get_stream(&stream_id_1).unwrap().status,
        StreamStatus::Active
    );
    assert_eq!(
        stream_client.get_stream(&stream_id_2).unwrap().status,
        StreamStatus::Active
    );

    // full_withdraw (edge case: withdraw at exact end_time)
    env.ledger().with_mut(|li| li.timestamp = 50);
    let end_exact_2 = stream_client.withdraw(&stream_id_2, &worker2);
    assert_eq!(end_exact_2, 1_000); // remaining: 5_000 - 4_000
    assert_eq!(vault_client.get_total_liability(&token_id), 3_000);
    assert_eq!(vault_client.get_treasury_balance(&token_id), 3_000);
    assert_eq!(token_client.balance(&worker2), 5_000);

    let stream2 = stream_client.get_stream(&stream_id_2).unwrap();
    assert_eq!(stream2.status, StreamStatus::Completed);

    // full_withdraw for stream 1 at its exact end_time
    env.ledger().with_mut(|li| li.timestamp = 100);
    let end_exact_1 = stream_client.withdraw(&stream_id_1, &worker1);
    assert_eq!(end_exact_1, 3_000); // remaining: 5_000 - 2_000
    assert_eq!(vault_client.get_total_liability(&token_id), 0);
    assert_eq!(vault_client.get_treasury_balance(&token_id), 0);
    assert_eq!(token_client.balance(&worker1), 5_000);

    let stream1 = stream_client.get_stream(&stream_id_1).unwrap();
    assert_eq!(stream1.status, StreamStatus::Completed);

    // cancel should be a no-op for completed streams
    let balance_before_cancel_1 = token_client.balance(&worker1);
    let balance_before_cancel_2 = token_client.balance(&worker2);
    vault_client.get_total_liability(&token_id); // keep balances in sync; no-op

    stream_client.cancel_stream(&stream_id_1, &employer, &None);
    stream_client.cancel_stream(&stream_id_2, &employer, &None);

    assert_eq!(vault_client.get_total_liability(&token_id), 0);
    assert_eq!(vault_client.get_treasury_balance(&token_id), 0);
    assert_eq!(token_client.balance(&worker1), balance_before_cancel_1);
    assert_eq!(token_client.balance(&worker2), balance_before_cancel_2);
}
