/**
 * payroll_vault.ts
 * ─────────────────
 * Frontend bindings for the PayrollVault Soroban contract.
 *
 * Exports
 * ───────
 * • PAYROLL_VAULT_CONTRACT_ID   – contract address from env
 * • TokenVaultData              – shape of vault data for a token
 * • getVaultBalance             – reads total balance for a token
 * • getVaultLiability           – reads total liability for a token
 * • getVaultAvailableBalance    – reads available balance (balance - liability)
 * • getVaultData                – reads complete vault data for a token
 * • getAllVaultData             – reads vault data for all configured tokens
 */

import {
  Contract,
  rpc as SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  Address,
} from "@stellar/stellar-sdk";
import { rpcUrl, networkPassphrase } from "./util";

// ─── Contract ID ──────────────────────────────────────────────────────────────

export const PAYROLL_VAULT_CONTRACT_ID: string =
  (
    import.meta.env.VITE_PAYROLL_VAULT_CONTRACT_ID as string | undefined
  )?.trim() ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Shape of vault data for a specific token as returned by the contract.
 */
export interface TokenVaultData {
  /** Token contract address (or empty string for native XLM) */
  token: string;
  /** Token symbol (e.g., "XLM", "USDC") */
  tokenSymbol: string;
  /** Total balance in stroops (smallest unit) */
  balance: bigint;
  /** Total liability (committed to streams) in stroops */
  liability: bigint;
  /** Available balance (balance - liability) in stroops */
  available: bigint;
  /** Monthly burn rate in stroops (estimated) */
  monthlyBurnRate: bigint;
  /** Runway in days (how long available balance will last) */
  runwayDays: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRpcServer(): SorobanRpc.Server {
  return new SorobanRpc.Server(rpcUrl, { allowHttp: true });
}

/**
 * Converts a token string to a ScVal suitable for the contract.
 * Empty string → native XLM address bytes.
 */
function tokenToScVal(token: string): ReturnType<typeof nativeToScVal> {
  if (!token || token === "native") {
    return nativeToScVal(null, { type: "address" });
  }
  return new Address(token).toScVal();
}

/**
 * Simulates a read-only contract call.
 */
async function simulateContractRead<T>(
  sourceAddress: string,
  operation: ReturnType<Contract["call"]>,
): Promise<T | null> {
  const server = getRpcServer();

  let source = await server.getAccount(sourceAddress).catch(() => null);
  if (!source && PAYROLL_VAULT_CONTRACT_ID) {
    source = await server
      .getAccount(PAYROLL_VAULT_CONTRACT_ID)
      .catch(() => null);
  }
  if (!source) return null;

  const tx = new TransactionBuilder(source, { fee: "100", networkPassphrase })
    .addOperation(operation)
    .setTimeout(10)
    .build();

  const response = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(response)) return null;

  const retval = (response as SorobanRpc.Api.SimulateTransactionSuccessResponse)
    .result?.retval;
  if (!retval) return null;

  const native = scValToNative(retval) as T | undefined;
  return native ?? null;
}

// ─── buildDepositTx ─────────────────────────────────────────────────────────

/**
 * Simulates and builds a `deposit` transaction, returning the
 * base64-encoded prepared XDR ready for signing.
 */
export async function buildDepositTx(
  fromAddress: string,
  token: string,
  amount: bigint,
): Promise<{ preparedXdr: string }> {
  if (!PAYROLL_VAULT_CONTRACT_ID) {
    throw new Error("VITE_PAYROLL_VAULT_CONTRACT_ID is not set.");
  }

  const server = getRpcServer();
  const account = await server.getAccount(fromAddress);
  const contract = new Contract(PAYROLL_VAULT_CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "deposit",
        new Address(fromAddress).toScVal(),
        tokenToScVal(token),
        nativeToScVal(amount, { type: "i128" }),
      ),
    )
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return { preparedXdr: prepared.toXDR() };
}

// ─── getVaultBalance ─────────────────────────────────────────────────────────

/**
 * Calls `get_balance` on the PayrollVault contract to get the total balance
 * for a specific token.
 *
 * @param token Token contract address (or empty string for XLM)
 * @returns Balance in stroops, or null if error
 */
export async function getVaultBalance(token: string): Promise<bigint | null> {
  if (!PAYROLL_VAULT_CONTRACT_ID) return null;

  const contract = new Contract(PAYROLL_VAULT_CONTRACT_ID);
  const balance = await simulateContractRead<bigint>(
    PAYROLL_VAULT_CONTRACT_ID,
    contract.call("get_balance", tokenToScVal(token)),
  );

  return balance ?? null;
}

