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

// Native XLM SAC on testnet — always pass the real contract address
const XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

function tokenToScVal(token: string): ReturnType<typeof nativeToScVal> {
  const addr = !token || token === "native" ? XLM_SAC : token;
  return new Address(addr).toScVal();
}

/**
 * Simulates a read-only contract call.
 */
async function simulateContractRead<T>(
  sourceAddress: string,
  operation: ReturnType<Contract["call"]>,
): Promise<T | null> {
  const server = getRpcServer();

  // Only G... accounts exist in the ledger AccountEntry store.
  // Fetch the real account so we get the correct sequence number.
  const source = await server.getAccount(sourceAddress).catch(() => null);
  if (!source) return null;

  const tx = new TransactionBuilder(source, { fee: "100", networkPassphrase })
    .addOperation(operation)
    .setTimeout(10)
    .build();

  try {
    const response = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(response)) return null;

    const retval = (
      response as SorobanRpc.Api.SimulateTransactionSuccessResponse
    ).result?.retval;
    if (!retval) return null;

    const native = scValToNative(retval) as T | undefined;
    return native ?? null;
  } catch {
    return null;
  }
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
    .setTimeout(300)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return { preparedXdr: prepared.toXDR() };
}

// ─── buildVaultWithdrawTx ────────────────────────────────────────────────────

/**
 * Builds a `withdraw` transaction so the admin can pull funds back out
 * of the vault to a given address.
 *
 * Signature: withdraw(to: Address, token: Address, amount: i128)
 */
export async function buildVaultWithdrawTx(
  adminAddress: string,
  toAddress: string,
  token: string,
  amount: bigint,
): Promise<{ preparedXdr: string }> {
  if (!PAYROLL_VAULT_CONTRACT_ID) {
    throw new Error("VITE_PAYROLL_VAULT_CONTRACT_ID is not set.");
  }

  const server = getRpcServer();
  const account = await server.getAccount(adminAddress);
  const contract = new Contract(PAYROLL_VAULT_CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "withdraw",
        new Address(toAddress).toScVal(),
        tokenToScVal(token),
        nativeToScVal(amount, { type: "i128" }),
      ),
    )
    .setTimeout(300)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return { preparedXdr: prepared.toXDR() };
}

// ─── getVaultBalance ─────────────────────────────────────────────────────────

/**
 * Returns ONLY this employer's deposited balance for a token.
 * Each employer has their own balance — calling the global get_balance would
 * show the combined balance of all employers, which is wrong.
 */
export async function getEmployerVaultBalance(
  employerAddress: string,
  token: string,
): Promise<bigint | null> {
  if (!PAYROLL_VAULT_CONTRACT_ID) return null;
  const contract = new Contract(PAYROLL_VAULT_CONTRACT_ID);
  return simulateContractRead<bigint>(
    employerAddress,
    contract.call(
      "get_employer_balance",
      new Address(employerAddress).toScVal(),
      tokenToScVal(token),
    ),
  );
}

/**
 * Calls `get_balance` on the PayrollVault contract to get the total balance
 * for a specific token.
 *
 * @param token Token contract address (or empty string for XLM)
 * @returns Balance in stroops, or null if error
 */
export async function getVaultBalance(
  token: string,
  sourceAddress: string,
): Promise<bigint | null> {
  if (!PAYROLL_VAULT_CONTRACT_ID) return null;
  const contract = new Contract(PAYROLL_VAULT_CONTRACT_ID);
  return simulateContractRead<bigint>(
    sourceAddress,
    contract.call("get_balance", tokenToScVal(token)),
  );
}

// ─── getVaultLiability ───────────────────────────────────────────────────────

/**
 * Calls `get_liability` on the PayrollVault contract to get the total
 * liability (amount committed to streams) for a specific token.
 *
 * @param token Token contract address (or empty string for XLM)
 * @returns Liability in stroops, or null if error
 */
export async function getVaultLiability(
  token: string,
  sourceAddress: string,
): Promise<bigint | null> {
  if (!PAYROLL_VAULT_CONTRACT_ID) return null;
  const contract = new Contract(PAYROLL_VAULT_CONTRACT_ID);
  return simulateContractRead<bigint>(
    sourceAddress,
    contract.call("get_liability", tokenToScVal(token)),
  );
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
  sourceAddress: string,
): Promise<bigint | null> {
  if (!PAYROLL_VAULT_CONTRACT_ID) return null;
  const contract = new Contract(PAYROLL_VAULT_CONTRACT_ID);
  return simulateContractRead<bigint>(
    sourceAddress,
    contract.call("get_available_balance", tokenToScVal(token)),
  );
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
  sourceAddress: string,
  monthlyBurnRate: bigint = BigInt(0),
): Promise<TokenVaultData | null> {
  if (!PAYROLL_VAULT_CONTRACT_ID) return null;

  const [balance, liability, available] = await Promise.all([
    getVaultBalance(token, sourceAddress),
    getVaultLiability(token, sourceAddress),
    getVaultAvailableBalance(token, sourceAddress),
  ]);

  if (balance === null && liability === null && available === null) return null;

  const bal = balance ?? BigInt(0);
  const liab = liability ?? BigInt(0);
  const avail = available ?? (bal > liab ? bal - liab : BigInt(0));

  let runwayDays = 0;
  if (monthlyBurnRate > BigInt(0)) {
    const dailyBurnRate = monthlyBurnRate / BigInt(30);
    if (dailyBurnRate > BigInt(0)) runwayDays = Number(avail / dailyBurnRate);
  } else if (avail > BigInt(0)) {
    runwayDays = 9999;
  }

  return {
    token,
    tokenSymbol,
    balance: bal,
    liability: liab,
    available: avail,
    monthlyBurnRate,
    runwayDays,
  };
}

export async function getAllVaultData(
  tokens: Array<{
    token: string;
    tokenSymbol: string;
    monthlyBurnRate: bigint;
  }>,
  sourceAddress: string,
): Promise<TokenVaultData[]> {
  if (!sourceAddress) return [];

  // Use per-employer balance — never the global vault balance.
  // Each employer only sees what THEY deposited.
  const results = await Promise.all(
    tokens.map(async (t) => {
      const [empBalance, globalAvailable] = await Promise.all([
        getEmployerVaultBalance(sourceAddress, t.token),
        getVaultAvailableBalance(t.token, sourceAddress),
      ]);

      const bal = empBalance ?? BigInt(0);
      const avail = globalAvailable ?? BigInt(0);
      // Liability = how much of this employer's balance is committed to streams
      const liab = bal > avail ? bal - avail : BigInt(0);
      const empAvail = bal > liab ? bal - liab : BigInt(0);

      if (bal === BigInt(0)) return null; // employer has no balance here

      return {
        token: t.token,
        tokenSymbol: t.tokenSymbol,
        balance: bal,
        liability: liab,
        available: empAvail,
        monthlyBurnRate: t.monthlyBurnRate,
        runwayDays: 0,
      } as TokenVaultData;
    }),
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
