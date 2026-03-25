/**
 * DAO Governance Service
 * ─────────────────────
 * Mock service for DAO governance operations.
 * In production, this would interact with the actual smart contracts.
 */

// Proposal types
export enum ProposalType {
  CreateStream = "CreateStream",
  CancelStream = "CancelStream", 
  UpdateStream = "UpdateStream",
  Transfer = "Transfer",
  Upgrade = "Upgrade",
  AdminChange = "AdminChange",
  ThresholdChange = "ThresholdChange",
  Custom = "Custom",
}

// Proposal status
export enum ProposalStatus {
  Pending = "Pending",
  Approved = "Approved", 
  Rejected = "Rejected",
  Executed = "Executed",
  Expired = "Expired",
}

// Proposal interface
export interface DaoProposal {
  id: string;
  title: string;
  description: string;
  type: ProposalType;
  proposer: string;
  createdAt: Date;
  votingStartsAt: Date;
  votingEndsAt: Date;
  executableAt: Date;
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  requiredVotes: number;
  hasVoted: boolean;
  payload?: any;
  executedAt?: Date;
  executedBy?: string;
}

// Mock service for DAO operations
export const mockDaoService = {
  /**
   * Initialize the DAO governance contract
   */
  async initialize(
    admin: string,
    multisigSigners: string[],
    payrollStreamContract: string,
  ): Promise<void> {
    // Simulate contract initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("DAO initialized with admin:", admin);
  },

  /**
   * Create a new proposal
   */
  async createProposal(
    proposer: string,
    proposalType: ProposalType,
    title: string,
    description: string,
    payload: any,
  ): Promise<string> {
    // Simulate proposal creation
    await new Promise(resolve => setTimeout(resolve, 1500));
    const proposalId = `dao-prop-${Date.now()}`;
    console.log("Created proposal:", proposalId, title, proposalType);
    return proposalId;
  },

  /**
   * Vote on a proposal
   */
  async vote(
    voter: string,
    proposalId: string,
    inFavor: boolean,
    reason?: string,
  ): Promise<void> {
    // Simulate voting
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("Vote submitted:", voter, proposalId, inFavor ? "FOR" : "AGAINST");
  },

  /**
   * Execute a proposal
   */
  async executeProposal(
    executor: string,
    proposalId: string,
  ): Promise<void> {
    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log("Proposal executed:", proposalId, "by", executor);
  },

  /**
   * Get proposal details
   */
  async getProposal(proposalId: string): Promise<DaoProposal | null> {
    // Simulate fetching proposal
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return mock proposal data
    return {
      id: proposalId,
      title: "Create Payroll Stream for Team Member",
      description: "Approve a new payroll stream for a team member with monthly salary payments",
      type: ProposalType.CreateStream,
      proposer: "GCFX...ABC1",
      createdAt: new Date(Date.now() - 86400000),
      votingStartsAt: new Date(Date.now() - 43200000),
      votingEndsAt: new Date(Date.now() + 172800000),
      executableAt: new Date(Date.now() + 259200000),
      status: ProposalStatus.Pending,
      votesFor: 1,
      votesAgainst: 0,
      requiredVotes: 2,
      hasVoted: false,
      payload: {
        CreateStream: {
          employer: "GCFX...ABC1",
          worker: "GDYQ...DEF2",
          token: "native",
          rate: 1000000, // 0.1 XLM per second
          cliff_ts: 0,
          start_ts: Math.floor(Date.now() / 1000) + 86400,
          end_ts: Math.floor(Date.now() / 1000) + (30 * 86400), // 30 days
        },
      },
    };
  },

  /**
   * Get all proposals
   */
  async getAllProposals(): Promise<DaoProposal[]> {
    // Simulate fetching all proposals
    await new Promise(resolve => setTimeout(resolve, 600));
    
    return [
      {
        id: "dao-prop-001",
        title: "Create Payroll Stream for Developer",
        description: "Approve a new payroll stream for a senior developer",
        type: ProposalType.CreateStream,
        proposer: "GCFX...ABC1",
        createdAt: new Date(Date.now() - 86400000),
        votingStartsAt: new Date(Date.now() - 43200000),
        votingEndsAt: new Date(Date.now() + 172800000),
        executableAt: new Date(Date.now() + 259200000),
        status: ProposalStatus.Pending,
        votesFor: 1,
        votesAgainst: 0,
        requiredVotes: 2,
        hasVoted: false,
        payload: {
          CreateStream: {
            employer: "GCFX...ABC1",
            worker: "GDYQ...DEF2",
            token: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            rate: 500000, // 0.05 USDC per second
            cliff_ts: 0,
            start_ts: Math.floor(Date.now() / 1000) + 86400,
            end_ts: Math.floor(Date.now() / 1000) + (90 * 86400), // 90 days
          },
        },
      },
      {
        id: "dao-prop-002",
        title: "Upgrade PayrollStream Contract",
        description: "Upgrade the PayrollStream contract to version 2.1 with security improvements",
        type: ProposalType.Upgrade,
        proposer: "GAHU...GHI3",
        createdAt: new Date(Date.now() - 172800000),
        votingStartsAt: new Date(Date.now() - 86400000),
        votingEndsAt: new Date(Date.now() + 86400000),
        executableAt: new Date(Date.now() + 172800000),
        status: ProposalStatus.Approved,
        votesFor: 2,
        votesAgainst: 0,
        requiredVotes: 2,
        hasVoted: true,
        payload: {
          Upgrade: {
            new_wasm_hash: "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
          },
        },
      },
      {
        id: "dao-prop-003",
        title: "Transfer 1000 USDC to Marketing Budget",
        description: "Transfer funds from treasury to marketing wallet for upcoming campaign",
        type: ProposalType.Transfer,
        proposer: "GDYQ...DEF2",
        createdAt: new Date(Date.now() - 259200000),
        votingStartsAt: new Date(Date.now() - 172800000),
        votingEndsAt: new Date(Date.now()),
        executableAt: new Date(Date.now() + 86400000),
        status: ProposalStatus.Executed,
        votesFor: 3,
        votesAgainst: 0,
        requiredVotes: 2,
        hasVoted: true,
        executedAt: new Date(Date.now() - 43200000),
        executedBy: "GCFX...ABC1",
        payload: {
          Transfer: {
            token: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            amount: 1000000000, // 1000 USDC (7 decimals)
            recipient: "GBXQ...XYZ9",
          },
        },
      },
    ];
  },

  /**
   * Get pending proposals
   */
  async getPendingProposals(): Promise<DaoProposal[]> {
    const allProposals = await this.getAllProposals();
    return allProposals.filter(proposal => 
      proposal.status === ProposalStatus.Pending || 
      proposal.status === ProposalStatus.Approved
    );
  },

  /**
   * Check if a stream requires governance approval
   */
  async streamRequiresGovernance(streamId: string): Promise<boolean> {
    // Simulate checking governance requirement
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // In a real implementation, this would check if there's a pending proposal for this stream
    // For demo purposes, we'll return true for streams 1-5 and false for others
    const id = parseInt(streamId);
    return id >= 1 && id <= 5;
  },

  /**
   * Get DAO configuration
   */
  async getDaoConfig(): Promise<{
    threshold: number;
    totalSigners: number;
    signers: string[];
    votingPeriod: number;
    executionDelay: number;
    isCurrentUserSigner: boolean;
  }> {
    // Simulate fetching DAO config
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      threshold: 2,
      totalSigners: 3,
      signers: ["GCFX...ABC1", "GDYQ...DEF2", "GAHU...GHI3"],
      votingPeriod: 7 * 24 * 60 * 60, // 7 days
      executionDelay: 24 * 60 * 60, // 24 hours
      isCurrentUserSigner: true,
    };
  },
};

