#![cfg(test)]
use super::*;
use soroban_sdk::{
    Address, Bytes, BytesN, Env, contract, contractimpl,
    testutils::{Address as _, Ledger},
    token::StellarAssetClient,
};

#[contract]
struct MockPayrollStream;

#[contractimpl]
impl MockPayrollStream {
    pub fn create_stream_via_governance(
        _env: Env,
        _employer: Address,
        _worker: Address,
        _token: Address,
        _rate: i128,
        _cliff_ts: u64,
        _start_ts: u64,
        _end_ts: u64,
        _metadata_hash: Option<BytesN<32>>,
    ) -> u64 {
        777
    }
}

fn setup_env() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let gov_token_id = env.register_stellar_asset_contract_v2(admin.clone());
    let gov_token = gov_token_id.address();

    // Mint tokens to admin so they can propose
    let asset_client = StellarAssetClient::new(&env, &gov_token);
    asset_client.mint(&admin, &1_000_000_i128);

    let payroll_stream = env.register(MockPayrollStream, ());

    let contract_id = env.register(DaoGovernance, ());
    let client = DaoGovernanceClient::new(&env, &contract_id);
    client.init(&admin, &gov_token, &payroll_stream);
    // Set total supply for quorum calculations (matches minted amount)
    client.set_total_supply(&1_000_000_i128);

    (env, contract_id, admin, gov_token, payroll_stream)
}

fn make_description_hash(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

fn make_raw_call_data(env: &Env, label: &str) -> Bytes {
    Bytes::from_slice(env, label.as_bytes())
}

fn make_stream_params(env: &Env, employer: &Address) -> ProposalCallData {
    let worker = Address::generate(env);
    let token = Address::generate(env);
    ProposalCallData {
        employer: employer.clone(),
        worker,
        token,
        rate: 100_i128,
        cliff_ts: 1_000_u64,
        start_ts: 1_000_u64,
        end_ts: 2_000_u64,
        metadata_hash: None,
    }
}

#[test]
fn test_init() {
    let (env, contract_id, admin, _gov_token, _payroll_stream) = setup_env();
    let client = DaoGovernanceClient::new(&env, &contract_id);
    assert_eq!(client.get_admin(), admin);
}

#[test]
fn test_create_proposal() {
    let (env, contract_id, admin, _gov_token, _payroll_stream) = setup_env();
    let client = DaoGovernanceClient::new(&env, &contract_id);

    let params = make_stream_params(&env, &admin);
    let proposal_id = client.create_proposal(
        &admin,
        &make_description_hash(&env, 1),
        &params,
        &make_raw_call_data(&env, "alice-stream"),
    );
    assert_eq!(proposal_id, 1);

    let proposal = client.get_proposal(&1).unwrap();
    assert_eq!(proposal.status, ProposalStatus::Active);
    assert_eq!(proposal.votes_for, 0);
}

#[test]
fn test_vote_for() {
    let (env, contract_id, admin, gov_token, _payroll_stream) = setup_env();
    let client = DaoGovernanceClient::new(&env, &contract_id);

    let voter = Address::generate(&env);
    let asset_client = StellarAssetClient::new(&env, &gov_token);
    asset_client.mint(&voter, &500_000_i128);

    let params = make_stream_params(&env, &admin);
    let proposal_id = client.create_proposal(
        &admin,
        &make_description_hash(&env, 2),
        &params,
        &make_raw_call_data(&env, "bob-stream"),
    );

    client.vote(&voter, &proposal_id, &true);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.votes_for, 500_000_i128);
    assert_eq!(proposal.votes_against, 0);
}

#[test]
fn test_double_vote_rejected() {
    let (env, contract_id, admin, gov_token, _payroll_stream) = setup_env();
    let client = DaoGovernanceClient::new(&env, &contract_id);

    let voter = Address::generate(&env);
    StellarAssetClient::new(&env, &gov_token).mint(&voter, &100_000_i128);

    let params = make_stream_params(&env, &admin);
    let proposal_id = client.create_proposal(
        &admin,
        &make_description_hash(&env, 3),
        &params,
        &make_raw_call_data(&env, "double-vote"),
    );

    client.vote(&voter, &proposal_id, &true);
    // Second vote should fail
    let result = client.try_vote(&voter, &proposal_id, &true);
    assert!(result.is_err());
}

