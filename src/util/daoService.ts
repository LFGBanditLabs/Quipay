import { Address } from "@stellar/stellar-sdk";

// Mock implementation for DAO service
// In a real implementation, this would interact with the DAO governance contract

export interface DaoProposal {
  id: string;
  proposal_type: string;
  title: string;
  description: string;
  proposer: string;
  created_at: number;
  voting_deadline: number;
  execution_delay: number;
  status: string;
  votes_for: number;
  votes_against: number;
  required_votes: number;
  has_voted: string[];
  payload: any;
}

export interface DaoConfig {
  voting_period: number;
  execution_delay: number;
  required_votes: number;
  dao_governance: string;
  is_dao_mode_enabled: boolean;
}

// Mock data store
let mockProposals: DaoProposal[] = [];
let mockConfig: DaoConfig = {
  voting_period: 7 * 24 * 60 * 60, // 7 days
  execution_delay: 24 * 60 * 60, // 24 hours
  required_votes: 3,
  dao_governance: "GD...DAO_GOVERNANCE",
  is_dao_mode_enabled: false,
};

// Mock functions
export const createProposal = async (
  proposer: string,
  proposalType: string,
  title: string,
  description: string,
  payload: any,
  signTransaction: (tx: any) => Promise<any>
): Promise<string> => {
  // Simulate transaction signing
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const proposal: DaoProposal = {
    id: (mockProposals.length + 1).toString(),
    proposal_type: proposalType,
    title,
    description,
    proposer,
    created_at: Math.floor(Date.now() / 1000),
    voting_deadline: Math.floor(Date.now() / 1000) + mockConfig.voting_period,
    execution_delay: mockConfig.execution_delay,
    status: "Active",
    votes_for: 0,
    votes_against: 0,
    required_votes: mockConfig.required_votes,
    has_voted: [],
    payload,
  };
  
  mockProposals.push(proposal);
  return proposal.id;
};

export const voteOnProposal = async (
  proposalId: string,
  voter: string,
  voteFor: boolean,
  signTransaction: (tx: any) => Promise<any>
): Promise<void> => {
  // Simulate transaction signing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const proposal = mockProposals.find(p => p.id === proposalId);
  if (!proposal) {
    throw new Error("Proposal not found");
  }
  
  if (proposal.has_voted.includes(voter)) {
    throw new Error("Already voted");
  }
  
  if (proposal.status !== "Active") {
    throw new Error("Proposal is not active");
  }
  
  if (Date.now() / 1000 > proposal.voting_deadline) {
    throw new Error("Voting has expired");
  }
  
  proposal.has_voted.push(voter);
  if (voteFor) {
    proposal.votes_for += 1;
  } else {
    proposal.votes_against += 1;
  }
  
  // Check if proposal is approved
  if (proposal.votes_for >= proposal.required_votes) {
    proposal.status = "Approved";
  }
};

export const executeProposal = async (
  proposalId: string,
  executor: string,
  signTransaction: (tx: any) => Promise<any>
): Promise<void> => {
  // Simulate transaction signing
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const proposal = mockProposals.find(p => p.id === proposalId);
  if (!proposal) {
    throw new Error("Proposal not found");
  }
  
  if (proposal.status !== "Approved") {
    throw new Error("Proposal is not approved");
  }
  
  const executionReadyTime = proposal.created_at + proposal.execution_delay;
  if (Date.now() / 1000 < executionReadyTime) {
    throw new Error("Too early to execute");
  }
  
  proposal.status = "Executed";
};

export const getProposals = async (): Promise<DaoProposal[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  return [...mockProposals];
};

export const getActiveProposals = async (): Promise<DaoProposal[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockProposals.filter(p => p.status === "Active");
};

export const getProposal = async (proposalId: string): Promise<DaoProposal | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockProposals.find(p => p.id === proposalId) || null;
};

export const getDaoConfig = async (): Promise<DaoConfig> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { ...mockConfig };
};

export const enableDaoMode = async (
  daoGovernance: string,
  signTransaction: (tx: any) => Promise<any>
): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  mockConfig.is_dao_mode_enabled = true;
  mockConfig.dao_governance = daoGovernance;
};

export const disableDaoMode = async (
  signTransaction: (tx: any) => Promise<any>
): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  mockConfig.is_dao_mode_enabled = false;
};

// Utility functions
export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleString();
};

export const formatTimeRemaining = (deadline: number): string => {
  const now = Date.now() / 1000;
  const remaining = deadline - now;
  
  if (remaining <= 0) return "Expired";
  
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export const getProposalTypeLabel = (type: string): string => {
  switch (type) {
    case "CreateStream":
      return "Create Stream";
    case "CancelStream":
      return "Cancel Stream";
    case "UpdateStream":
      return "Update Stream";
    case "Transfer":
      return "Transfer";
    case "Upgrade":
      return "Upgrade";
    case "AdminChange":
      return "Admin Change";
    case "ThresholdChange":
      return "Threshold Change";
    default:
      return type;
  }
};

export const getProposalStatusColor = (status: string): string => {
  switch (status) {
    case "Active":
      return "var(--sds-color-feedback-warning)";
    case "Approved":
      return "var(--sds-color-feedback-success)";
    case "Executed":
      return "var(--sds-color-feedback-info)";
    case "Expired":
      return "var(--muted)";
    case "Canceled":
      return "var(--sds-color-feedback-error)";
    default:
      return "var(--muted)";
  }
};

// Mock data initialization
export const initializeMockData = () => {
  if (mockProposals.length === 0) {
    // Add some sample proposals for testing
    mockProposals = [
      {
        id: "1",
        proposal_type: "CreateStream",
        title: "Create stream for John Doe",
        description: "Approve payroll stream for John Doe's monthly salary",
        proposer: "GADMIN...",
        created_at: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
        voting_deadline: Math.floor(Date.now() / 1000) + 6 * 86400, // 6 days from now
        execution_delay: mockConfig.execution_delay,
        status: "Active",
        votes_for: 2,
        votes_against: 0,
        required_votes: mockConfig.required_votes,
        has_voted: ["GVOTER1...", "GVOTER2..."],
        payload: {
          CreateStream: {
            employer: "GCOMPANY...",
            worker: "GJOHN...",
            token: "GTOKEN...",
            rate: 1000000,
            cliff_ts: Math.floor(Date.now() / 1000),
            start_ts: Math.floor(Date.now() / 1000),
            end_ts: Math.floor(Date.now() / 1000) + 30 * 86400,
            metadata_hash: null,
          },
        },
      },
      {
        id: "2",
        proposal_type: "AdminChange",
        title: "Change DAO admin",
        description: "Transfer admin rights to new address",
        proposer: "GADMIN...",
        created_at: Math.floor(Date.now() / 1000) - 2 * 86400, // 2 days ago
        voting_deadline: Math.floor(Date.now() / 1000) + 5 * 86400, // 5 days from now
        execution_delay: mockConfig.execution_delay,
        status: "Approved",
        votes_for: 3,
        votes_against: 1,
        required_votes: mockConfig.required_votes,
        has_voted: ["GVOTER1...", "GVOTER2...", "GVOTER3...", "GVOTER4..."],
        payload: {
          AdminChange: {
            new_admin: "GNEWADMIN...",
          },
        },
      },
    ];
  }
};

// Initialize mock data
initializeMockData();
