use dao_governance::{DaoGovernance, Proposal, ProposalPayload, ProposalStatus, ProposalType};
use quipay_common::QuipayError;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, BytesN, Env, Symbol, Vec,
};

#[test]
fn test_init() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let payroll_stream = Address::generate(&env);

    DaoGovernance::init(&env, admin.clone(), payroll_stream.clone()).unwrap();

    assert_eq!(DaoGovernance::get_admin(&env).unwrap(), admin);
    assert_eq!(DaoGovernance::get_payroll_stream(&env).unwrap(), payroll_stream);
}

#[test]
fn test_create_proposal() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let payroll_stream = Address::generate(&env);
    let proposer = Address::generate(&env);

    DaoGovernance::init(&env, admin, payroll_stream).unwrap();

    let proposal_id = DaoGovernance::create_proposal(
        &env,
        proposer.clone(),
        ProposalType::CreateStream,
        "Test Proposal".to_string(),
        "Test Description".to_string(),
        ProposalPayload::AdminChange {
            new_admin: Address::generate(&env),
        },
    ).unwrap();

    let proposal = DaoGovernance::get_proposal(&env, proposal_id).unwrap();
    assert_eq!(proposal.id, proposal_id);
    assert_eq!(proposal.proposer, proposer);
    assert_eq!(proposal.title, "Test Proposal");
    assert_eq!(proposal.status, ProposalStatus::Active);
}

#[test]
fn test_voting() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let payroll_stream = Address::generate(&env);
    let proposer = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    DaoGovernance::init(&env, admin, payroll_stream).unwrap();

    let proposal_id = DaoGovernance::create_proposal(
        &env,
        proposer,
        ProposalType::AdminChange,
        "Test Proposal".to_string(),
        "Test Description".to_string(),
        ProposalPayload::AdminChange {
            new_admin: Address::generate(&env),
        },
    ).unwrap();

    // Vote for the proposal
    DaoGovernance::vote(&env, voter1.clone(), proposal_id, true).unwrap();
    
    let proposal = DaoGovernance::get_proposal(&env, proposal_id).unwrap();
    assert_eq!(proposal.votes_for, 1);
    assert_eq!(proposal.votes_against, 0);
    assert_eq!(proposal.has_voted.len(), 1);
    assert!(proposal.has_voted.contains(&voter1));

    // Second vote
    DaoGovernance::vote(&env, voter2.clone(), proposal_id, true).unwrap();
    
    let proposal = DaoGovernance::get_proposal(&env, proposal_id).unwrap();
    assert_eq!(proposal.votes_for, 2);
    assert_eq!(proposal.has_voted.len(), 2);
    assert!(proposal.has_voted.contains(&voter2));
}

#[test]
fn test_double_voting_fails() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let payroll_stream = Address::generate(&env);
    let proposer = Address::generate(&env);
    let voter = Address::generate(&env);

    DaoGovernance::init(&env, admin, payroll_stream).unwrap();

    let proposal_id = DaoGovernance::create_proposal(
        &env,
        proposer,
        ProposalType::AdminChange,
        "Test Proposal".to_string(),
        "Test Description".to_string(),
        ProposalPayload::AdminChange {
            new_admin: Address::generate(&env),
        },
    ).unwrap();

    // First vote should succeed
    DaoGovernance::vote(&env, voter.clone(), proposal_id, true).unwrap();

    // Second vote should fail
    let result = DaoGovernance::vote(&env, voter, proposal_id, true);
    assert_eq!(result.unwrap_err(), QuipayError::AlreadyVoted);
}

#[test]
fn test_proposal_approval() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let payroll_stream = Address::generate(&env);
    let proposer = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    let voter3 = Address::generate(&env);

    DaoGovernance::init(&env, admin, payroll_stream).unwrap();

    let proposal_id = DaoGovernance::create_proposal(
        &env,
        proposer,
        ProposalType::AdminChange,
        "Test Proposal".to_string(),
        "Test Description".to_string(),
        ProposalPayload::AdminChange {
            new_admin: Address::generate(&env),
        },
    ).unwrap();

    // Vote for the proposal (default required votes is 3)
    DaoGovernance::vote(&env, voter1, proposal_id, true).unwrap();
    DaoGovernance::vote(&env, voter2, proposal_id, true).unwrap();
    DaoGovernance::vote(&env, voter3, proposal_id, true).unwrap();
    
    let proposal = DaoGovernance::get_proposal(&env, proposal_id).unwrap();
    assert_eq!(proposal.status, ProposalStatus::Approved);
    assert_eq!(proposal.votes_for, 3);
}

#[test]
fn test_execution_delay() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let payroll_stream = Address::generate(&env);
    let proposer = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    let voter3 = Address::generate(&env);
    let executor = Address::generate(&env);

    DaoGovernance::init(&env, admin, payroll_stream).unwrap();

    // Set execution delay to 0 for testing
    DaoGovernance::set_execution_delay(&env, 0).unwrap();

    let proposal_id = DaoGovernance::create_proposal(
        &env,
        proposer,
        ProposalType::AdminChange,
        "Test Proposal".to_string(),
        "Test Description".to_string(),
        ProposalPayload::AdminChange {
            new_admin: Address::generate(&env),
        },
    ).unwrap();

    // Vote for the proposal
    DaoGovernance::vote(&env, voter1, proposal_id, true).unwrap();
    DaoGovernance::vote(&env, voter2, proposal_id, true).unwrap();
    DaoGovernance::vote(&env, voter3, proposal_id, true).unwrap();
    
    // Execute the proposal
    DaoGovernance::execute_proposal(&env, executor, proposal_id).unwrap();
    
    let proposal = DaoGovernance::get_proposal(&env, proposal_id).unwrap();
    assert_eq!(proposal.status, ProposalStatus::Executed);
}
