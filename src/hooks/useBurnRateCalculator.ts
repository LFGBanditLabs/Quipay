/**
 * useBurnRateCalculator Hook
 * Calculates burn rates, runway, and time-to-insolvency for treasury assets
 */

import { useMemo } from "react";
import type { BurnRateData } from "../types/treasuryAnalytics";
import type { TokenVaultData } from "../contracts/payroll_vault";

interface BurnRateHistory {
  timestamp: number;
  balance: bigint;
  liability: bigint;
}

interface UseBurnRateCalculatorOptions {
  vaultData: TokenVaultData[];
  history?: BurnRateHistory[];
  decimals?: Record<string, number>;
}

interface UseBurnRateCalculatorResult {
  burnRates: BurnRateData[];
  overallBurnRate: number;
  criticalTokens: string[];
}

/**
 * Calculate burn rate from vault data and optionally historical data
 */
function calculateBurnRate(
  vaultData: TokenVaultData,
  history?: BurnRateHistory[],
  decimals = 7,
): BurnRateData {
  const monthlyBurnRate =
    Number(vaultData.monthlyBurnRate) / Math.pow(10, decimals);
  const dailyBurnRate = monthlyBurnRate / 30;
  const annualBurnRate = monthlyBurnRate * 12;

  const available = Number(vaultData.available) / Math.pow(10, decimals);
  const runwayDays = dailyBurnRate > 0 ? available / dailyBurnRate : Infinity;
  const runwayMonths = runwayDays / 30;

  let timeToInsolvency = "Unknown";
  if (isFinite(runwayDays)) {
    if (runwayDays > 30) {
      timeToInsolvency = `${Math.floor(runwayMonths)} months`;
    } else if (runwayDays > 0) {
      timeToInsolvency = `${Math.floor(runwayDays)} days`;
    } else {
      timeToInsolvency = "Critical";
    }
  }

  // Calculate trend
  let trend: "increasing" | "decreasing" | "stable" = "stable";
  let trendPercentage = 0;

  if (history && history.length >= 2) {
    const oldestRecord = history[0];
    const newestRecord = history[history.length - 1];

    const oldBurn =
      Number(oldestRecord.balance - oldestRecord.liability) /
      Math.pow(10, decimals);
    const newBurn =
      Number(newestRecord.balance - newestRecord.liability) /
      Math.pow(10, decimals);

    trendPercentage = oldBurn > 0 ? ((oldBurn - newBurn) / oldBurn) * 100 : 0;

    if (trendPercentage > 5) {
      trend = "increasing";
    } else if (trendPercentage < -5) {
      trend = "decreasing";
    }
  }

  return {
    token: vaultData.token,
    symbol: vaultData.tokenSymbol,
    dailyBurnRate,
    monthlyBurnRate,
    annualBurnRate,
    runwayDays,
    runwayMonths,
    timeToInsolvency,
    trend,
    trendPercentage: Math.abs(trendPercentage),
  };
}

/**
 * Hook to calculate burn rates for multiple tokens
 */
export function useBurnRateCalculator(
  options: UseBurnRateCalculatorOptions,
): UseBurnRateCalculatorResult {
  const { vaultData, history, decimals: decimalsMap = {} } = options;

  const result = useMemo(() => {
    const burnRates = vaultData.map((vault) => {
      const tokenDecimals = decimalsMap[vault.tokenSymbol] || 7;
      const tokenHistory = history?.filter(
        (h) => h.balance > 0n, // Filter for this token's history
      );
      return calculateBurnRate(vault, tokenHistory, tokenDecimals);
    });

    const overallBurnRate = burnRates.reduce(
      (sum, br) => sum + br.monthlyBurnRate,
      0,
    );

    const criticalTokens = burnRates
      .filter((br) => br.runwayDays < 30)
      .map((br) => br.symbol);

    return {
      burnRates,
      overallBurnRate,
      criticalTokens,
    };
  }, [vaultData, history, decimalsMap]);

  return result;
}
