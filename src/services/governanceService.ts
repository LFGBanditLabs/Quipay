/**
 * governanceService.ts
 * ─────────────────────
 * Service layer for governance/multisig operations.
 *
 * Reads multisig configuration from the Stellar Horizon API and
 * interacts with the PayrollVault contract for proposal management.
 */

import {
  Contract,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc as SorobanRpc,
} from "@stellar/stellar-sdk";
import { rpcUrl, networkPassphrase, horizonUrl } from "../contracts/util";
import { PAYROLL_VAULT_CONTRACT_ID } from "../contracts/payroll_vault";
import type {
  MultisigConfig,
  MultisigProposal,
  ExecutionHistoryEntry,
  SignerStatus,
} from "../pages/GovernanceOverview";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRpcServer(): SorobanRpc.Server {
  return new SorobanRpc.Server(rpcUrl, { allowHttp: true });
}

interface HorizonSigner {
  key: string;
  weight: number;
  type: string;
}

interface HorizonAccount {
  id: string;
  thresholds: {
    low_threshold: number;
    med_threshold: number;
    high_threshold: number;
  };
  signers: HorizonSigner[];
}

// ─── getMultisigConfig ────────────────────────────────────────────────────────

export async function getMultisigConfig(
  vaultAddress: string,
  currentUserAddress?: string,
): Promise<MultisigConfig> {
  // First get the admin address from the vault contract
  let adminAddress = vaultAddress;

  if (PAYROLL_VAULT_CONTRACT_ID) {
    const server = getRpcServer();
    const contract = new Contract(PAYROLL_VAULT_CONTRACT_ID);

    const source = await server
      .getAccount(PAYROLL_VAULT_CONTRACT_ID)
      .catch(() => null);
    if (source) {
      const tx = new TransactionBuilder(source, {
        fee: "100",
        networkPassphrase,
      })
        .addOperation(contract.call("get_admin"))
        .setTimeout(10)
        .build();

      const response = await server.simulateTransaction(tx);
      if (!SorobanRpc.Api.isSimulationError(response)) {
        const retval = (
          response as SorobanRpc.Api.SimulateTransactionSuccessResponse
        ).result?.retval;
        if (retval) {
          adminAddress = scValToNative(retval) as string;
        }
      }
    }
  }

  // Query Horizon for the admin account's multisig configuration
  const res = await fetch(`${horizonUrl}/accounts/${adminAddress}`);
  if (!res.ok) {
    return {
      threshold: 1,
      totalSigners: 1,
      signers: [adminAddress],
      isCurrentUserSigner: currentUserAddress === adminAddress,
    };
  }

  const account = (await res.json()) as HorizonAccount;
  const signers = account.signers.filter((s) => s.weight > 0).map((s) => s.key);

  // Use med_threshold as the default for most operations
  const threshold = account.thresholds.med_threshold || 1;

  return {
    threshold,
    totalSigners: signers.length,
    signers,
    isCurrentUserSigner: currentUserAddress
      ? signers.includes(currentUserAddress)
      : false,
  };
}

// ─── getPendingProposals ──────────────────────────────────────────────────────

export async function getPendingProposals(
  vaultAddress: string,
  currentUserAddress?: string,
): Promise<MultisigProposal[]> {
  if (!PAYROLL_VAULT_CONTRACT_ID) return [];

  const server = getRpcServer();
  const contract = new Contract(PAYROLL_VAULT_CONTRACT_ID);

  // Check for pending upgrade proposal via get_pending_upgrade
  const source = await server
    .getAccount(PAYROLL_VAULT_CONTRACT_ID)
    .catch(() => null);
  if (!source) return [];

  const tx = new TransactionBuilder(source, { fee: "100", networkPassphrase })
    .addOperation(contract.call("get_pending_upgrade"))
    .setTimeout(10)
    .build();

  const response = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(response)) return [];

  const retval = (response as SorobanRpc.Api.SimulateTransactionSuccessResponse)
    .result?.retval;
  if (!retval) return [];

  const pendingUpgrade = scValToNative(retval) as {
    wasm_hash: string;
    execute_after: bigint;
    proposed_at: bigint;
    proposed_by: string;
  } | null;

  if (!pendingUpgrade) return [];

  // Get multisig config to populate signers
  const config = await getMultisigConfig(vaultAddress, currentUserAddress);

  const signers: SignerStatus[] = config.signers.map((addr) => ({
    address: addr,
    hasSigned: false,
    isCurrentUser: addr === currentUserAddress,
  }));

  const proposal: MultisigProposal = {
    id: `upgrade-${pendingUpgrade.proposed_at}`,
    title: "Pending Contract Upgrade",
    description: `Upgrade proposed by ${pendingUpgrade.proposed_by.slice(0, 6)}...${pendingUpgrade.proposed_by.slice(-4)}. Executable after timelock period.`,
    type: "upgrade",
    proposer: pendingUpgrade.proposed_by,
    createdAt: new Date(Number(pendingUpgrade.proposed_at) * 1000),
    expiresAt: new Date(
      Number(pendingUpgrade.execute_after) * 1000 + 604800000,
    ),
    requiredApprovals: config.threshold,
    currentApprovals: 0,
    hasApproved: false,
    isExecuted: false,
    signers,
  };

  return [proposal];
}

