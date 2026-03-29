#![no_std]
use quipay_common::{QuipayError, require};
use soroban_sdk::{
    Address, BytesN, Env, IntoVal, Symbol, contract, contractimpl, contracttype,
    symbol_short, token,
};

#[cfg(test)]
mod test;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    GovernanceToken,
    PayrollStream,
    VotingPeriod,
    QuorumBps,
    ApprovalBps,
    NextProposalId,
    Proposal(u64),
    VoteCast(u64, Address),
    TotalSupply,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ProposalStatus {
    Active   = 0,
    Passed   = 1,
    Rejected = 2,
    Executed = 3,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct StreamProposalParams {
    pub employer:      Address,
    pub worker:        Address,
    pub token:         Address,
    pub rate:          i128,
    pub cliff_ts:      u64,
    pub start_ts:      u64,
    pub end_ts:        u64,
    pub metadata_hash: Option<BytesN<32>>,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Proposal {
    pub id:               u64,
    pub proposer:         Address,
    pub title:            soroban_sdk::String,
    pub description:      soroban_sdk::String,
    pub stream_params:    StreamProposalParams,
    pub created_at:       u64,
    pub voting_ends_at:   u64,
    pub votes_for:        i128,
    pub votes_against:    i128,
    pub status:           ProposalStatus,
    pub executed_at:      u64,
    pub executed_by:      Option<Address>,
    pub quorum_threshold: i128,
}

const DEFAULT_VOTING_PERIOD: u64 = 3 * 24 * 60 * 60;
const DEFAULT_QUORUM_BPS:    u32 = 1000;
const DEFAULT_APPROVAL_BPS:  u32 = 5001;
const BPS_DENOMINATOR:       i128 = 10_000;
const STORAGE_TTL_THRESHOLD: u32 = 500_000;
const STORAGE_TTL_EXTEND:    u32 = 1_000_000;

const PROPOSAL_CREATED:  Symbol = symbol_short!("prop_new");
const PROPOSAL_VOTED:    Symbol = symbol_short!("prop_vot");
const PROPOSAL_EXECUTED: Symbol = symbol_short!("prop_exe");

#[contract]
pub struct DaoGovernance;

#[contractimpl]
impl DaoGovernance {
    pub fn init(
        env: Env,
        admin: Address,
        gov_token: Address,
        payroll_stream: Address,
    ) -> Result<(), QuipayError> {
        require!(
            !env.storage().instance().has(&DataKey::Admin),
            QuipayError::AlreadyInitialized
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::GovernanceToken, &gov_token);
        env.storage().instance().set(&DataKey::PayrollStream, &payroll_stream);
        env.storage().instance().set(&DataKey::VotingPeriod, &DEFAULT_VOTING_PERIOD);
        env.storage().instance().set(&DataKey::QuorumBps, &DEFAULT_QUORUM_BPS);
        env.storage().instance().set(&DataKey::ApprovalBps, &DEFAULT_APPROVAL_BPS);
        env.storage().instance().set(&DataKey::NextProposalId, &1u64);
        Ok(())
    }

    pub fn set_voting_period(env: Env, seconds: u64) -> Result<(), QuipayError> {
        Self::require_admin(&env)?;
        env.storage().instance().set(&DataKey::VotingPeriod, &seconds);
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

    pub fn set_total_supply(env: Env, supply: i128) -> Result<(), QuipayError> {
        Self::require_admin(&env)?;
        require!(supply > 0, QuipayError::InvalidAmount);
        env.storage().instance().set(&DataKey::TotalSupply, &supply);
        Ok(())
    }

    pub fn get_total_supply(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
    }

    pub fn create_proposal(
        env: Env,
        proposer: Address,
        title: soroban_sdk::String,
        description: soroban_sdk::String,
        stream_params: StreamProposalParams,
    ) -> Result<u64, QuipayError> {
        proposer.require_auth();

        let gov_token: Address = env
            .storage().instance().get(&DataKey::GovernanceToken)
            .ok_or(QuipayError::NotInitialized)?;

        let balance = token::Client::new(&env, &gov_token).balance(&proposer);
        require!(balance > 0, QuipayError::InsufficientPermissions);
        require!(stream_params.end_ts > stream_params.start_ts, QuipayError::InvalidTimeRange);
        require!(stream_params.rate > 0, QuipayError::InvalidAmount);

        let voting_period: u64 = env.storage().instance()
            .get(&DataKey::VotingPeriod).unwrap_or(DEFAULT_VOTING_PERIOD);
        let now = env.ledger().timestamp();
        let proposal_id: u64 = env.storage().instance()
            .get(&DataKey::NextProposalId).unwrap_or(1);

        let total_supply: i128 = env.storage().instance()
            .get(&DataKey::TotalSupply).unwrap_or(0);
        let quorum_bps: u32 = env.storage().instance()
            .get(&DataKey::QuorumBps).unwrap_or(DEFAULT_QUORUM_BPS);
        let quorum_threshold = total_supply
            .saturating_mul(quorum_bps as i128)
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

        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage().persistent().extend_ttl(
            &DataKey::Proposal(proposal_id), STORAGE_TTL_THRESHOLD, STORAGE_TTL_EXTEND,
        );
        env.storage().instance().set(&DataKey::NextProposalId, &(proposal_id + 1));
        env.events().publish((PROPOSAL_CREATED, proposer, proposal_id), title);
        Ok(proposal_id)
    }

    pub fn vote(
        env: Env,
        voter: Address,
        proposal_id: u64,
        support: bool,
    ) -> Result<(), QuipayError> {
        voter.require_auth();

        let vote_key = DataKey::VoteCast(proposal_id, voter.clone());
        require!(!env.storage().persistent().has(&vote_key), QuipayError::Custom);

        let mut proposal: Proposal = env
            .storage().persistent().get(&DataKey::Proposal(proposal_id))
            .ok_or(QuipayError::StreamNotFound)?;

        require!(proposal.status == ProposalStatus::Active, QuipayError::StreamClosed);

        let now = env.ledger().timestamp();
        require!(now <= proposal.voting_ends_at, QuipayError::StreamExpired);

        let gov_token: Address = env
            .storage().instance().get(&DataKey::GovernanceToken)
            .ok_or(QuipayError::NotInitialized)?;

        let weight = token::Client::new(&env, &gov_token).balance(&voter);
        require!(weight > 0, QuipayError::InsufficientPermissions);

        if support {
            proposal.votes_for = proposal.votes_for.saturating_add(weight);
        } else {
            proposal.votes_against = proposal.votes_against.saturating_add(weight);
        }

        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage().persistent().set(&vote_key, &support);
        env.storage().persistent().extend_ttl(&vote_key, STORAGE_TTL_THRESHOLD, STORAGE_TTL_EXTEND);
        env.events().publish((PROPOSAL_VOTED, voter, proposal_id), (support, weight));
        Ok(())
    }

    pub fn finalize_proposal(env: Env, proposal_id: u64) -> Result<ProposalStatus, QuipayError> {
        let mut proposal: Proposal = env
            .storage().persistent().get(&DataKey::Proposal(proposal_id))
            .ok_or(QuipayError::StreamNotFound)?;

        require!(proposal.status == ProposalStatus::Active, QuipayError::StreamClosed);

        let now = env.ledger().timestamp();
        require!(now > proposal.voting_ends_at, QuipayError::GracePeriodActive);

        let status = Self::compute_status(&env, &proposal);
        proposal.status = status;
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
        Ok(status)
    }

    /// Execute a passed proposal — creates the payroll stream on-chain.
    pub fn execute_proposal(
        env: Env,
        executor: Address,
        proposal_id: u64,
    ) -> Result<u64, QuipayError> {
        executor.require_auth();

        let mut proposal: Proposal = env
            .storage().persistent().get(&DataKey::Proposal(proposal_id))
            .ok_or(QuipayError::StreamNotFound)?;

        if proposal.status == ProposalStatus::Active {
            let now = env.ledger().timestamp();
            if now > proposal.voting_ends_at {
                proposal.status = Self::compute_status(&env, &proposal);
            }
        }

        require!(proposal.status == ProposalStatus::Passed, QuipayError::InsufficientPermissions);

        let payroll_stream: Address = env
            .storage().instance().get(&DataKey::PayrollStream)
            .ok_or(QuipayError::NotInitialized)?;

        let p = &proposal.stream_params;

        let stream_id: u64 = env.invoke_contract(
            &payroll_stream,
            &Symbol::new(&env, "create_stream"),
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
                soroban_sdk::Val::VOID.into_val(&env),
            ],
        );

        let now = env.ledger().timestamp();
        proposal.status = ProposalStatus::Executed;
        proposal.executed_at = now;
        proposal.executed_by = Some(executor.clone());
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
        env.events().publish((PROPOSAL_EXECUTED, executor, proposal_id), stream_id);
        Ok(stream_id)
    }

    pub fn get_proposal(env: Env, proposal_id: u64) -> Option<Proposal> {
        env.storage().persistent().get(&DataKey::Proposal(proposal_id))
    }

    pub fn get_vote(env: Env, proposal_id: u64, voter: Address) -> Option<bool> {
        env.storage().persistent().get(&DataKey::VoteCast(proposal_id, voter))
    }

    pub fn get_admin(env: Env) -> Result<Address, QuipayError> {
        env.storage().instance().get(&DataKey::Admin).ok_or(QuipayError::NotInitialized)
    }

    pub fn get_config(env: Env) -> (u64, u32, u32) {
        let period: u64 = env.storage().instance().get(&DataKey::VotingPeriod).unwrap_or(DEFAULT_VOTING_PERIOD);
        let quorum: u32 = env.storage().instance().get(&DataKey::QuorumBps).unwrap_or(DEFAULT_QUORUM_BPS);
        let approval: u32 = env.storage().instance().get(&DataKey::ApprovalBps).unwrap_or(DEFAULT_APPROVAL_BPS);
        (period, quorum, approval)
    }

    fn require_admin(env: &Env) -> Result<(), QuipayError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        Ok(())
    }

    fn compute_status(env: &Env, proposal: &Proposal) -> ProposalStatus {
        let approval_bps: u32 = env.storage().instance()
            .get(&DataKey::ApprovalBps).unwrap_or(DEFAULT_APPROVAL_BPS);

        let total_votes = proposal.votes_for.saturating_add(proposal.votes_against);
        let quorum_met = total_votes >= proposal.quorum_threshold;

        if !quorum_met {
            return ProposalStatus::Rejected;
        }

        let approval_met = if total_votes == 0 {
            false
        } else {
            proposal.votes_for
                .saturating_mul(BPS_DENOMINATOR)
                .checked_div(total_votes)
                .unwrap_or(0)
                >= approval_bps as i128
        };

        if approval_met { ProposalStatus::Passed } else { ProposalStatus::Rejected }
    }
}