#[test]
fn test_finalize_passed() {
    let (env, contract_id, admin, gov_token, _payroll_stream) = setup_env();
    let client = DaoGovernanceClient::new(&env, &contract_id);

    // Mint enough tokens so quorum is met
    // total_supply = 1_000_000 (admin) + 600_000 (voter) = 1_600_000
    // quorum = 10% = 160_000; voter has 600_000 > 160_000 ✓
    // approval = >50%; 600_000 / 600_000 = 100% ✓
    let voter = Address::generate(&env);
    StellarAssetClient::new(&env, &gov_token).mint(&voter, &600_000_i128);

    let params = make_stream_params(&env, &admin);
    let proposal_id = client.create_proposal(
        &admin,
        &make_description_hash(&env, 4),
        &params,
        &make_raw_call_data(&env, "carol-stream"),
    );

    client.vote(&voter, &proposal_id, &true);

    // Advance ledger past voting period (default 3 days = 259200s)
    env.ledger().with_mut(|l| {
        l.timestamp += 259_201;
    });

    let status = client.finalize_proposal(&proposal_id);
    assert_eq!(status, ProposalStatus::Passed);
}

// ═══════════════════════════════════════════════════════════════════════════
// #946 — Quorum enforcement in execute_proposal tests
// ═══════════════════════════════════════════════════════════════════════════

/// When quorum IS met, execute_proposal succeeds.
#[test]
fn test_execute_proposal_quorum_met() {
    let (env, contract_id, admin, gov_token, _payroll_stream) = setup_env();
    let client = DaoGovernanceClient::new(&env, &contract_id);

    // 300_000 / 1_000_000 = 30% > default 10% quorum ✓
    let voter = Address::generate(&env);
    StellarAssetClient::new(&env, &gov_token).mint(&voter, &300_000_i128);

    let params = make_stream_params(&env, &admin);
    let proposal_id = client.create_proposal(
        &admin,
        &make_description_hash(&env, 11),
        &params,
        &make_raw_call_data(&env, "quorum-met"),
    );
    client.vote(&voter, &proposal_id, &true);

    // Advance past voting period + timelock
    env.ledger().with_mut(|l| {
        l.timestamp += 259_201 + 24 * 60 * 60 + 1;
    });

    let stream_id = client.execute_proposal(&admin, &proposal_id);
    assert_eq!(stream_id, 777);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.status, ProposalStatus::Executed);
}

/// When quorum is NOT met, execute_proposal returns QuorumNotMet.
#[test]
fn test_execute_proposal_quorum_not_met() {
    let (env, contract_id, admin, gov_token, _payroll_stream) = setup_env();
    let client = DaoGovernanceClient::new(&env, &contract_id);

    // 500 / 1_000_000 = 0.05% << 10% quorum ✗
    let voter = Address::generate(&env);
    StellarAssetClient::new(&env, &gov_token).mint(&voter, &500_i128);

    let params = make_stream_params(&env, &admin);
    let proposal_id = client.create_proposal(
        &admin,
        &make_description_hash(&env, 12),
        &params,
        &make_raw_call_data(&env, "quorum-fail"),
    );
    client.vote(&voter, &proposal_id, &true);

    env.ledger().with_mut(|l| {
        l.timestamp += 259_201 + 24 * 60 * 60 + 1;
    });

    let result = client.try_execute_proposal(&admin, &proposal_id);
    assert_eq!(result, Err(Ok(QuipayError::QuorumNotMet)));
}

/// Edge case: zero total_voting_power should not panic.
/// With total_supply = 1, quorum_threshold rounds to 0 (integer math), so
/// 0 votes_cast >= 0. But 0 for-votes fails the approval check → Rejected.
#[test]
fn test_execute_proposal_zero_total_voting_power() {
    let (env, contract_id, admin, _gov_token, _payroll_stream) = setup_env();
    let client = DaoGovernanceClient::new(&env, &contract_id);

    // Supply so tiny that quorum_threshold = 0 (integer division)
    client.set_total_supply(&1_i128);

    let params = make_stream_params(&env, &admin);
    let proposal_id = client.create_proposal(
        &admin,
        &make_description_hash(&env, 13),
        &params,
        &make_raw_call_data(&env, "zero-supply"),
    );
    // No votes cast

    env.ledger().with_mut(|l| {
        l.timestamp += 259_201 + 24 * 60 * 60 + 1;
    });

    // Rejected (no votes → approval fails) → QuorumNotMet from execute_proposal
    let result = client.try_execute_proposal(&admin, &proposal_id);
    assert_eq!(result, Err(Ok(QuipayError::QuorumNotMet)));
}
#[test]
fn test_finalize_rejected_no_quorum() {
    let (env, contract_id, admin, gov_token, _payroll_stream) = setup_env();
    let client = DaoGovernanceClient::new(&env, &contract_id);

    // total_supply = 1_000_500; voter has 500 (0.05%) < 10% quorum
    let voter = Address::generate(&env);
    StellarAssetClient::new(&env, &gov_token).mint(&voter, &500_i128);
    // Update total supply to reflect the new mint
    client.set_total_supply(&1_000_500_i128);

    let params = make_stream_params(&env, &admin);
    let proposal_id = client.create_proposal(
        &admin,
        &make_description_hash(&env, 5),
        &params,
        &make_raw_call_data(&env, "tiny-vote"),
    );

    client.vote(&voter, &proposal_id, &true);

    env.ledger().with_mut(|l| {
        l.timestamp += 259_201;
    });

    let status = client.finalize_proposal(&proposal_id);
    assert_eq!(status, ProposalStatus::Rejected);
}

