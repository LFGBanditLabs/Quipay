#![no_std]
use quipay_common::{QuipayError, require};
use soroban_sdk::{Address, Env, IntoVal, Symbol, Vec, contract, contractimpl, contracttype};

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
    Custom,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ProposalStatus {
    Pending,
    Approved,
    Rejected,
    Executed,
    Expired,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    NextProposalId,
    MultisigThreshold,
    MultisigSigners,
    VotingPeriod,
    ExecutionDelay,
    PayrollStreamContract,
    Proposal(u64),
    StreamProposal(u64), // Maps stream_id to proposal_id
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Proposal {
    pub id: u64,
    pub proposer: Address,
    pub proposal_type: ProposalType,
    pub title: String,
    pub description: String,
    pub payload: ProposalPayload,
    pub created_at: u64,
    pub voting_starts_at: u64,
    pub voting_ends_at: u64,
    pub executable_at: u64,
    pub status: ProposalStatus,
    pub votes_for: u32,
    pub votes_against: u32,
    pub required_votes: u32,
    pub has_voted: Vec<Address>,
    pub executed_at: Option<u64>,
    pub executed_by: Option<Address>,
}

#[contracttype]
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
        amount: i128,
        recipient: Address,
    },
    Upgrade {
        new_wasm_hash: soroban_sdk::BytesN<32>,
    },
    AdminChange {
        new_admin: Address,
    },
    ThresholdChange {
        new_threshold: u32,
    },
    Custom {
        data: soroban_sdk::Bytes,
    },
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Vote {
    pub voter: Address,
    pub in_favor: bool,
    pub voted_at: u64,
    pub reason: Option<String>,
}

// Constants
const DEFAULT_VOTING_PERIOD: u64 = 7 * 24 * 60 * 60; // 7 days
const DEFAULT_EXECUTION_DELAY: u64 = 24 * 60 * 60; // 24 hours
const DEFAULT_THRESHOLD: u32 = 2; // 2-of-N multisig by default
const MIN_THRESHOLD: u32 = 1;
const MAX_THRESHOLD: u32 = 10;

// Event symbols
const PROPOSAL_CREATED: soroban_sdk::Symbol = soroban_sdk::symbol_short!("prop_created");
const PROPOSAL_VOTED: soroban_sdk::Symbol = soroban_sdk::symbol_short!("prop_voted");
const PROPOSAL_EXECUTED: soroban_sdk::Symbol = soroban_sdk::symbol_short!("prop_exec");
const PROPOSAL_EXPIRED: soroban_sdk::Symbol = soroban_sdk::symbol_short!("prop_expired");

#[contract]
pub struct DaoGovernance;

#[contractimpl]
impl DaoGovernance {
    /// Initialize the DAO governance contract
    pub fn init(
        env: Env,
        admin: Address,
        multisig_signers: Vec<Address>,
        payroll_stream_contract: Address,
    ) -> Result<(), QuipayError> {
        require!(
            !env.storage().instance().has(&DataKey::Admin),
            QuipayError::AlreadyInitialized
        );

        // Validate signers
        require!(
            multisig_signers.len() >= MIN_THRESHOLD as usize
                && multisig_signers.len() <= MAX_THRESHOLD as usize,
            QuipayError::InvalidSigners
        );

        // Set admin
        env.storage().instance().set(&DataKey::Admin, &admin);

        // Set multisig configuration
        env.storage()
            .instance()
            .set(&DataKey::MultisigThreshold, &DEFAULT_THRESHOLD);
        env.storage()
            .instance()
            .set(&DataKey::MultisigSigners, &multisig_signers);

        // Set default timing parameters
        env.storage()
            .instance()
            .set(&DataKey::VotingPeriod, &DEFAULT_VOTING_PERIOD);
        env.storage()
            .instance()
            .set(&DataKey::ExecutionDelay, &DEFAULT_EXECUTION_DELAY);

        // Set payroll stream contract
        env.storage()
            .instance()
            .set(&DataKey::PayrollStreamContract, &payroll_stream_contract);

        // Initialize proposal ID counter
        env.storage()
            .instance()
            .set(&DataKey::NextProposalId, &1u64);

        // Set paused state
        env.storage().instance().set(&DataKey::Paused, &false);

        Ok(())
    }

