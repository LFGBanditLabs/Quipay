//! DAO Governance Contract
//!
//! Implements a proposal lifecycle for governance-gated payroll stream creation:
//!   1. Any DAO member (token holder) can `create_proposal` with stream params.
//!   2. Members call `vote` (for/against) during the voting window.
//!   3. After the voting window closes and quorum/threshold is met, any member
//!      can call `execute_proposal` which cross-invokes PayrollStream.create_stream.
//!
//! Storage layout
//! ──────────────
//! Instance (short-lived config):
//!   Admin, GovernanceToken, PayrollStream, VotingPeriod, QuorumBps, ApprovalThresholdBps
//!
//! Persistent (per-proposal):
//!   Proposal(u64), VoteCast(u64, Address)

#![no_std]
use quipay_common::{QuipayError, require};
use soroban_sdk::{
    Address, BytesN, Env, IntoVal, Symbol, Vec, contract, contractimpl, contracttype,
    symbol_short, token,
};

// ─── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    GovernanceToken,  // Token used for voting weight
    PayrollStream,    // PayrollStream contract address
    VotingPeriod,     // Seconds a proposal is open for voting
    QuorumBps,        // Minimum % of total supply that must vote (basis points)
    ApprovalBps,      // Minimum % of votes that must be FOR (basis points)
    NextProposalId,
    Proposal(u64),
    VoteCast(u64, Address), // (proposal_id, voter) -> bool (true=for, false=against)
    TotalSupply,            // Governance token total supply (admin-maintained)
}

// ─── Types ────────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ProposalStatus {
    Active = 0,
    Passed = 1,
    Rejected = 2,
    Executed = 3,
    Expired = 4,
}

