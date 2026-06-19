/**
 * Treasury Analytics Service
 * Handles burn rate calculations, runway analysis, and scenario projections
 */

import type {
  AssetAnalytics,
  BurnRateHistory,
  ScenarioInput,
  ScenarioResult,
  RiskFactor,
} from "../types/treasuryAnalytics";
import type { TreasuryTokenState } from "../lib/payrollVaultClient";

/**
 * Calculate time-to-insolvency (runway) for an asset
 * @param availableBalance - Balance minus liabilities
 * @param monthlyBurnRate - Amount burned per 30 days
 * @returns Days until insolvency
 */
export function calculateDaysToInsolvency(
  availableBalance: number,
  monthlyBurnRate: number,
): number {
  if (monthlyBurnRate <= 0) return Infinity;
  if (availableBalance <= 0) return 0;
  return (availableBalance * 30) / monthlyBurnRate;
}

/**
 * Estimate monthly burn rate from transaction history
 * In a real implementation, this would analyze actual transaction patterns
 * @param tokenState - Current token state
 * @param burnRateHistory - Historical burn data
 * @returns Estimated monthly burn rate
 */
export function estimateMonthlyBurnRate(
  tokenState: TreasuryTokenState,
  burnRateHistory: BurnRateHistory[],
): number {
  if (burnRateHistory.length === 0) {
    // Fallback: assume liability increases at ~5% per month
    return tokenState.totalLiability * 0.05;
  }

  // Calculate weighted average of recent burn rates
  const recentHistory = burnRateHistory.slice(-3); // Last 3 periods
  if (recentHistory.length === 0) return 0;

  const totalBurn = recentHistory.reduce((sum, h) => sum + h.burnRate, 0);
  const avgBurnPerDay =
    totalBurn / recentHistory.reduce((s, h) => s + h.periodDays, 0);
  return avgBurnPerDay * 30; // Annualize to monthly
}

/**
 * Calculate burn rate trend
 * @param burnRateHistory - Historical data
 * @returns Trend indicator: "increasing", "stable", or "decreasing"
 */
export function calculateBurnRateTrend(
  burnRateHistory: BurnRateHistory[],
): "increasing" | "stable" | "decreasing" {
  if (burnRateHistory.length < 2) return "stable";

  const recent = burnRateHistory.slice(-3);
  if (recent.length < 2) return "stable";

  const ratesPerDay = recent.map((h) => h.burnRate / h.periodDays);
  const avgOldRate = ratesPerDay[0];
  const avgNewRate = ratesPerDay[ratesPerDay.length - 1];

  const changePercent = ((avgNewRate - avgOldRate) / avgOldRate) * 100;

  if (Math.abs(changePercent) < 5) return "stable";
  return changePercent > 0 ? "increasing" : "decreasing";
}

/**
 * Project treasury state forward N months
 * @param currentBalance - Current available balance
 * @param monthlyBurnRate - Monthly burn
 * @param monthsAhead - Projection window
 * @param yieldApy - Optional APY from yield strategy (0-1, e.g., 0.05 for 5%)
 * @returns Projected balance
 */
export function projectTreasuryBalance(
  currentBalance: number,
  monthlyBurnRate: number,
  monthsAhead: number,
  yieldApy: number = 0,
): number {
  if (monthsAhead <= 0) return currentBalance;

  let balance = currentBalance;
  const monthlyYieldRate = yieldApy / 12;

  for (let i = 0; i < monthsAhead; i++) {
    // Apply yield first
    balance = balance * (1 + monthlyYieldRate);
    // Then apply burn
    balance = Math.max(0, balance - monthlyBurnRate);
  }

  return balance;
}

/**
 * Evaluate a what-if scenario
 * @param scenario - Scenario parameters
 * @param currentAssets - Current asset state
 * @param currentBurnRate - Current monthly burn rate
 * @param yieldApy - Yield from deployment (0-1)
 * @returns Scenario result with projections
 */
