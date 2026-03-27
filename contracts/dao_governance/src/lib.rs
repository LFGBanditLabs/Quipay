#![no_std]
use core::convert::TryFrom;
use quipay_common::{QuipayError, require};
use soroban_sdk::{
    Address, BytesN, Env, IntoVal, Symbol, Vec, String, contract, contractimpl, contracttype,
};

#[cfg(test)]
use soroban_sdk::testutils::arbitrary::SorobanArbitrary;

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ProposalType {
    CreateStream,
    CancelStream,
    UpdateStream,
    Transfer,
    Upgrade,
    AdminChange,
    ThresholdChange,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ProposalStatus {
    Active,
    Approved,
    Executed,
    Expired,
    Canceled,
}

#[derive(Clone, Debug)]
pub struct Proposal {
    pub id: u64,
    pub proposal_type: ProposalType,
    pub title: String,
    pub description: String,
    pub proposer: Address,
    pub created_at: u64,
    pub voting_deadline: u64,
    pub execution_delay: u64,
    pub status: ProposalStatus,
    pub votes_for: u32,
    pub votes_against: u32,
    pub required_votes: u32,
    pub has_voted: Vec<Address>,
    pub payload: ProposalPayload,
}

#[derive(Clone, Debug)]
pub enum ProposalPayload {
    CreateStream {
        employer: Address,
        worker: Address,
        token: Address,
        rate: i128,
        cliff_ts: u64,
        start_ts: u64,
        end_ts: u64,
        metadata_hash: Option<BytesN<32>>,
    },
    CancelStream {
        stream_id: u64,
    },
    UpdateStream {
        stream_id: u64,
        new_rate: Option<i128>,
        new_end_ts: Option<u64>,
    },
    Transfer {
        token: Address,
        to: Address,
        amount: i128,
    },
    Upgrade {
        new_wasm_hash: BytesN<32>,
    },
    AdminChange {
        new_admin: Address,
    },
    ThresholdChange {
        new_threshold: u32,
    },
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    PayrollStream,
    VotingPeriod,
    ExecutionDelay,
    RequiredVotes,
    NextProposalId,
    Proposal(u64),
    ActiveProposals,
}

const DEFAULT_VOTING_PERIOD: u64 = 7 * 24 * 60 * 60; // 7 days
const DEFAULT_EXECUTION_DELAY: u64 = 24 * 60 * 60; // 24 hours
const DEFAULT_REQUIRED_VOTES: u32 = 3; // Default to 3 votes

#[contract]
pub struct DaoGovernance;

#[contractimpl]
impl DaoGovernance {
    pub fn init(env: Env, admin: Address, payroll_stream: Address) -> Result<(), QuipayError> {
        require!(
            !env.storage().instance().has(&DataKey::Admin),
            QuipayError::AlreadyInitialized
        );
        
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::PayrollStream, &payroll_stream);
        env.storage().instance().set(&DataKey::VotingPeriod, &DEFAULT_VOTING_PERIOD);
        env.storage().instance().set(&DataKey::ExecutionDelay, &DEFAULT_EXECUTION_DELAY);
        env.storage().instance().set(&DataKey::RequiredVotes, &DEFAULT_REQUIRED_VOTES);
        env.storage().instance().set(&DataKey::NextProposalId, &1u64);
        env.storage().instance().set(&DataKey::ActiveProposals, &Vec::<u64>::new(&env));
        
        Ok(())
    }

    pub fn create_proposal(
        env: Env,
        proposer: Address,
        proposal_type: ProposalType,
        title: String,
        description: String,
        payload: ProposalPayload,
    ) -> Result<u64, QuipayError> {
        proposer.require_auth();
        
        let proposal_id = env
            .storage()
            .instance()
            .get(&DataKey::NextProposalId)
            .unwrap_or(1u64);
        
        let now = env.ledger().timestamp();
        let voting_period = env
            .storage()
            .instance()
            .get(&DataKey::VotingPeriod)
            .unwrap_or(DEFAULT_VOTING_PERIOD);
        
        let execution_delay = env
            .storage()
            .instance()
            .get(&DataKey::ExecutionDelay)
            .unwrap_or(DEFAULT_EXECUTION_DELAY);
        
        let required_votes = env
            .storage()
            .instance()
            .get(&DataKey::RequiredVotes)
            .unwrap_or(DEFAULT_REQUIRED_VOTES);
        
        let proposal = Proposal {
            id: proposal_id,
            proposal_type,
            title,
            description,
            proposer: proposer.clone(),
            created_at: now,
            voting_deadline: now + voting_period,
            execution_delay,
            status: ProposalStatus::Active,
            votes_for: 0,
            votes_against: 0,
            required_votes,
            has_voted: Vec::new(&env),
            payload,
        };
        
        env.storage().instance().set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage().instance().set(&DataKey::NextProposalId, &(proposal_id + 1));
        
        // Add to active proposals
        let mut active_proposals: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::ActiveProposals)
            .unwrap_or_else(|| Vec::new(&env));
        active_proposals.push_back(proposal_id);
        env.storage().instance().set(&DataKey::ActiveProposals, &active_proposals);
        
        env.events().publish(
            (Symbol::new(&env, "proposal"), Symbol::new(&env, "created")),
            (proposal_id, proposer),
        );
        
        Ok(proposal_id)
    }

    pub fn vote(
        env: Env,
        voter: Address,
        proposal_id: u64,
        vote: bool, // true = for, false = against
    ) -> Result<(), QuipayError> {
        voter.require_auth();
        
        let mut proposal: Proposal = env
            .storage()
            .instance()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(QuipayError::NotFound)?;
        
        require!(proposal.status == ProposalStatus::Active, QuipayError::InvalidState);
        
        let now = env.ledger().timestamp();
        require!(now <= proposal.voting_deadline, QuipayError::Expired);
        
        // Check if already voted
        let mut already_voted = false;
        let mut i = 0;
        while i < proposal.has_voted.len() {
            if let Some(voter_addr) = proposal.has_voted.get(i) {
                if voter_addr == voter {
                    already_voted = true;
                    break;
                }
            }
            i += 1;
        }
        require!(!already_voted, QuipayError::AlreadyVoted);
        
        // Record vote
        proposal.has_voted.push_back(voter.clone());
        if vote {
            proposal.votes_for += 1;
        } else {
            proposal.votes_against += 1;
        }
        
        // Check if proposal is approved
        if proposal.votes_for >= proposal.required_votes {
            proposal.status = ProposalStatus::Approved;
            
            // Remove from active proposals
            let mut active_proposals: Vec<u64> = env
                .storage()
                .instance()
                .get(&DataKey::ActiveProposals)
                .unwrap_or_else(|| Vec::new(&env));
            
            let mut i = 0;
            while i < active_proposals.len() {
                if let Some(id) = active_proposals.get(i) {
                    if id == proposal_id {
                        active_proposals.remove(i);
                        break;
                    }
                }
                i += 1;
            }
            env.storage().instance().set(&DataKey::ActiveProposals, &active_proposals);
        }
        
        env.storage().instance().set(&DataKey::Proposal(proposal_id), &proposal);
        
        env.events().publish(
            (Symbol::new(&env, "proposal"), Symbol::new(&env, "voted")),
            (proposal_id, voter, vote),
        );
        
        Ok(())
    }

    pub fn execute_proposal(
        env: Env,
        executor: Address,
        proposal_id: u64,
    ) -> Result<(), QuipayError> {
        executor.require_auth();
        
        let mut proposal: Proposal = env
            .storage()
            .instance()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(QuipayError::NotFound)?;
        
        require!(proposal.status == ProposalStatus::Approved, QuipayError::InvalidState);
        
        let now = env.ledger().timestamp();
        let execution_ready_time = proposal.created_at + proposal.execution_delay;
        require!(now >= execution_ready_time, QuipayError::TooEarly);
        
        let payroll_stream: Address = env
            .storage()
            .instance()
            .get(&DataKey::PayrollStream)
            .ok_or(QuipayError::NotInitialized)?;
        
        // Execute the proposal based on its type
        match &proposal.payload {
            ProposalPayload::CreateStream {
                employer,
                worker,
                token,
                rate,
                cliff_ts,
                start_ts,
                end_ts,
                metadata_hash,
            } => {
                // Call PayrollStream::create_stream_via_governance
                // TODO: Implement proper contract invocation
                // For now, just log the operation
                // env.logs().add(&soroban_sdk::Symbol::new(&env, "debug"), 
                //     soroban_sdk::Val::from_void());
            }
            ProposalPayload::CancelStream { stream_id } => {
                // TODO: Implement proper contract invocation
                // env.logs().add(&soroban_sdk::Symbol::new(&env, "debug"), 
                //     soroban_sdk::Val::from_void());
            }
            ProposalPayload::UpdateStream {
                stream_id,
                new_rate,
                new_end_ts,
            } => {
                // TODO: Implement proper contract invocation
                // env.logs().add(&soroban_sdk::Symbol::new(&env, "debug"), 
                //     soroban_sdk::Val::from_void());
            }
            ProposalPayload::Transfer { token, to, amount } => {
                // This would require additional logic for treasury management
                // For now, we'll leave this as a placeholder
            }
            ProposalPayload::Upgrade { new_wasm_hash } => {
                // This would require additional logic for contract upgrades
                // For now, we'll leave this as a placeholder
            }
            ProposalPayload::AdminChange { new_admin } => {
                env.storage().instance().set(&DataKey::Admin, new_admin);
            }
            ProposalPayload::ThresholdChange { new_threshold } => {
                env.storage().instance().set(&DataKey::RequiredVotes, new_threshold);
            }
        }
        
        proposal.status = ProposalStatus::Executed;
        env.storage().instance().set(&DataKey::Proposal(proposal_id), &proposal);
        
        env.events().publish(
            (Symbol::new(&env, "proposal"), Symbol::new(&env, "executed")),
            (proposal_id, executor),
        );
        
        Ok(())
    }

    pub fn get_proposal(env: Env, proposal_id: u64) -> Result<Proposal, QuipayError> {
        env.storage()
            .instance()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(QuipayError::NotFound)
    }

    pub fn get_active_proposals(env: Env) -> Result<Vec<u64>, QuipayError> {
        Ok(env
            .storage()
            .instance()
            .get(&DataKey::ActiveProposals)
            .unwrap_or_else(|| Vec::new(&env)))
    }

    pub fn set_voting_period(env: Env, voting_period: u64) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        
        env.storage().instance().set(&DataKey::VotingPeriod, &voting_period);
        Ok(())
    }

    pub fn set_execution_delay(env: Env, execution_delay: u64) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        
        env.storage().instance().set(&DataKey::ExecutionDelay, &execution_delay);
        Ok(())
    }

    pub fn set_required_votes(env: Env, required_votes: u32) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        
        env.storage().instance().set(&DataKey::RequiredVotes, &required_votes);
        Ok(())
    }

    pub fn get_admin(env: Env) -> Result<Address, QuipayError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)
    }

    pub fn get_payroll_stream(env: Env) -> Result<Address, QuipayError> {
        env.storage()
            .instance()
            .get(&DataKey::PayrollStream)
            .ok_or(QuipayError::NotInitialized)
    }
}

// Trait implementations needed for Soroban SDK integration
impl soroban_sdk::TryFromValForContractFn<Env, soroban_sdk::Val> for ProposalPayload {
    type Error = soroban_sdk::Error;
    
    fn try_from_val_for_contract_fn(_env: &Env, _val: &soroban_sdk::Val) -> Result<Self, Self::Error> {
        // This is a simplified implementation - in practice you would want to
        // properly deserialize the payload based on the function name
        Err(soroban_sdk::Error::from_contract_error(QuipayError::InvalidState as u32))
    }
}

#[cfg(test)]
impl soroban_sdk::testutils::arbitrary::arbitrary::SorobanArbitrary for ProposalPayload {
    fn arbitrary(env: &Env) -> Self {
        // Simple implementation for testing - return a default payload
        ProposalPayload::AdminChange {
            new_admin: Address::generate(env),
        }
    }
}
