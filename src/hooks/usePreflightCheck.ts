/**
 * usePreflightCheck.ts
 * ────────────────────
 * Proactive "pre-flight" checks that run BEFORE every on-chain action.
 * Validates network health, wallet connectivity, balance sufficiency,
 * RPC availability, and network congestion.
 *
 * Usage:
 *   const { runPreflight, preflightResult, isChecking } = usePreflightCheck();
 *   const ok = await runPreflight({ requiredToken: "USDC", requiredAmount: 100 });
 *   if (!ok) { /* show preflightResult.issues to user * / }
 */

import { useState, useCallback } from "react";
import { useNetworkStatus } from "../providers/NetworkStatusProvider";
import { useWallet } from "./useWallet";
import { stellarNetwork } from "../contracts/util";

/* ── Types ──────────────────────────────────────────────────────────────────── */

export type PreflightSeverity = "blocker" | "warning" | "info";

export interface PreflightIssue {
  id: string;
  severity: PreflightSeverity;
  title: string;
  message: string;
  fixAction?: {
    label: string;
    onClick: () => void;
  };
}

export interface PreflightResult {
  passed: boolean;
  issues: PreflightIssue[];
  checkedAt: number;
}

export interface PreflightOptions {
  /** Token symbol required for the action (e.g. "USDC") */
  requiredToken?: string;
  /** Minimum amount of the token required */
  requiredAmount?: number;
  /** Minimum XLM needed for fees (defaults to 1) */
  minXlmForFees?: number;
  /** Skip specific checks */
  skip?: ("network" | "wallet" | "balance" | "congestion")[];
}

const formatNetworkName = (name: string) =>
  name === "STANDALONE"
    ? "Local"
    : name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

const appNetwork = formatNetworkName(stellarNetwork);

/* ── Hook ───────────────────────────────────────────────────────────────────── */

export function usePreflightCheck() {
  const networkStatus = useNetworkStatus();
  const wallet = useWallet();
  const [isChecking, setIsChecking] = useState(false);
  const [preflightResult, setPreflightResult] =
    useState<PreflightResult | null>(null);

  const runPreflight = useCallback(
    async (options: PreflightOptions = {}): Promise<boolean> => {
      setIsChecking(true);
      const issues: PreflightIssue[] = [];
      const skip = new Set(options.skip ?? []);
      const minXlm = options.minXlmForFees ?? 1;

      try {
        // ── 1. Network check ─────────────────────────────────────────────
        if (!skip.has("network")) {
          // Refresh network status before checking
          await networkStatus.refresh();

          if (networkStatus.status === "offline") {
            issues.push({
              id: "network-offline",
              severity: "blocker",
              title: "Network Unreachable",
              message:
                "Stellar RPC nodes are currently offline. Transactions cannot be submitted.",
              fixAction: {
                label: "Retry",
                onClick: () => void networkStatus.refresh(),
              },
            });
          } else if (networkStatus.status === "degraded") {
            issues.push({
              id: "network-degraded",
              severity: "warning",
              title: "Network Degraded",
              message: `High latency detected (${networkStatus.latency}ms). Transaction may be slow or time out.`,
            });
          }

          // Horizon specifically offline
          if (networkStatus.horizonHealth.status === "offline") {
            issues.push({
              id: "horizon-offline",
              severity: "blocker",
              title: "Horizon RPC Offline",
              message: `Horizon at ${networkStatus.horizonHealth.url} is unreachable. ${networkStatus.horizonHealth.error || ""}`,
            });
          }

          // Soroban RPC specifically offline
          if (networkStatus.sorobanHealth.status === "offline") {
            issues.push({
              id: "soroban-offline",
              severity: "blocker",
              title: "Soroban RPC Offline",
              message: `Soroban RPC at ${networkStatus.sorobanHealth.url} is unreachable. Smart contract calls will fail.`,
            });
          }
        }

        // ── 2. Wallet check ──────────────────────────────────────────────
        if (!skip.has("wallet")) {
          if (!wallet.address) {
            issues.push({
              id: "wallet-disconnected",
              severity: "blocker",
              title: "Wallet Not Connected",
              message: "Please connect your wallet to proceed.",
            });
          } else {
            // Network mismatch
            const walletNet = formatNetworkName(wallet.network ?? "");
            if (walletNet && walletNet !== appNetwork) {
              issues.push({
                id: "network-mismatch",
                severity: "blocker",
                title: "Network Mismatch",
                message: `Your wallet is on ${walletNet}, but the app expects ${appNetwork}. Switch your wallet network.`,
              });
            }
          }

          if (wallet.connectionError) {
            issues.push({
              id: "wallet-error",
              severity: "blocker",
              title: "Wallet Error",
              message: wallet.connectionError,
              fixAction: {
                label: "Clear & Retry",
                onClick: wallet.clearError,
              },
            });
          }
        }

        // ── 3. Balance check ─────────────────────────────────────────────
        if (!skip.has("balance") && wallet.address) {
          const balances = wallet.balances;

          // Check XLM for fees (keyed as "xlm" in MappedBalances)
          const xlmEntry = balances["xlm"];
          const xlmBalance = xlmEntry ? parseFloat(xlmEntry.balance) : 0;
          if (xlmBalance < minXlm) {
            issues.push({
              id: "xlm-insufficient",
              severity: xlmBalance === 0 ? "blocker" : "warning",
              title: "Low XLM Balance",
              message: `You have ${xlmBalance.toFixed(2)} XLM but need at least ${minXlm} XLM for transaction fees. Add XLM to your wallet.`,
            });
          }

          // Check required token
          if (options.requiredToken && options.requiredAmount) {
            const tokenCode = options.requiredToken.toUpperCase();
            // MappedBalances keys are "xlm" for native or "CODE:ISSUER" for assets
            const matchingKey = Object.keys(balances).find((k) => {
              const upperKey = k.toUpperCase();
              return (
                upperKey === tokenCode || upperKey.startsWith(`${tokenCode}:`)
              );
            });
            const tokenEntry = matchingKey ? balances[matchingKey] : undefined;
            const tokenBal = tokenEntry ? parseFloat(tokenEntry.balance) : 0;
            if (tokenBal < options.requiredAmount) {
              issues.push({
                id: "token-insufficient",
                severity: "blocker",
                title: `Insufficient ${options.requiredToken}`,
                message: `You have ${tokenBal.toFixed(2)} ${options.requiredToken} but need ${options.requiredAmount.toFixed(2)}. Deposit more funds.`,
              });
            }
          }
        }

        // ── 4. Congestion check ──────────────────────────────────────────
        if (!skip.has("congestion")) {
          if (networkStatus.congestion === "high") {
            issues.push({
              id: "high-congestion",
              severity: "warning",
              title: "Network Congested",
              message: `The Stellar network is heavily congested (min fee: ${networkStatus.minFee} stroops). Higher fees may be required and transactions may take longer.`,
            });
          }
        }

        const passed = !issues.some((i) => i.severity === "blocker");
        const result: PreflightResult = {
          passed,
          issues,
          checkedAt: Date.now(),
        };

        setPreflightResult(result);
        return passed;
      } finally {
        setIsChecking(false);
      }
    },
    [networkStatus, wallet],
  );

  return {
    runPreflight,
    preflightResult,
    isChecking,
    /** Clear the preflight result */
    clearPreflight: useCallback(() => setPreflightResult(null), []),
  };
}