#[test]
fn test_cannot_vote_after_window() {
    let (env, contract_id, admin, gov_token, _payroll_stream) = setup_env();
    let client = DaoGovernanceClient::new(&env, &contract_id);

    let voter = Address::generate(&env);
    StellarAssetClient::new(&env, &gov_token).mint(&voter, &100_000_i128);

    let params = make_stream_params(&env, &admin);
    let proposal_id = client.create_proposal(
        &admin,
        &make_description_hash(&env, 6),
        &params,
        &make_raw_call_data(&env, "late-vote"),
    );

    env.ledger().with_mut(|l| {
        l.timestamp += 259_201;
    });

    let result = client.try_vote(&voter, &proposal_id, &true);
    assert!(result.is_err());
}

#[test]
fn test_get_config() {
    let (env, contract_id, _admin, _gov_token, _payroll_stream) = setup_env();
    let client = DaoGovernanceClient::new(&env, &contract_id);
    let (voting_period, timelock_delay, quorum_bps, approval_bps) = client.get_config();
    assert_eq!(voting_period, 3 * 24 * 60 * 60);
    assert_eq!(timelock_delay, 24 * 60 * 60);
    assert_eq!(quorum_bps, 1000);
    assert_eq!(approval_bps, 5001);
}

#[test]
fn test_execute_proposal_enforces_timelock_then_executes() {
    let (env, contract_id, admin, gov_token, _payroll_stream) = setup_env();
    let client = DaoGovernanceClient::new(&env, &contract_id);

    let voter = Address::generate(&env);
    StellarAssetClient::new(&env, &gov_token).mint(&voter, &600_000_i128);
    client.set_total_supply(&1_600_000_i128);

    let params = make_stream_params(&env, &admin);
    let proposal_id = client.create_proposal(
        &admin,
        &make_description_hash(&env, 7),
        &params,
        &make_raw_call_data(&env, "timelock"),
    );

    client.vote(&voter, &proposal_id, &true);

    env.ledger().with_mut(|l| {
        l.timestamp += 259_201;
    });

    let status = client.finalize_proposal(&proposal_id);
    assert_eq!(status, ProposalStatus::Passed);

    let early = client.try_execute_proposal(&admin, &proposal_id);
    assert_eq!(early, Err(Ok(QuipayError::GracePeriodActive)));

    env.ledger().with_mut(|l| {
        l.timestamp += 24 * 60 * 60;
    });

    let stream_id = client.execute_proposal(&admin, &proposal_id);
    assert_eq!(stream_id, 777);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.status, ProposalStatus::Executed);
    assert_eq!(proposal.executed_by, Some(admin));
}

#[test]
fn test_cancel_proposal_allows_proposer_and_blocks_execution() {
    let (env, contract_id, admin, _gov_token, _payroll_stream) = setup_env();
    let client = DaoGovernanceClient::new(&env, &contract_id);

    let params = make_stream_params(&env, &admin);
    let proposal_id = client.create_proposal(
        &admin,
        &make_description_hash(&env, 8),
        &params,
        &make_raw_call_data(&env, "cancel-me"),
    );

    client.cancel_proposal(&admin, &proposal_id);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.status, ProposalStatus::Cancelled);

    let execute = client.try_execute_proposal(&admin, &proposal_id);
    assert!(execute.is_err());
}

#[test]
fn test_finalize_passed_at_exact_quorum_threshold() {
    let (env, contract_id, admin, gov_token, _payroll_stream) = setup_env();
    let client = DaoGovernanceClient::new(&env, &contract_id);

    let voter = Address::generate(&env);
    StellarAssetClient::new(&env, &gov_token).mint(&voter, &100_000_i128);
    client.set_total_supply(&1_000_000_i128);

    let params = make_stream_params(&env, &admin);
    let proposal_id = client.create_proposal(
        &admin,
        &make_description_hash(&env, 9),
        &params,
        &make_raw_call_data(&env, "exact-quorum"),
    );

    client.vote(&voter, &proposal_id, &true);

    env.ledger().with_mut(|l| {
        l.timestamp += 259_201;
    });

    let status = client.finalize_proposal(&proposal_id);
    assert_eq!(status, ProposalStatus::Passed);
}