/**
 * Helper functions for proposal formatting
 */
export const formatProposalType = (type: ProposalType): string => {
  return type.replace(/([A-Z])/g, ' $1').trim();
};

export const getProposalTypeColor = (type: ProposalType): string => {
  switch (type) {
    case ProposalType.CreateStream:
      return "var(--sds-color-feedback-success)";
    case ProposalType.CancelStream:
      return "var(--sds-color-feedback-error)";
    case ProposalType.UpdateStream:
      return "var(--sds-color-feedback-warning)";
    case ProposalType.Transfer:
      return "var(--accent)";
    case ProposalType.Upgrade:
      return "var(--sds-color-feedback-warning)";
    case ProposalType.AdminChange:
      return "var(--accent)";
    case ProposalType.ThresholdChange:
      return "#8b5cf6";
    default:
      return "var(--muted)";
  }
};

export const getStatusColor = (status: ProposalStatus): string => {
  switch (status) {
    case ProposalStatus.Pending:
      return "var(--sds-color-feedback-warning)";
    case ProposalStatus.Approved:
      return "var(--sds-color-feedback-success)";
    case ProposalStatus.Rejected:
      return "var(--sds-color-feedback-error)";
    case ProposalStatus.Executed:
      return "var(--accent)";
    case ProposalStatus.Expired:
      return "var(--muted)";
    default:
      return "var(--muted)";
  }
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const shortenAddress = (address: string): string => {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