/// Parameters for the payroll stream to be created upon execution.
#[contracttype]
#[derive(Clone, Debug)]
pub struct StreamProposalParams {
    pub employer: Address,
    pub worker: Address,
    pub token: Address,
    pub rate: i128,
    pub cliff_ts: u64,
    pub start_ts: u64,
    pub end_ts: u64,
    pub metadata_hash: Option<BytesN<32>>,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Proposal {
    pub id: u64,
    pub proposer: Address,
    pub title: soroban_sdk::String,
    pub description: soroban_sdk::String,
    pub stream_params: StreamProposalParams,
    pub created_at: u64,
    pub voting_ends_at: u64,
    pub votes_for: i128,
    pub votes_against: i128,
    pub status: ProposalStatus,
    pub executed_at: u64,
    pub executed_by: Option<Address>,
    /// Minimum total votes required for quorum (pre-computed at proposal creation).
    pub quorum_threshold: i128,
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_VOTING_PERIOD: u64 = 3 * 24 * 60 * 60; // 3 days
const DEFAULT_QUORUM_BPS: u32 = 1000; // 10%
const DEFAULT_APPROVAL_BPS: u32 = 5001; // >50%
const BPS_DENOMINATOR: i128 = 10_000;

// Storage TTL (in ledgers)
const STORAGE_TTL_THRESHOLD: u32 = 500_000;
const STORAGE_TTL_EXTEND: u32 = 1_000_000;

// Event symbols
const PROPOSAL_CREATED: Symbol = symbol_short!("prop_new");
const VOTE_CAST: Symbol = symbol_short!("voted");
const PROPOSAL_EXECUTED: Symbol = symbol_short!("prop_exec");
const PROPOSAL_FINALIZED: Symbol = symbol_short!("prop_fin");

#[contract]
pub struct DaoGovernance;

#[contractimpl]
impl DaoGovernance {
    // ─── Initialisation ───────────────────────────────────────────────────────

    pub fn init(
        env: Env,
        admin: Address,
        governance_token: Address,
        payroll_stream: Address,
    ) -> Result<(), QuipayError> {
        require!(
            !env.storage().instance().has(&DataKey::Admin),
            QuipayError::AlreadyInitialized
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::GovernanceToken, &governance_token);
        env.storage()
            .instance()
            .set(&DataKey::PayrollStream, &payroll_stream);
        env.storage()
            .instance()
            .set(&DataKey::VotingPeriod, &DEFAULT_VOTING_PERIOD);
        env.storage()
            .instance()
            .set(&DataKey::QuorumBps, &DEFAULT_QUORUM_BPS);
        env.storage()
            .instance()
            .set(&DataKey::ApprovalBps, &DEFAULT_APPROVAL_BPS);
        env.storage()
            .instance()
            .set(&DataKey::NextProposalId, &1u64);
        Ok(())
    }

    // ─── Config ───────────────────────────────────────────────────────────────

    pub fn set_voting_period(env: Env, seconds: u64) -> Result<(), QuipayError> {
        Self::require_admin(&env)?;
        require!(seconds > 0, QuipayError::InvalidTimeRange);
        env.storage()
            .instance()
            .set(&DataKey::VotingPeriod, &seconds);
        Ok(())
    }

    pub fn set_quorum_bps(env: Env, bps: u32) -> Result<(), QuipayError> {
        Self::require_admin(&env)?;
        require!(bps <= 10_000, QuipayError::InvalidAmount);
        env.storage().instance().set(&DataKey::QuorumBps, &bps);
        Ok(())
    }

    pub fn set_approval_bps(env: Env, bps: u32) -> Result<(), QuipayError> {
        Self::require_admin(&env)?;
        require!(bps <= 10_000, QuipayError::InvalidAmount);
        env.storage().instance().set(&DataKey::ApprovalBps, &bps);
        Ok(())
    }

    /// Set the governance token total supply used for quorum calculations.
    /// The admin must keep this in sync with the actual token supply.
    pub fn set_total_supply(env: Env, supply: i128) -> Result<(), QuipayError> {
        Self::require_admin(&env)?;
        require!(supply > 0, QuipayError::InvalidAmount);
        env.storage().instance().set(&DataKey::TotalSupply, &supply);
        Ok(())
    }

    pub fn get_total_supply(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
    }

    pub fn set_payroll_stream(env: Env, payroll_stream: Address) -> Result<(), QuipayError> {
        Self::require_admin(&env)?;
        env.storage()
            .instance()
            .set(&DataKey::PayrollStream, &payroll_stream);
        Ok(())
    }

    pub fn get_admin(env: Env) -> Result<Address, QuipayError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)
    }

