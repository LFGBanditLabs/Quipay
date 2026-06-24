/**
 * Network-aware token address registry.
 *
 * All Soroban token contract addresses (Stellar Asset Contracts / SACs) are
 * network-specific. Using a testnet address on mainnet silently causes
 * transactions to reference the wrong asset or fail entirely at broadcast.
 *
 * This module reads PUBLIC_STELLAR_NETWORK from the environment (validated by
 * src/contracts/util.ts) and returns the correct set of addresses for the
 * active network. An unrecognised network value throws at module-load time so
 * the misconfiguration is surfaced immediately rather than at runtime.
 */

import { stellarNetwork } from "../contracts/util";

// ─── Known token SAC addresses ────────────────────────────────────────────────

/**
 * XLM Stellar Asset Contract addresses.
 * These are the canonical SAC wrappers for the native XLM asset on each
 * network.  A contract address looks like a Stellar contract ID (starts with C
 * and is 56 chars long).
 *
 * LOCAL / standalone nets do not have a canonical SAC; use the testnet address
 * during development or deploy a local SAC and override via
 * VITE_XLM_SAC_CONTRACT_ID.
 */
const XLM_SAC: Record<string, string> = {
  TESTNET: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  PUBLIC: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
  FUTURENET: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  LOCAL: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
};

/**
 * USDC Stellar Asset Contract / issuer addresses.
 * On testnet, Circle uses GBBD47…; on mainnet, GA5ZSE…
 */
const USDC_ADDRESS: Record<string, string> = {
  TESTNET: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  PUBLIC: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  FUTURENET: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  LOCAL: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
};

// ─── Lookup ───────────────────────────────────────────────────────────────────

function resolveAddress(map: Record<string, string>, symbol: string): string {
  const override = import.meta.env[`VITE_${symbol}_SAC_CONTRACT_ID`] as
    | string
    | undefined;
  if (override) return override;

  const addr = map[stellarNetwork];
  if (!addr) {
    // Fail loudly — an unknown network means all token addresses are wrong.
    throw new Error(
      `[tokenAddresses] No ${symbol} address configured for network "${stellarNetwork}". ` +
        `Set VITE_${symbol}_SAC_CONTRACT_ID in your .env file or add an entry to ` +
        `src/lib/tokenAddresses.ts.`,
    );
  }
  return addr;
}

export interface TokenAddresses {
  XLM: string;
  USDC: string;
}

/**
 * Returns the token contract addresses for the currently active Stellar
 * network. Throws with a clear message if the network is unrecognised and no
 * override env var is set.
 *
 * @example
 * import { getTokenAddresses } from "../lib/tokenAddresses";
 * const TOKEN_ADDRESS = getTokenAddresses();
 * // TOKEN_ADDRESS.XLM — correct SAC for the current network
 */
export function getTokenAddresses(): TokenAddresses {
  return {
    XLM: resolveAddress(XLM_SAC, "XLM"),
    USDC: resolveAddress(USDC_ADDRESS, "USDC"),
  };
}

/**
 * The XLM SAC address for the active network.
 * Alias kept for use in contract files that only need XLM.
 */
export function getXlmSacAddress(): string {
  return resolveAddress(XLM_SAC, "XLM");
}
