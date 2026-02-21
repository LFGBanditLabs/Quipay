/**
 * payroll_stream.ts
 * ─────────────────
 * Frontend bindings for the PayrollStream Soroban contract.
 *
 * Exports
 * ───────
 * • PAYROLL_STREAM_CONTRACT_ID  – contract address from env
 * • CreateStreamParams          – parameter type for create_stream
 * • buildCreateStreamTx         – simulate + build a create_stream XDR
 * • checkTreasurySolvency       – reads PayrollVault.check_solvency
 * • submitAndAwaitTx            – submit a signed XDR and wait for confirmation
 */

import {
  Contract,
  rpc as SorobanRpc,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  Address,
  xdr,
} from "@stellar/stellar-sdk";
import { rpcUrl, networkPassphrase } from "./util";

// ─── Contract ID ──────────────────────────────────────────────────────────────

export const PAYROLL_STREAM_CONTRACT_ID: string =
  (
    import.meta.env.VITE_PAYROLL_STREAM_CONTRACT_ID as string | undefined
  )?.trim() ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateStreamParams {
  /** Employer's Stellar public key (G…) */
  employer: string;
  /** Worker's Stellar public key (G…) */
  worker: string;
  /**
   * Token identifier – empty string for native XLM, or the full
   * "CODE:ISSUER" string for a Stellar asset.
   */
  token: string;
  /** Flow rate in stroops per second */
  rate: bigint;
  /** Total amount deposited into the stream in stroops */
  amount: bigint;
  /** Unix timestamp (seconds) for stream start */
  startTs: number;
  /** Unix timestamp (seconds) for stream end */
  endTs: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRpcServer(): SorobanRpc.Server {
  return new SorobanRpc.Server(rpcUrl, { allowHttp: true });
}

/**
 * Converts a token string to a ScVal suitable for the contract.
 * Empty string → native XLM address bytes.
 */
function tokenToScVal(token: string): xdr.ScVal {
  // Native XLM is represented as a zero-bytes contract address on Soroban
  if (!token || token === "native") {
    return nativeToScVal(null, { type: "address" });
  }
  // SAC (Stellar Asset Contract) — pass as address string
  return new Address(token).toScVal();
}

// ─── buildCreateStreamTx ─────────────────────────────────────────────────────

/**
 * Simulates and builds a `create_stream` transaction, returning the
 * base64-encoded prepared XDR ready for signing.
 */
export async function buildCreateStreamTx(
  params: CreateStreamParams,
): Promise<{ preparedXdr: string }> {
  if (!PAYROLL_STREAM_CONTRACT_ID) {
    throw new Error(
      "VITE_PAYROLL_STREAM_CONTRACT_ID is not set in environment variables.",
    );
  }

  const server = getRpcServer();
  const account = await server.getAccount(params.employer);

  const contract = new Contract(PAYROLL_STREAM_CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "create_stream",
        new Address(params.employer).toScVal(),
        new Address(params.worker).toScVal(),
        tokenToScVal(params.token),
        nativeToScVal(params.rate, { type: "i128" }),
        nativeToScVal(params.amount, { type: "i128" }),
        nativeToScVal(BigInt(params.startTs), { type: "u64" }),
        nativeToScVal(BigInt(params.endTs), { type: "u64" }),
      ),
    )
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return { preparedXdr: prepared.toXDR() };
}

// ─── checkTreasurySolvency ────────────────────────────────────────────────────

/**
 * Calls `check_solvency` on the PayrollVault contract to determine whether
 * the vault holds enough funds for the requested stream total.
 *
 * Returns `true` if the treasury is solvent, `false` otherwise.
 */
export async function checkTreasurySolvency(
  vaultContractId: string,
  tokenContractId: string,
  requiredAmount: bigint,
): Promise<boolean> {
  if (!vaultContractId) {
    // No vault configured — optimistically allow the user to proceed
    return true;
  }

  const server = getRpcServer();
  const contract = new Contract(vaultContractId);

  // We use a dummy source account for read-only simulation
  const dummySource = await server
    .getAccount(vaultContractId)
    .catch(() => null);
  if (!dummySource) return true;

  const tx = new TransactionBuilder(dummySource, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "check_solvency",
        tokenContractId
          ? new Address(tokenContractId).toScVal()
          : nativeToScVal(null, { type: "address" }),
        nativeToScVal(requiredAmount, { type: "i128" }),
      ),
    )
    .setTimeout(10)
    .build();

  const response = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(response)) {
    console.warn("Solvency simulation error:", response.error);
    return false;
  }

  const result = (response as SorobanRpc.Api.SimulateTransactionSuccessResponse)
    .result?.retval;
  if (!result) return true;

  return scValToNative(result) as boolean;
}

// ─── submitAndAwaitTx ─────────────────────────────────────────────────────────

/**
 * Submits a signed transaction XDR to the Soroban RPC and polls until
 * it is confirmed (SUCCESS) or fails.
 *
 * Returns the transaction hash on success.
 */
export async function submitAndAwaitTx(signedTxXdr: string): Promise<string> {
  const server = getRpcServer();
  const tx = TransactionBuilder.fromXDR(
    signedTxXdr,
    networkPassphrase,
  ) as Transaction;

  const sendResponse = await server.sendTransaction(tx);

  if (sendResponse.status === "ERROR") {
    throw new Error(
      `Transaction submission failed: ${JSON.stringify(sendResponse.errorResult)}`,
    );
  }

  const hash = sendResponse.hash;

  // Poll for confirmation
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    const statusResponse = await server.getTransaction(hash);

    if (statusResponse.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return hash;
    }

    if (statusResponse.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed on-chain. Hash: ${hash}`);
    }

    // PENDING / NOT_FOUND — wait and retry
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    attempts++;
  }

  throw new Error(
    `Transaction confirmation timed out after ${maxAttempts}s. Hash: ${hash}`,
  );
}
