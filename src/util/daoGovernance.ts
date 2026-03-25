/**
 * DAO Governance Contract Integration
 * ─────────────────────────────────
 * TypeScript bindings and utilities for interacting with the DAO governance contract.
 */

import { Address, Contract, SorobanRpc, xdr, TransactionBuilder, BASE_FEE } from "soroban-client";

// Contract configuration
export const DAO_GOVERNANCE_CONTRACT_ID = import.meta.env.VITE_DAO_GOVERNANCE_CONTRACT_ID || "";

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

// Proposal payload types
export interface CreateStreamPayload {
  CreateStream: {
    employer: string;
    worker: string;
    token: string;
    rate: number;
    cliff_ts: number;
    start_ts: number;
    end_ts: number;
  };
}

export interface CancelStreamPayload {
  CancelStream: {
    stream_id: number;
  };
}

export interface UpdateStreamPayload {
  UpdateStream: {
    stream_id: number;
    new_rate?: number;
    new_end_ts?: number;
  };
}

export interface TransferPayload {
  Transfer: {
    token: string;
    amount: number;
    recipient: string;
  };
}

export interface UpgradePayload {
  Upgrade: {
    new_wasm_hash: string;
  };
}

export interface AdminChangePayload {
  AdminChange: {
    new_admin: string;
  };
}

export interface ThresholdChangePayload {
  ThresholdChange: {
    new_threshold: number;
  };
}

export type ProposalPayload = 
  | CreateStreamPayload 
  | CancelStreamPayload 
  | UpdateStreamPayload 
  | TransferPayload 
  | UpgradePayload 
  | AdminChangePayload 
  | ThresholdChangePayload;

/**
 * DAO Governance Contract Client
 */
export class DaoGovernanceClient {
  private contract: Contract;
  private server: SorobanRpc.Server;

  constructor(contractId: string, serverUrl: string) {
    this.contract = new Contract(contractId);
    this.server = new SorobanRpc.Server(serverUrl);
  }

