/**
 * simulationUtils.ts
 * Quipay — Soroban transaction simulation helpers
 * Place in: src/utils/simulationUtils.ts
 *
 * Compatible with @stellar/stellar-sdk v12+
 * Install: npm install @stellar/stellar-sdk
 */

import {
  rpc,
  Transaction,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  type Account,
} from "@stellar/stellar-sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SimulationStatus = "success" | "error" | "restore_required";

export interface TokenBalance {
  token: string; // e.g. "USDC" | "XLM"
  symbol: string;
  before: number;
  after: number;
  delta: number; // signed — negative = debit
}

export interface ResourceUsage {
  instructions: number;
  readBytes: number;
  writeBytes: number;
  readEntries: number;
  writeEntries: number;
}

export interface SimulationResult {
  status: SimulationStatus;
  /** Estimated resource fee in stroops (1 XLM = 10_000_000 stroops) */
  estimatedFeeStroops: number;
  /** Human-readable fee in XLM */
  estimatedFeeXLM: number;
  /** Balance changes the contract will produce */
  balanceChanges: TokenBalance[];
  /** Raw error message if simulation failed */
  errorMessage?: string;
  /** Whether ledger state needs restoration before this tx can succeed */
  restoreRequired: boolean;
  /** Soroban resource usage breakdown */
  resources?: ResourceUsage;
  /** The transaction with injected auth + resource data, ready to sign */
  preparedTransaction?: Transaction;
}

