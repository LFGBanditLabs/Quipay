/**
 * useTreasuryAlerts.ts
 * ────────────────────
 * Monitors treasury balances periodically and pushes alerts to the
 * NotificationCenter when balances cross critical thresholds.
 *
 * Thresholds:
 *   - Below 10% of initial deposit → warning
 *   - Below 5%  of initial deposit → critical
 *   - Below 1%  of initial deposit → critical (imminent depletion)
 */

import { useEffect, useRef, useCallback } from "react";
import { useWallet } from "./useWallet";
import { alertStore } from "../components/NotificationCenter";

interface TreasurySnapshot {
  tokenSymbol: string;
  balance: number;
  liability: number;
}

const POLL_INTERVAL = 60_000; // 1 minute
const FIRED_KEY_PREFIX = "quipay_treasury_alert_fired_";

/**
 * Tracks which threshold alerts have already fired this session
 * to avoid spamming the notification center.
 */
function getAlertFiredKey(token: string, threshold: number) {
  return `${FIRED_KEY_PREFIX}${token}_${threshold}`;
}

function hasAlertFired(token: string, threshold: number): boolean {
  try {
    return sessionStorage.getItem(getAlertFiredKey(token, threshold)) === "1";
  } catch {
    return false;
  }
}

function markAlertFired(token: string, threshold: number) {
  try {
    sessionStorage.setItem(getAlertFiredKey(token, threshold), "1");
  } catch {
    // sessionStorage unavailable
  }
}

/**
 * Attempts to fetch treasury state from the payroll vault client.
 * Falls back gracefully if the vault isn't configured.
 */
async function fetchTreasurySnapshots(): Promise<TreasurySnapshot[]> {
  try {
    // Dynamic import to avoid circular dependencies
    const { payrollVaultClient } = await import("../lib/payrollVaultClient");
    const employerAddress = localStorage.getItem("walletAddress") || "";
    if (!employerAddress) return [];

    const state = await payrollVaultClient.getTreasuryState(employerAddress);
    return state.tokenState.map((t) => ({
      tokenSymbol: t.tokenSymbol,
      balance: t.treasuryBalance,
      liability: t.totalLiability,
    }));
  } catch {
    return [];
  }
}

export function useTreasuryAlerts() {
  const { address } = useWallet();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const checkBalances = useCallback(async () => {
    if (!address) return;

    const snapshots = await fetchTreasurySnapshots();

    for (const snap of snapshots) {
      const { tokenSymbol, balance, liability } = snap;

      // Skip tokens with no liability (nothing to pay out)
      if (liability <= 0) continue;

      // Calculate what % of the total required (liability) is available
      const ratio = balance / liability;

      // Check thresholds from most severe to least
      if (ratio <= 0.01 && !hasAlertFired(tokenSymbol, 1)) {
        alertStore.addAlert({
          title: `${tokenSymbol} Treasury Nearly Empty`,
          message: `Treasury ${tokenSymbol} balance is at ${(ratio * 100).toFixed(1)}% of outstanding liabilities. Streams will fail imminently. Deposit funds now.`,
          severity: "critical",
          category: "treasury",
          action: {
            label: "Go to Treasury",
            onClick: () => {
              window.location.hash = "";
              window.location.pathname = "/treasury-management";
            },
          },
        });
        markAlertFired(tokenSymbol, 1);
      } else if (ratio <= 0.05 && !hasAlertFired(tokenSymbol, 5)) {
        alertStore.addAlert({
          title: `${tokenSymbol} Balance Critical`,
          message: `Treasury ${tokenSymbol} is at ${(ratio * 100).toFixed(1)}% of liabilities. Deposit more ${tokenSymbol} to avoid failed payroll streams.`,
          severity: "critical",
          category: "treasury",
          action: {
            label: "Deposit Funds",
            onClick: () => {
              window.location.pathname = "/treasury-management";
            },
          },
        });
        markAlertFired(tokenSymbol, 5);
      } else if (ratio <= 0.1 && !hasAlertFired(tokenSymbol, 10)) {
        alertStore.addAlert({
          title: `${tokenSymbol} Treasury Reaching 10%`,
          message: `Treasury ${tokenSymbol} balance has dropped to ${(ratio * 100).toFixed(1)}% of outstanding liabilities. Consider topping up.`,
          severity: "warning",
          category: "treasury",
          action: {
            label: "View Treasury",
            onClick: () => {
              window.location.pathname = "/treasury-management";
            },
          },
        });
        markAlertFired(tokenSymbol, 10);
      }
    }
  }, [address]);

  useEffect(() => {
    if (!address) return;

    // Initial check after a short delay to let the app hydrate
    const timeout = setTimeout(() => void checkBalances(), 5000);

    // Periodic checks
    intervalRef.current = setInterval(() => {
      void checkBalances();
    }, POLL_INTERVAL);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [address, checkBalances]);
}