    /// Create a new proposal
    pub fn create_proposal(
        env: Env,
        proposer: Address,
        proposal_type: ProposalType,
        title: String,
        description: String,
        payload: ProposalPayload,
    ) -> Result<u64, QuipayError> {
        Self::require_not_paused(&env)?;
        Self::require_authorized_signer(&env, &proposer)?;

        let now = env.ledger().timestamp();
        let voting_period = Self::get_voting_period(&env);
        let execution_delay = Self::get_execution_delay(&env);

        let proposal_id = Self::get_next_proposal_id(&env)?;

        let proposal = Proposal {
            id: proposal_id,
            proposer: proposer.clone(),
            proposal_type: proposal_type.clone(),
            title: title.clone(),
            description,
            payload,
            created_at: now,
            voting_starts_at: now,
            voting_ends_at: now + voting_period,
            executable_at: now + voting_period + execution_delay,
            status: ProposalStatus::Pending,
            votes_for: 0,
            votes_against: 0,
            required_votes: Self::get_multisig_threshold(&env),
            has_voted: Vec::new(&env),
            executed_at: None,
            executed_by: None,
        };

        // Store proposal
        env.storage()
            .instance()
            .set(&DataKey::Proposal(proposal_id), &proposal);

        // If this is a stream proposal, create the mapping
        if matches!(proposal_type, ProposalType::CreateStream | ProposalType::CancelStream | ProposalType::UpdateStream) {
            if let ProposalPayload::CreateStream { .. } = &proposal.payload {
                // We'll store the stream_id after execution
            } else if let ProposalPayload::CancelStream { stream_id } = &proposal.payload {
                env.storage()
                    .instance()
                    .set(&DataKey::StreamProposal(*stream_id), &proposal_id);
            } else if let ProposalPayload::UpdateStream { stream_id, .. } = &proposal.payload {
                env.storage()
                    .instance()
                    .set(&DataKey::StreamProposal(*stream_id), &proposal_id);
            }
        }

        // Emit event
        env.events().publish(
            (PROPOSAL_CREATED, proposer, proposal_id),
            (proposal_type, title),
        );

        Ok(proposal_id)
    }

    /// Vote on a proposal
    pub fn vote(
        env: Env,
        voter: Address,
        proposal_id: u64,
        in_favor: bool,
        reason: Option<String>,
    ) -> Result<(), QuipayError> {
        Self::require_not_paused(&env)?;
        Self::require_authorized_signer(&env, &voter)?;

        let mut proposal = Self::get_proposal(&env, proposal_id)?;

        // Check if voting is still open
        let now = env.ledger().timestamp();
        require!(
            now >= proposal.voting_starts_at && now <= proposal.voting_ends_at,
            QuipayError::VotingClosed
        );

        // Check if already voted
        require!(
            !proposal.has_voted.contains(&voter),
            QuipayError::AlreadyVoted
        );

        // Record vote
        proposal.has_voted.push_back(voter.clone());
        if in_favor {
            proposal.votes_for += 1;
        } else {
            proposal.votes_against += 1;
        }

        // Check if proposal is approved
        if proposal.votes_for >= proposal.required_votes {
            proposal.status = ProposalStatus::Approved;
        } else if proposal.votes_against >= proposal.required_votes {
            proposal.status = ProposalStatus::Rejected;
        }

        // Update proposal
        env.storage()
            .instance()
            .set(&DataKey::Proposal(proposal_id), &proposal);

        // Emit event
        env.events().publish(
            (PROPOSAL_VOTED, voter, proposal_id),
            (in_favor, proposal.votes_for, proposal.votes_against),
        );

        Ok(())
    }

    /// Execute an approved proposal
    pub fn execute_proposal(
        env: Env,
        executor: Address,
        proposal_id: u64,
    ) -> Result<(), QuipayError> {
        Self::require_not_paused(&env)?;
        Self::require_authorized_signer(&env, &executor)?;

        let mut proposal = Self::get_proposal(&env, proposal_id)?;

        // Check if proposal is approved and executable
        let now = env.ledger().timestamp();
        require!(
            proposal.status == ProposalStatus::Approved,
            QuipayError::ProposalNotApproved
        );
        require!(
            now >= proposal.executable_at,
            QuipayError::ExecutionDelayNotMet
        );
        require!(
            proposal.executed_at.is_none(),
            QuipayError::AlreadyExecuted
        );

        // Execute the proposal based on its type
        Self::execute_proposal_payload(&env, &proposal)?;

        // Mark as executed
        proposal.status = ProposalStatus::Executed;
        proposal.executed_at = Some(now);
        proposal.executed_by = Some(executor.clone());

        env.storage()
            .instance()
            .set(&DataKey::Proposal(proposal_id), &proposal);

        // Emit event
        env.events().publish(
            (PROPOSAL_EXECUTED, executor, proposal_id),
            (proposal.proposal_type, proposal.title),
        );

        Ok(())
    }