export function evaluateScenario(
  scenario: ScenarioInput,
  currentAssets: AssetAnalytics[],
  currentBurnRate: number,
  yieldApy: number = 0,
): ScenarioResult {
  const projectionMonths = 12;
  const riskFactors: RiskFactor[] = [];

  // Calculate original metrics
  const totalOriginalUsd = currentAssets.reduce(
    (sum, a) => sum + a.usdValue,
    0,
  );
  const totalOriginalBurn = currentBurnRate;
  const totalOriginalAvailable = currentAssets.reduce(
    (sum, a) => sum + a.availableBalance,
    0,
  );
  const originalDaysToInsolvency = calculateDaysToInsolvency(
    totalOriginalAvailable,
    totalOriginalBurn,
  );

  // Calculate impact of scenario changes
  let ScenarioBurnRateDelta = 0;
  let scenarioDepositDelta = 0;

  // Impact: new workers
  if (scenario.newWorkerCount && scenario.newWorkerPayRate) {
    const hoursPerWeek = scenario.workerHoursPerWeek || 40;
    const weeksPerMonth = 4.33;
    const additionalMonthlyPayout =
      scenario.newWorkerCount *
      scenario.newWorkerPayRate *
      hoursPerWeek *
      weeksPerMonth;
    ScenarioBurnRateDelta += additionalMonthlyPayout;

    riskFactors.push({
      type: "high-burn-increase",
      severity: additionalMonthlyPayout > totalOriginalBurn ? "high" : "medium",
      description: `Adding ${scenario.newWorkerCount} workers increases monthly burn by $${additionalMonthlyPayout.toFixed(2)}`,
    });
  }

  // Impact: additional deposit
  if (scenario.additionalDeposit && scenario.additionalDeposit > 0) {
    scenarioDepositDelta = scenario.additionalDeposit;
  }

  // Projected metrics
  const projectedBurnRate = totalOriginalBurn + ScenarioBurnRateDelta;
  const projectedUsdValue = projectTreasuryBalance(
    totalOriginalUsd + scenarioDepositDelta,
    projectedBurnRate,
    projectionMonths,
    scenario.allocateToYieldOpportunity ? yieldApy : 0,
  );

  const projectedAvailable = Math.max(
    0,
    projectedUsdValue - totalOriginalBurn * projectionMonths,
  );
  const projectedDaysToInsolvency = calculateDaysToInsolvency(
    projectedAvailable,
    projectedBurnRate,
  );

  // Asset volatility check
  const avgAssetVolatility =
    currentAssets.reduce((sum, a) => sum + Math.abs(a.priceChange24h), 0) /
    currentAssets.length;
  if (avgAssetVolatility > 5) {
    riskFactors.push({
      type: "asset-volatility",
      severity: avgAssetVolatility > 10 ? "high" : "medium",
      description: `Average 24h volatility is ${avgAssetVolatility.toFixed(1)}%`,
      mitigation: "Consider diversifying to stablecoins",
    });
  }

  // Runway warning
  if (projectedDaysToInsolvency < 90) {
    riskFactors.push({
      type: "low-runway",
      severity: projectedDaysToInsolvency < 30 ? "high" : "medium",
      description: `Projected runway is ${Math.round(projectedDaysToInsolvency)} days`,
      mitigation: "Consider increasing deposits or reducing burn rate",
    });
  }

  // Yield counterparty risk
  if (scenario.allocateToYieldOpportunity) {
    riskFactors.push({
      type: "yield-counterparty",
      severity: "medium",
      description: "Yield strategy introduces counterparty risk",
      mitigation: "Only use verified protocols; diversify yield sources",
    });
  }

  const isViable = riskFactors.every((f) => f.severity !== "high");

  return {
    scenarioId: scenario.id,
    timestamp: new Date().toISOString(),
    originalDaysToInsolvency,
    originalUsdValue: totalOriginalUsd,
    originalMonthlyBurn: totalOriginalBurn,
    projectedDaysToInsolvency,
    projectedUsdValue,
    projectedMonthlyBurn: projectedBurnRate,
    daysToInsolvencyDelta: projectedDaysToInsolvency - originalDaysToInsolvency,
    usdValueDelta: projectedUsdValue - totalOriginalUsd,
    monthlyBurnDelta: projectedBurnRate - totalOriginalBurn,
    projectionPeriodMonths: projectionMonths,
    projectedYieldGenerated:
      scenario.allocateToYieldOpportunity && scenario.yieldAllocationAmount
        ? (scenario.yieldAllocationAmount *
            (yieldApy / 12) *
            projectionMonths) /
          12
        : 0,
    yieldAsset: scenario.depositAsset || "USDC",
    riskFactors,
    isViable,
  };
}

/**
 * Assess overall treasury health
 * @param assets - Current assets
 * @returns Risk level
 */
export function assessTreasuryHealth(
  assets: AssetAnalytics[],
): "low" | "medium" | "high" | "critical" {
  const avgDaysToInsolvency =
    assets.reduce((sum, a) => sum + a.daysToInsolvency, 0) / assets.length;
  const avgVolatility =
    assets.reduce((sum, a) => sum + Math.abs(a.priceChange24h), 0) /
    assets.length;

  if (avgDaysToInsolvency < 30 || avgVolatility > 15) return "critical";
  if (avgDaysToInsolvency < 90 || avgVolatility > 10) return "high";
  if (avgDaysToInsolvency < 180 || avgVolatility > 5) return "medium";
  return "low";
}

/**
 * Format runway in human-readable format
 * @param daysToInsolvency - Days to insolvency
 * @returns Formatted string
 */
export function formatRunway(daysToInsolvency: number): string {
  if (!Number.isFinite(daysToInsolvency) || daysToInsolvency < 0) {
    return "Unknown";
  }
  if (daysToInsolvency === 0) {
    return "Insolvent";
  }
  const months = Math.floor(daysToInsolvency / 30);
  const days = Math.round(daysToInsolvency % 30);
  if (months > 0) {
    return `${months}m ${days}d`;
  }
  return `${days}d`;
}