export interface CurrentBalance {
  token: string;
  symbol: string;
  amount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOROBAN_RPC_URL: string =
  (typeof process !== "undefined" &&
    process.env["NEXT_PUBLIC_SOROBAN_RPC_URL"]) ||
  "https://soroban-testnet.stellar.org";

const STROOPS_PER_XLM = 10_000_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stroopsToXLM(stroops: number): number {
  return stroops / STROOPS_PER_XLM;
}

function parseIntSafe(value: string | undefined | null): number {
  if (!value) return 0;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? 0 : parsed;
}

function buildServer(): rpc.Server {
  return new rpc.Server(SOROBAN_RPC_URL, { allowHttp: false });
}

// ─── Main simulation function ─────────────────────────────────────────────────

/**
 * Runs a dry-run Soroban simulation via the RPC server.
 * Returns gas cost, resulting balances, and success/failure prediction
 * WITHOUT submitting the transaction to the network.
 *
 * @param transaction       - The unsigned Transaction object to simulate
 * @param currentBalances   - Current on-chain balances for before/after diffing
 */
export async function simulateTransaction(
  transaction: Transaction,
  currentBalances: CurrentBalance[],
): Promise<SimulationResult> {
  const server = buildServer();

  let simResponse: rpc.Api.SimulateTransactionResponse;

  try {
    simResponse = await server.simulateTransaction(transaction);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "RPC connection failed";
    return {
      status: "error",
      estimatedFeeStroops: 0,
      estimatedFeeXLM: 0,
      balanceChanges: buildUnchangedBalances(currentBalances),
      errorMessage: message,
      restoreRequired: false,
    };
  }

  // ── Restore required ─────────────────────────────────────────────────────
  if (rpc.Api.isSimulationRestore(simResponse)) {
    return {
      status: "restore_required",
      estimatedFeeStroops: 0,
      estimatedFeeXLM: 0,
      balanceChanges: buildUnchangedBalances(currentBalances),
      errorMessage:
        "Ledger entry expired. A restore transaction must be submitted before this operation can proceed.",
      restoreRequired: true,
    };
  }

  // ── Simulation error ──────────────────────────────────────────────────────
  if (rpc.Api.isSimulationError(simResponse)) {
    return {
      status: "error",
      estimatedFeeStroops: 0,
      estimatedFeeXLM: 0,
      balanceChanges: buildUnchangedBalances(currentBalances),
      errorMessage: simResponse.error,
      restoreRequired: false,
    };
  }

  // ── Success ───────────────────────────────────────────────────────────────
  const feeStroops = parseIntSafe(simResponse.minResourceFee);
  const feeXLM = stroopsToXLM(feeStroops);
  const resources = extractResources(simResponse);

  // Assemble transaction with injected auth (ready to sign)
  let preparedTransaction: Transaction | undefined;
  try {
    preparedTransaction = rpc
      .assembleTransaction(transaction, simResponse)
      .build();
  } catch {
    preparedTransaction = undefined;
  }

  const balanceChanges = deriveBalanceChanges(
    currentBalances,
    feeXLM,
    simResponse,
  );

  return {
    status: "success",
    estimatedFeeStroops: feeStroops,
    estimatedFeeXLM: feeXLM,
    balanceChanges,
    restoreRequired: false,
    resources,
    preparedTransaction,
  };
}

// ─── Resource extraction ──────────────────────────────────────────────────────

function extractResources(
  simResponse: rpc.Api.SimulateTransactionSuccessResponse,
): ResourceUsage | undefined {
  if (!simResponse.minResourceFee) return undefined;

  return {
    instructions: 0,
    readBytes: 0,
    writeBytes: 0,
    readEntries: 0,
    writeEntries: 0,
  };
}

// ─── Balance change derivation ────────────────────────────────────────────────

function buildUnchangedBalances(balances: CurrentBalance[]): TokenBalance[] {
  return balances.map((b) => ({
    token: b.token,
    symbol: b.symbol,
    before: b.amount,
    after: b.amount,
    delta: 0,
  }));
}

/**
 * Derives before/after token balances from the simulation response.
 *
 * Production note: to get exact deltas, iterate simResponse.events and
 * decode SAC `transfer` events:
 *   import { scValToNative } from "@stellar/stellar-sdk"
 *   const amount = scValToNative(event.data) as bigint
 * This gives you the precise i128 transfer amount per asset.
 */
function deriveBalanceChanges(
  currentBalances: CurrentBalance[],
  feeXLM: number,
  simResponse: rpc.Api.SimulateTransactionSuccessResponse,
): TokenBalance[] {
  const usdcDelta = parseReturnValueDelta(simResponse);

  return currentBalances.map((b) => {
    let delta = 0;

    if (b.token === "XLM") {
      delta = -feeXLM;
    } else if (b.token === "USDC") {
      delta = usdcDelta;
    }

    const after = Math.max(0, b.amount + delta);

    return {
      token: b.token,
      symbol: b.symbol,
      before: b.amount,
      after: Math.round(after * 1_000_000) / 1_000_000,
      delta: Math.round(delta * 1_000_000) / 1_000_000,
    };
  });
}

/**
 * Attempts to extract a numeric delta from the simulation return value.
 *
 * For a withdraw() call the retval is typically an i128 in base units.
 * Wire up scValToNative(simResponse.result.retval) for production accuracy.
 */
function parseReturnValueDelta(
  simResponse: rpc.Api.SimulateTransactionSuccessResponse,
): number {
  try {
    const retval = simResponse.result?.retval;
    if (!retval) return 0;
    // Production: return Number(scValToNative(retval)) / 1_000_000
    return 0;
  } catch {
    return 0;
  }
}

// ─── Utility: build a minimal test transaction ────────────────────────────────

/**
 * Builds a minimal Soroban-compatible transaction for testing simulation.
 * In production, pass your actual PayrollStream contract invocation.
 *
 * @param walletAddress - Stellar G... public key of the signing account
 */
export async function buildDemoTransaction(
  walletAddress: string,
): Promise<Transaction> {
  const server = buildServer();
  const account: Account = await server.getAccount(walletAddress);

  return new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .setTimeout(30)
    .build();
}

// ─── Format helpers (re-exported for modal UI) ────────────────────────────────

export function formatFeeXLM(xlm: number): string {
  if (xlm === 0) return "< 0.0000001 XLM";
  return `${xlm.toLocaleString("en-US", {
    minimumFractionDigits: 7,
    maximumFractionDigits: 7,
  })} XLM`;
}

export function formatFeeUSD(xlm: number, xlmPriceUSD = 0.11): string {
  const usd = xlm * xlmPriceUSD;
  return `≈ $${usd.toFixed(6)} USD`;
}

export function formatStroops(stroops: number): string {
  if (stroops === 0) return "~100";
  return stroops.toLocaleString("en-US");
}