    /// Get proposal details
    pub fn get_proposal(env: Env, proposal_id: u64) -> Result<Proposal, QuipayError> {
        env.storage()
            .instance()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(QuipayError::ProposalNotFound)
    }

    /// Get all proposals
    pub fn get_all_proposals(env: Env) -> Result<Vec<Proposal>, QuipayError> {
        let mut proposals = Vec::new(&env);
        let mut proposal_id = 1u64;

        // This is a simple approach - in production, you'd want a more efficient method
        while let Some(proposal) = env.storage().instance().get(&DataKey::Proposal(proposal_id)) {
            proposals.push_back(proposal);
            proposal_id += 1;
        }

        Ok(proposals)
    }

    /// Get pending proposals
    pub fn get_pending_proposals(env: Env) -> Result<Vec<Proposal>, QuipayError> {
        let all_proposals = Self::get_all_proposals(env)?;
        let mut pending = Vec::new(&env);

        for proposal in all_proposals {
            if matches!(proposal.status, ProposalStatus::Pending | ProposalStatus::Approved) {
                pending.push_back(proposal);
            }
        }

        Ok(pending)
    }

    /// Check if a stream requires governance approval
    pub fn stream_requires_governance(env: Env, stream_id: u64) -> Result<bool, QuipayError> {
        // Check if there's a pending or approved proposal for this stream
        if let Some(proposal_id) = env.storage().instance().get(&DataKey::StreamProposal(stream_id)) {
            if let Ok(proposal) = Self::get_proposal(&env, proposal_id) {
                return Ok(matches!(
                    proposal.status,
                    ProposalStatus::Pending | ProposalStatus::Approved
                ));
            }
        }
        Ok(false)
    }