// ─── getVaultLiability ───────────────────────────────────────────────────────

/**
 * Calls `get_liability` on the PayrollVault contract to get the total
 * liability (amount committed to streams) for a specific token.
 *
 * @param token Token contract address (or empty string for XLM)
 * @returns Liability in stroops, or null if error
 */
export async function getVaultLiability(token: string): Promise<bigint | null> {
  if (!PAYROLL_VAULT_CONTRACT_ID) return null;

  const contract = new Contract(PAYROLL_VAULT_CONTRACT_ID);
  const liability = await simulateContractRead<bigint>(
    PAYROLL_VAULT_CONTRACT_ID,
    contract.call("get_liability", tokenToScVal(token)),
  );

  return liability ?? null;
}

// ─── getVaultAvailableBalance ────────────────────────────────────────────────

/**
 * Calls `get_available_balance` on the PayrollVault contract to get the
 * available balance (balance - liability) for a specific token.
 *
 * @param token Token contract address (or empty string for XLM)
 * @returns Available balance in stroops, or null if error
 */
export async function getVaultAvailableBalance(
  token: string,
): Promise<bigint | null> {
  if (!PAYROLL_VAULT_CONTRACT_ID) return null;

  const contract = new Contract(PAYROLL_VAULT_CONTRACT_ID);
  const available = await simulateContractRead<bigint>(
    PAYROLL_VAULT_CONTRACT_ID,
    contract.call("get_available_balance", tokenToScVal(token)),
  );

  return available ?? null;
}

// ─── getVaultData ────────────────────────────────────────────────────────────

/**
 * Fetches complete vault data for a specific token including balance,
 * liability, available balance, and runway calculation.
 *
 * @param token Token contract address (or empty string for XLM)
 * @param tokenSymbol Human-readable token symbol (e.g., "XLM", "USDC")
 * @param monthlyBurnRate Estimated monthly burn rate in stroops
 * @returns Complete vault data, or null if error
 */
export async function getVaultData(
  token: string,
  tokenSymbol: string,
  monthlyBurnRate: bigint = BigInt(0),
): Promise<TokenVaultData | null> {
  if (!PAYROLL_VAULT_CONTRACT_ID) return null;

  const [balance, liability, available] = await Promise.all([
    getVaultBalance(token),
    getVaultLiability(token),
    getVaultAvailableBalance(token),
  ]);

  if (balance === null || liability === null || available === null) {
    return null;
  }

  // Calculate runway in days
  let runwayDays = 0;
  if (monthlyBurnRate > BigInt(0)) {
    const dailyBurnRate = monthlyBurnRate / BigInt(30);
    if (dailyBurnRate > BigInt(0)) {
      runwayDays = Number(available / dailyBurnRate);
    }
  } else if (available > BigInt(0)) {
    // If no burn rate, show infinity (use large number)
    runwayDays = 9999;
  }

  return {
    token,
    tokenSymbol,
    balance,
    liability,
    available,
    monthlyBurnRate,
    runwayDays,
  };
}

// ─── getAllVaultData ─────────────────────────────────────────────────────────

/**
 * Fetches vault data for all configured tokens (XLM and USDC by default).
 *
 * @param tokens Array of { token: string, tokenSymbol: string, monthlyBurnRate: bigint }
 * @returns Array of vault data for each token
 */
export async function getAllVaultData(
  tokens: Array<{
    token: string;
    tokenSymbol: string;
    monthlyBurnRate: bigint;
  }>,
): Promise<TokenVaultData[]> {
  const results = await Promise.all(
    tokens.map((t) => getVaultData(t.token, t.tokenSymbol, t.monthlyBurnRate)),
  );

  return results.filter((r): r is TokenVaultData => r !== null);
}

// ─── getSupportedTokens ──────────────────────────────────────────────────────

/**
 * Calls `get_supported_tokens` on the PayrollVault contract to get the list
 * of all token addresses supported by the vault.
 *
 * @returns Array of token contract addresses
 */
export async function getSupportedTokens(): Promise<string[]> {
  if (!PAYROLL_VAULT_CONTRACT_ID) return [];

  const contract = new Contract(PAYROLL_VAULT_CONTRACT_ID);
  const tokens = await simulateContractRead<string[]>(
    PAYROLL_VAULT_CONTRACT_ID,
    contract.call("get_supported_tokens"),
  );

  return tokens ?? [];
}