  /**
   * Initialize the DAO governance contract
   */
  async initialize(
    admin: string,
    multisigSigners: string[],
    payrollStreamContract: string,
    publicKey: string,
  ): Promise<{ preparedXdr: string }> {
    const account = await this.server.getAccount(publicKey);
    
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015",
    })
      .addOperation(
        this.contract.call(
          "init",
          new Address(admin).toScVal(),
          xdr.ScVal.scvArray(multisigSigners.map(s => new Address(s).toScVal())),
          new Address(payrollStreamContract).toScVal(),
        ),
      )
      .setTimeout(30)
      .build();

    const preparedTx = await this.server.prepareTransaction(tx);
    return {
      preparedXdr: preparedTx.toXDR(),
    };
  }

  /**
   * Create a new proposal
   */
  async createProposal(
    proposer: string,
    proposalType: ProposalType,
    title: string,
    description: string,
    payload: ProposalPayload,
    publicKey: string,
  ): Promise<{ preparedXdr: string }> {
    const account = await this.server.getAccount(publicKey);
    
    // Convert payload to ScVal based on type
    let payloadScVal: xdr.ScVal;
    switch (proposalType) {
      case ProposalType.CreateStream:
        const createPayload = payload as CreateStreamPayload;
        payloadScVal = xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("CreateStream"),
            val: xdr.ScVal.scvMap([
              new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("employer"), val: new Address(createPayload.CreateStream.employer).toScVal() }),
              new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("worker"), val: new Address(createPayload.CreateStream.worker).toScVal() }),
              new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("token"), val: new Address(createPayload.CreateStream.token).toScVal() }),
              new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("rate"), val: xdr.ScVal.scvI128(createPayload.CreateStream.rate) }),
              new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("cliff_ts"), val: xdr.ScVal.scvU64(createPayload.CreateStream.cliff_ts) }),
              new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("start_ts"), val: xdr.ScVal.scvU64(createPayload.CreateStream.start_ts) }),
              new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("end_ts"), val: xdr.ScVal.scvU64(createPayload.CreateStream.end_ts) }),
            ]),
          }),
        ]);
        break;
      
      case ProposalType.CancelStream:
        const cancelPayload = payload as CancelStreamPayload;
        payloadScVal = xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("CancelStream"),
            val: xdr.ScVal.scvMap([
              new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("stream_id"), val: xdr.ScVal.scvU64(cancelPayload.CancelStream.stream_id) }),
            ]),
          }),
        ]);
        break;

      case ProposalType.UpdateStream:
        const updatePayload = payload as UpdateStreamPayload;
        const updateMap: xdr.ScMapEntry[] = [
          new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("stream_id"), val: xdr.ScVal.scvU64(updatePayload.UpdateStream.stream_id) }),
        ];
        
        if (updatePayload.UpdateStream.new_rate !== undefined) {
          updateMap.push(new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("new_rate"), val: xdr.ScVal.scvI128(updatePayload.UpdateStream.new_rate) }));
        }
        
        if (updatePayload.UpdateStream.new_end_ts !== undefined) {
          updateMap.push(new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("new_end_ts"), val: xdr.ScVal.scvU64(updatePayload.UpdateStream.new_end_ts) }));
        }
        
        payloadScVal = xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("UpdateStream"),
            val: xdr.ScVal.scvMap(updateMap),
          }),
        ]);
        break;

      case ProposalType.Transfer:
        const transferPayload = payload as TransferPayload;
        payloadScVal = xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("Transfer"),
            val: xdr.ScVal.scvMap([
              new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("token"), val: new Address(transferPayload.Transfer.token).toScVal() }),
              new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("amount"), val: xdr.ScVal.scvI128(transferPayload.Transfer.amount) }),
              new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("recipient"), val: new Address(transferPayload.Transfer.recipient).toScVal() }),
            ]),
          }),
        ]);
        break;

      case ProposalType.Upgrade:
        const upgradePayload = payload as UpgradePayload;
        payloadScVal = xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("Upgrade"),
            val: xdr.ScVal.scvMap([
              new xdr.ScMapEntry({ 
                key: xdr.ScVal.scvSymbol("new_wasm_hash"), 
                val: xdr.ScVal.scvBytes(Buffer.from(upgradePayload.Upgrade.new_wasm_hash, 'hex')) 
              }),
            ]),
          }),
        ]);
        break;

      case ProposalType.AdminChange:
        const adminChangePayload = payload as AdminChangePayload;
        payloadScVal = xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("AdminChange"),
            val: xdr.ScVal.scvMap([
              new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("new_admin"), val: new Address(adminChangePayload.AdminChange.new_admin).toScVal() }),
            ]),
          }),
        ]);
        break;

      case ProposalType.ThresholdChange:
        const thresholdChangePayload = payload as ThresholdChangePayload;
        payloadScVal = xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("ThresholdChange"),
            val: xdr.ScVal.scvMap([
              new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("new_threshold"), val: xdr.ScVal.scvU32(thresholdChangePayload.ThresholdChange.new_threshold) }),
            ]),
          }),
        ]);
        break;

      default:
        throw new Error(`Unsupported proposal type: ${proposalType}`);
    }

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015",
    })
      .addOperation(
        this.contract.call(
          "create_proposal",
          new Address(proposer).toScVal(),
          xdr.ScVal.scvSymbol(proposalType),
          xdr.ScVal.scvString(title),
          xdr.ScVal.scvString(description),
          payloadScVal,
        ),
      )
      .setTimeout(30)
      .build();

    const preparedTx = await this.server.prepareTransaction(tx);
    return {
      preparedXdr: preparedTx.toXDR(),
    };
  }

  /**
   * Vote on a proposal
   */
  async vote(
    voter: string,
    proposalId: string,
    inFavor: boolean,
    reason?: string,
    publicKey: string,
  ): Promise<{ preparedXdr: string }> {
    const account = await this.server.getAccount(publicKey);
    
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015",
    })
      .addOperation(
        this.contract.call(
          "vote",
          new Address(voter).toScVal(),
          xdr.ScVal.scvU64(parseInt(proposalId)),
          xdr.ScVal.scvBool(inFavor),
          reason ? xdr.ScVal.scvString(reason) : xdr.ScVal.scvVoid(),
        ),
      )
      .setTimeout(30)
      .build();

    const preparedTx = await this.server.prepareTransaction(tx);
    return {
      preparedXdr: preparedTx.toXDR(),
    };
  }

  /**
   * Execute a proposal
   */
  async executeProposal(
    executor: string,
    proposalId: string,
    publicKey: string,
  ): Promise<{ preparedXdr: string }> {
    const account = await this.server.getAccount(publicKey);
    
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015",
    })
      .addOperation(
        this.contract.call(
          "execute_proposal",
          new Address(executor).toScVal(),
          xdr.ScVal.scvU64(parseInt(proposalId)),
        ),
      )
      .setTimeout(30)
      .build();

    const preparedTx = await this.server.prepareTransaction(tx);
    return {
      preparedXdr: preparedTx.toXDR(),
    };
  }

  /**
   * Get proposal details
   */
  async getProposal(proposalId: string): Promise<DaoProposal | null> {
    try {
      const result = await this.server.simulateTransaction(
        new TransactionBuilder(
          new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "1"),
          { fee: BASE_FEE, networkPassphrase: import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015" }
        )
          .addOperation(this.contract.call("get_proposal", xdr.ScVal.scvU64(parseInt(proposalId))))
          .setTimeout(30)
          .build()
      );

      if (result.result) {
        const proposalData = xdr.ScVal.fromXDR(Buffer.from(result.result, 'base64'));
        // Parse the proposal data - this would need proper implementation based on the contract's return format
        // For now, return a mock structure
        return {
          id: proposalId,
          title: "Mock Proposal",
          description: "Mock description",
          type: ProposalType.CreateStream,
          proposer: "G...",
          createdAt: new Date(),
          votingStartsAt: new Date(),
          votingEndsAt: new Date(),
          executableAt: new Date(),
          status: ProposalStatus.Pending,
          votesFor: 0,
          votesAgainst: 0,
          requiredVotes: 2,
          hasVoted: false,
        };
      }
      return null;
    } catch (error) {
      console.error("Failed to get proposal:", error);
      return null;
    }
  }

  /**
   * Get all proposals
   */
  async getAllProposals(): Promise<DaoProposal[]> {
    try {
      const result = await this.server.simulateTransaction(
        new TransactionBuilder(
          new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "1"),
          { fee: BASE_FEE, networkPassphrase: import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015" }
        )
          .addOperation(this.contract.call("get_all_proposals"))
          .setTimeout(30)
          .build()
      );

      if (result.result) {
        // Parse the proposals data - this would need proper implementation based on the contract's return format
        // For now, return empty array
        return [];
      }
      return [];
    } catch (error) {
      console.error("Failed to get all proposals:", error);
      return [];
    }
  }

  /**
   * Get pending proposals
   */
  async getPendingProposals(): Promise<DaoProposal[]> {
    try {
      const result = await this.server.simulateTransaction(
        new TransactionBuilder(
          new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "1"),
          { fee: BASE_FEE, networkPassphrase: import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015" }
        )
          .addOperation(this.contract.call("get_pending_proposals"))
          .setTimeout(30)
          .build()
      );

      if (result.result) {
        // Parse the pending proposals data
        // For now, return empty array
        return [];
      }
      return [];
    } catch (error) {
      console.error("Failed to get pending proposals:", error);
      return [];
    }
  }

  /**
   * Check if a stream requires governance approval
   */
  async streamRequiresGovernance(streamId: string): Promise<boolean> {
    try {
      const result = await this.server.simulateTransaction(
        new TransactionBuilder(
          new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "1"),
          { fee: BASE_FEE, networkPassphrase: import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015" }
        )
          .addOperation(this.contract.call("stream_requires_governance", xdr.ScVal.scvU64(parseInt(streamId))))
          .setTimeout(30)
          .build()
      );

      if (result.result) {
        const requiresGov = xdr.ScVal.fromXDR(Buffer.from(result.result, 'base64'));
        return requiresGov.switch().value() === xdr.ScValType.scvBool && requiresGov.bool();
      }
      return false;
    } catch (error) {
      console.error("Failed to check stream governance requirement:", error);
      return false;
    }
  }
}

/**
 * Helper function to create a DAO governance client
 */
export function createDaoGovernanceClient(): DaoGovernanceClient {
  const contractId = import.meta.env.VITE_DAO_GOVERNANCE_CONTRACT_ID;
  const serverUrl = import.meta.env.VITE_STELLAR_RPC_URL || "https://horizon-testnet.stellar.org";
  
  if (!contractId) {
    throw new Error("DAO governance contract ID not configured");
  }
  
  return new DaoGovernanceClient(contractId, serverUrl);
}