    /// Get the multisig threshold
    pub fn get_multisig_threshold(env: &Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::MultisigThreshold)
            .unwrap_or(DEFAULT_THRESHOLD)
    }

    /// Get the voting period
    pub fn get_voting_period(env: &Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::VotingPeriod)
            .unwrap_or(DEFAULT_VOTING_PERIOD)
    }

    /// Get the execution delay
    pub fn get_execution_delay(env: &Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::ExecutionDelay)
            .unwrap_or(DEFAULT_EXECUTION_DELAY)
    }

    /// Get authorized signers
    pub fn get_authorized_signers(env: &Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::MultisigSigners)
            .unwrap_or_else(|| Vec::new(env))
    }

    /// Set paused state (admin only)
    pub fn set_paused(env: Env, paused: bool) -> Result<(), QuipayError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &paused);
        Ok(())
    }

    /// Update multisig threshold (requires governance)
    pub fn update_threshold(env: Env, new_threshold: u32) -> Result<(), QuipayError> {
        require!(
            new_threshold >= MIN_THRESHOLD && new_threshold <= MAX_THRESHOLD,
            QuipayError::InvalidThreshold
        );
        
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        
        env.storage()
            .instance()
            .set(&DataKey::MultisigThreshold, &new_threshold);
        Ok(())
    }

    /// Update authorized signers (requires governance)
    pub fn update_signers(env: Env, new_signers: Vec<Address>) -> Result<(), QuipayError> {
        require!(
            new_signers.len() >= MIN_THRESHOLD as usize
                && new_signers.len() <= MAX_THRESHOLD as usize,
            QuipayError::InvalidSigners
        );
        
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(QuipayError::NotInitialized)?;
        admin.require_auth();
        
        env.storage()
            .instance()
            .set(&DataKey::MultisigSigners, &new_signers);
        Ok(())
    }

    // Helper functions

    fn get_next_proposal_id(env: &Env) -> Result<u64, QuipayError> {
        let mut next_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextProposalId)
            .unwrap_or(1u64);
        let proposal_id = next_id;
        next_id = next_id.checked_add(1).ok_or(QuipayError::Overflow)?;
        env.storage()
            .instance()
            .set(&DataKey::NextProposalId, &next_id);
        Ok(proposal_id)
    }

    fn require_not_paused(env: &Env) -> Result<(), QuipayError> {
        let paused = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        require!(!paused, QuipayError::Paused);
        Ok(())
    }

    fn require_authorized_signer(env: &Env, signer: &Address) -> Result<(), QuipayError> {
        let authorized_signers = Self::get_authorized_signers(env);
        require!(
            authorized_signers.contains(signer),
            QuipayError::Unauthorized
        );
        Ok(())
    }

    fn execute_proposal_payload(env: &Env, proposal: &Proposal) -> Result<(), QuipayError> {
        let payroll_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::PayrollStreamContract)
            .ok_or(QuipayError::NotInitialized)?;

        match &proposal.payload {
            ProposalPayload::CreateStream {
                employer,
                worker,
                token,
                rate,
                cliff_ts,
                start_ts,
                end_ts,
            } => {
                use soroban_sdk::{IntoVal, Symbol, vec};
                let stream_id: u64 = env.invoke_contract(
                    &payroll_contract,
                    &Symbol::new(env, "create_stream"),
                    vec![
                        env,
                        employer.clone().into_val(env),
                        worker.clone().into_val(env),
                        token.clone().into_val(env),
                        rate.clone().into_val(env),
                        cliff_ts.clone().into_val(env),
                        start_ts.clone().into_val(env),
                        end_ts.clone().into_val(env),
                    ],
                );
                
                // Store stream to proposal mapping
                env.storage()
                    .instance()
                    .set(&DataKey::StreamProposal(stream_id), &proposal.id);
            }
            ProposalPayload::CancelStream { stream_id } => {
                use soroban_sdk::{IntoVal, Symbol, vec};
                env.invoke_contract::<()>(
                    &payroll_contract,
                    &Symbol::new(env, "cancel_stream"),
                    vec![
                        env,
                        stream_id.clone().into_val(env),
                        proposal.proposer.clone().into_val(env),
                    ],
                );
            }
            ProposalPayload::UpdateStream {
                stream_id,
                new_rate,
                new_end_ts,
            } => {
                // This would require adding update_stream function to PayrollStream
                // For now, we'll implement it as a placeholder
                use soroban_sdk::{IntoVal, Symbol, vec};
                env.invoke_contract::<()>(
                    &payroll_contract,
                    &Symbol::new(env, "update_stream"),
                    vec![
                        env,
                        stream_id.clone().into_val(env),
                        new_rate.clone().into_val(env),
                        new_end_ts.clone().into_val(env),
                    ],
                );
            }
            ProposalPayload::Transfer {
                token,
                amount,
                recipient,
            } => {
                // This would require a treasury contract
                // For now, we'll implement it as a placeholder
                use soroban_sdk::{IntoVal, Symbol, vec};
                env.invoke_contract::<()>(
                    &payroll_contract,
                    &Symbol::new(env, "transfer"),
                    vec![
                        env,
                        token.clone().into_val(env),
                        amount.clone().into_val(env),
                        recipient.clone().into_val(env),
                    ],
                );
            }
            ProposalPayload::Upgrade { new_wasm_hash } => {
                use soroban_sdk::{IntoVal, Symbol, vec};
                env.invoke_contract::<()>(
                    &payroll_contract,
                    &Symbol::new(env, "upgrade"),
                    vec![env, new_wasm_hash.clone().into_val(env)],
                );
            }
            ProposalPayload::AdminChange { new_admin } => {
                env.storage()
                    .instance()
                    .set(&DataKey::Admin, new_admin);
            }
            ProposalPayload::ThresholdChange { new_threshold } => {
                env.storage()
                    .instance()
                    .set(&DataKey::MultisigThreshold, new_threshold);
            }
            ProposalPayload::Custom { data } => {
                // Custom proposals would need specific handling
                // For now, we'll just emit an event
                env.events().publish(
                    (Symbol::new(env, "custom_executed"), proposal.id),
                    data,
                );
            }
        }

        Ok(())
    }
}