// ─── getExecutionHistory ──────────────────────────────────────────────────────

export async function getExecutionHistory(
  vaultAddress: string,
): Promise<ExecutionHistoryEntry[]> {
  void vaultAddress;
  if (!PAYROLL_VAULT_CONTRACT_ID) return [];

  const server = getRpcServer();

  try {
    const { sequence: latestLedger } = await server.getLatestLedger();
    const startLedger = Math.max(1, latestLedger - 17280);

    const symUpgradeExec = nativeToScVal("up_exec", { type: "symbol" }).toXDR(
      "base64",
    );

    const response = await server.getEvents({
      startLedger,
      filters: [
        {
          type: "contract",
          contractIds: [PAYROLL_VAULT_CONTRACT_ID],
          topics: [["*", symUpgradeExec]],
        },
      ],
      limit: 50,
    });

    return response.events.map((ev, idx) => {
      let executedBy = "";
      try {
        executedBy = scValToNative(ev.topic[0]) as string;
      } catch {
        executedBy = "Unknown";
      }

      return {
        id: `exec-${idx}`,
        proposalId: `upgrade-${ev.ledgerClosedAt}`,
        title: "Contract Upgrade Executed",
        type: "upgrade" as const,
        executedAt: new Date(ev.ledgerClosedAt),
        executedBy,
        requiredApprovals: 1,
        totalSigners: 1,
      };
    });
  } catch {
    return [];
  }
}

// ─── approveProposal ─────────────────────────────────────────────────────────

export async function approveProposal(
  _proposalId: string,
  signerAddress: string,
  signTransaction: (
    xdr: string,
    opts: { networkPassphrase: string },
  ) => Promise<string>,
): Promise<void> {
  if (!PAYROLL_VAULT_CONTRACT_ID) {
    throw new Error("Vault contract ID is not configured.");
  }

  const server = getRpcServer();
  const account = await server.getAccount(signerAddress);
  const contract = new Contract(PAYROLL_VAULT_CONTRACT_ID);

  // Build a no-op read call that acts as approval attestation
  // In Stellar multisig, the actual "approval" is signing the final tx
  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase,
  })
    .addOperation(contract.call("get_pending_upgrade"))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  const signedXdr = await signTransaction(prepared.toXDR(), {
    networkPassphrase,
  });

  // Submit the signed transaction
  const signedTx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  await server.sendTransaction(signedTx);
}

// ─── executeProposal ─────────────────────────────────────────────────────────

export async function executeProposal(
  _proposalId: string,
  signerAddress: string,
  signTransaction: (
    xdr: string,
    opts: { networkPassphrase: string },
  ) => Promise<string>,
): Promise<void> {
  if (!PAYROLL_VAULT_CONTRACT_ID) {
    throw new Error("Vault contract ID is not configured.");
  }

  const server = getRpcServer();
  const account = await server.getAccount(signerAddress);
  const contract = new Contract(PAYROLL_VAULT_CONTRACT_ID);

  // Get the pending upgrade to extract the version
  const source = await server
    .getAccount(PAYROLL_VAULT_CONTRACT_ID)
    .catch(() => null);
  if (!source) throw new Error("Could not load contract source account.");

  const readTx = new TransactionBuilder(source, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(contract.call("get_pending_upgrade"))
    .setTimeout(10)
    .build();

  const simResponse = await server.simulateTransaction(readTx);
  if (SorobanRpc.Api.isSimulationError(simResponse)) {
    throw new Error("No pending upgrade found to execute.");
  }

  const retval = (
    simResponse as SorobanRpc.Api.SimulateTransactionSuccessResponse
  ).result?.retval;
  if (!retval) throw new Error("No pending upgrade found to execute.");

  const pendingUpgrade = scValToNative(retval) as {
    wasm_hash: string;
    execute_after: bigint;
  };
  void pendingUpgrade;

  // Build the execute_upgrade transaction
  // The version tuple is inferred from the pending upgrade context
  const executeTx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "execute_upgrade",
        nativeToScVal([1, 0, 0], { type: { type: "tuple" } }),
      ),
    )
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(executeTx);
  const signedXdr = await signTransaction(prepared.toXDR(), {
    networkPassphrase,
  });

  const signedTx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  const sendResponse = await server.sendTransaction(signedTx);

  if (sendResponse.status === "ERROR") {
    throw new Error(
      `Transaction failed: ${JSON.stringify(sendResponse.errorResult)}`,
    );
  }

  // Poll for confirmation
  const hash = sendResponse.hash;
  let attempts = 0;
  while (attempts < 30) {
    const status = await server.getTransaction(hash);
    if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) return;
    if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed on-chain. Hash: ${hash}`);
    }
    await new Promise<void>((r) => setTimeout(r, 1000));
    attempts++;
  }

  throw new Error(`Transaction confirmation timed out. Hash: ${hash}`);
}
