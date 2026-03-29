#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Env, String,
};

fn setup_env() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let gov_token_id = env.register_stellar_asset_contract_v2(admin.clone());
    let gov_token = gov_token_id.address();

    // Mint tokens to admin so they can propose
    let asset_client = StellarAssetClient::new(&env, &gov_token);
    asset_client.mint(&admin, &1_000_000_i128);

    // Register a dummy payroll stream contract (we use a plain address for unit tests)
    let payroll_stream = Address::generate(&env);

    let contract_id = env.register(DaoGovernance, ());
    let client = DaoGovernanceClient::new(&env, &contract_id);
    client.init(&admin, &gov_token, &payroll_stream);
    // Set total supply for quorum calculations (matches minted amount)
    client.set_total_supply(&1_000_000_i128);

    (env, contract_id, admin, gov_token, payroll_stream)
}

fn make_stream_params(env: &Env, employer: &Address) -> StreamProposalParams {
    let worker = Address::generate(env);
    let token = Address::generate(env);
    StreamProposalParams {
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
        &String::from_str(&env, "Pay Alice"),
        &String::from_str(&env, "Stream 100 XLM/s to Alice"),
        &params,
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
        &String::from_str(&env, "Pay Bob"),
        &String::from_str(&env, "Stream to Bob"),
        &params,
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
        &String::from_str(&env, "Test"),
        &String::from_str(&env, "Test desc"),
        &params,
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
        &String::from_str(&env, "Hire Carol"),
        &String::from_str(&env, "Stream to Carol"),
        &params,
    );

    client.vote(&voter, &proposal_id, &true);

    // Advance ledger past voting period (default 3 days = 259200s)
    env.ledger().with_mut(|l| {
        l.timestamp += 259_201;
    });

    let status = client.finalize_proposal(&proposal_id);
    assert_eq!(status, ProposalStatus::Passed);
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
        &String::from_str(&env, "Tiny vote"),
        &String::from_str(&env, "desc"),
        &params,
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
        &String::from_str(&env, "Late vote"),
        &String::from_str(&env, "desc"),
        &params,
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
    let (voting_period, quorum_bps, approval_bps) = client.get_config();
    assert_eq!(voting_period, 3 * 24 * 60 * 60);
    assert_eq!(quorum_bps, 1000);
    assert_eq!(approval_bps, 5001);
}