    pub fn get_config(env: Env) -> (u64, u32, u32) {
        let voting_period: u64 = env
            .storage()
            .instance()
            .get(&DataKey::VotingPeriod)
            .unwrap_or(DEFAULT_VOTING_PERIOD);
        let quorum_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::QuorumBps)
            .unwrap_or(DEFAULT_QUORUM_BPS);
        let approval_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ApprovalBps)
            .unwrap_or(DEFAULT_APPROVAL_BPS);
        (voting_period, quorum_bps, approval_bps)
    }

    // ─── Proposal lifecycle ───────────────────────────────────────────────────

    /// Create a governance proposal to create a payroll stream.
    /// The proposer must hold governance tokens (balance > 0).
    pub fn create_proposal(
        env: Env,
        proposer: Address,
        title: soroban_sdk::String,
        description: soroban_sdk::String,
        stream_params: StreamProposalParams,
    ) -> Result<u64, QuipayError> {
        proposer.require_auth();

        // Verify proposer holds governance tokens
        let gov_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::GovernanceToken)
            .ok_or(QuipayError::NotInitialized)?;
        let balance = token::Client::new(&env, &gov_token).balance(&proposer);
        require!(balance > 0, QuipayError::InsufficientPermissions);

        // Validate stream params
        require!(
            stream_params.end_ts > stream_params.start_ts,
            QuipayError::InvalidTimeRange
        );
        require!(stream_params.rate > 0, QuipayError::InvalidAmount);

        let voting_period: u64 = env
            .storage()
            .instance()
            .get(&DataKey::VotingPeriod)
            .unwrap_or(DEFAULT_VOTING_PERIOD);

        let now = env.ledger().timestamp();
        let proposal_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextProposalId)
            .unwrap_or(1);

        // Snapshot quorum threshold at proposal creation time.
        let total_supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        let quorum_bps_now: u32 = env
            .storage()
            .instance()
            .get(&DataKey::QuorumBps)
            .unwrap_or(DEFAULT_QUORUM_BPS);
        let quorum_threshold = total_supply
            .saturating_mul(quorum_bps_now as i128)
            .checked_div(BPS_DENOMINATOR)
            .unwrap_or(0);

        let proposal = Proposal {
            id: proposal_id,
            proposer: proposer.clone(),
            title: title.clone(),
            description,
            stream_params,
            created_at: now,
            voting_ends_at: now + voting_period,
            votes_for: 0,
            votes_against: 0,
            status: ProposalStatus::Active,
            executed_at: 0,
            executed_by: None,
            quorum_threshold,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Proposal(proposal_id), STORAGE_TTL_THRESHOLD, STORAGE_TTL_EXTEND);

        env.storage()
            .instance()
            .set(&DataKey::NextProposalId, &(proposal_id + 1));

        env.events().publish(
            (PROPOSAL_CREATED, proposer, proposal_id),
            title,
        );

        Ok(proposal_id)
    }

    /// Cast a vote on an active proposal.
    /// Vote weight equals the voter's governance token balance at call time.
    pub fn vote(
        env: Env,
        voter: Address,
        proposal_id: u64,
        support: bool,
    ) -> Result<(), QuipayError> {
        voter.require_auth();

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(QuipayError::StreamNotFound)?;

        require!(
            proposal.status == ProposalStatus::Active,
            QuipayError::StreamClosed
        );

        let now = env.ledger().timestamp();
        require!(now <= proposal.voting_ends_at, QuipayError::StreamExpired);

        // Prevent double voting
        let vote_key = DataKey::VoteCast(proposal_id, voter.clone());
        require!(
            !env.storage().persistent().has(&vote_key),
            QuipayError::AlreadySigner
        );

        // Weight = token balance
        let gov_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::GovernanceToken)
            .ok_or(QuipayError::NotInitialized)?;
        let weight = token::Client::new(&env, &gov_token).balance(&voter);
        require!(weight > 0, QuipayError::InsufficientPermissions);

        if support {
            proposal.votes_for = proposal
                .votes_for
                .checked_add(weight)
                .ok_or(QuipayError::Overflow)?;
        } else {
            proposal.votes_against = proposal
                .votes_against
                .checked_add(weight)
                .ok_or(QuipayError::Overflow)?;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Proposal(proposal_id), STORAGE_TTL_THRESHOLD, STORAGE_TTL_EXTEND);

        // Record vote to prevent double-voting
        env.storage().persistent().set(&vote_key, &support);
        env.storage()
            .persistent()
            .extend_ttl(&vote_key, STORAGE_TTL_THRESHOLD, STORAGE_TTL_EXTEND);

        env.events()
            .publish((VOTE_CAST, voter, proposal_id), (support, weight));

        Ok(())
    }

    /// Finalize a proposal after the voting window closes.
    /// Updates status to Passed or Rejected based on quorum and approval threshold.
    /// Anyone can call this once the voting period has ended.
    pub fn finalize_proposal(env: Env, proposal_id: u64) -> Result<ProposalStatus, QuipayError> {
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(QuipayError::StreamNotFound)?;

        require!(
            proposal.status == ProposalStatus::Active,
            QuipayError::StreamClosed
        );

        let now = env.ledger().timestamp();
        require!(now > proposal.voting_ends_at, QuipayError::GracePeriodActive);

        let status = Self::compute_status(&env, &proposal);
        proposal.status = status;

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Proposal(proposal_id), STORAGE_TTL_THRESHOLD, STORAGE_TTL_EXTEND);

        env.events()
            .publish((PROPOSAL_FINALIZED, proposal_id), status as u32);

        Ok(status)
    }

    /// Execute a passed proposal — cross-invokes PayrollStream.create_stream.
    /// The executor must hold governance tokens.
    pub fn execute_proposal(
        env: Env,
        executor: Address,
        proposal_id: u64,
    ) -> Result<u64, QuipayError> {
        executor.require_auth();

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(QuipayError::StreamNotFound)?;

        // Auto-finalize if still Active and voting window closed
        if proposal.status == ProposalStatus::Active {
            let now = env.ledger().timestamp();
            if now > proposal.voting_ends_at {
                proposal.status = Self::compute_status(&env, &proposal);
            }
        }

        require!(
            proposal.status == ProposalStatus::Passed,
            QuipayError::InsufficientPermissions
        );

        let payroll_stream: Address = env
            .storage()
            .instance()
            .get(&DataKey::PayrollStream)
            .ok_or(QuipayError::NotInitialized)?;

        let p = &proposal.stream_params;

        // Cross-contract call to PayrollStream.create_stream_via_governance
        let stream_id: u64 = env.invoke_contract(
            &payroll_stream,
            &Symbol::new(&env, "create_stream_via_governance"),
            soroban_sdk::vec![
                &env,
                p.employer.clone().into_val(&env),
                p.worker.clone().into_val(&env),
                p.token.clone().into_val(&env),
                p.rate.into_val(&env),
                p.cliff_ts.into_val(&env),
                p.start_ts.into_val(&env),
                p.end_ts.into_val(&env),
                p.metadata_hash.clone().into_val(&env),
            ],
        );

        proposal.status = ProposalStatus::Executed;
        proposal.executed_at = env.ledger().timestamp();
        proposal.executed_by = Some(executor.clone());

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Proposal(proposal_id), STORAGE_TTL_THRESHOLD, STORAGE_TTL_EXTEND);

        env.events().publish(
            (PROPOSAL_EXECUTED, executor, proposal_id),
            stream_id,
        );

        Ok(stream_id)
    }

    // ─── Queries ──────────────────────────────────────────────────────────────

    pub fn get_proposal(env: Env, proposal_id: u64) -> Option<Proposal> {
        env.storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
    }

    pub fn get_vote(env: Env, proposal_id: u64, voter: Address) -> Option<bool> {
        env.storage()
            .persistent()
            .get(&DataKey::VoteCast(proposal_id, voter))
    }

    pub fn get_next_proposal_id(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::NextProposalId)
            .unwrap_or(1)
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    fn require_admin(env: &Env) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        Ok(())
    }

    fn compute_status(env: &Env, proposal: &Proposal) -> ProposalStatus {
        let quorum_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::QuorumBps)
            .unwrap_or(DEFAULT_QUORUM_BPS);
        let approval_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ApprovalBps)
            .unwrap_or(DEFAULT_APPROVAL_BPS);

        let total_votes = proposal
            .votes_for
            .saturating_add(proposal.votes_against);

        // Quorum check: total_votes >= threshold snapshotted at proposal creation
        let quorum_met = total_votes >= proposal.quorum_threshold;

        if !quorum_met {
            return ProposalStatus::Rejected;
        }

        // Check approval threshold: votes_for / total_votes >= approval_bps / 10000
        let approval_met = if total_votes == 0 {
            false
        } else {
            proposal
                .votes_for
                .saturating_mul(BPS_DENOMINATOR)
                .checked_div(total_votes)
                .unwrap_or(0)
                >= approval_bps as i128
        };

        if approval_met {
            ProposalStatus::Passed
        } else {
            ProposalStatus::Rejected
        }
    }
}

#[cfg(test)]
mod test;
