/**
 * useYieldAwareTreasuryAnalytics Hook
 * Integrates all treasury analytics services and provides comprehensive data
 */

import { useEffect, useMemo, useState } from "react";
import {
  payrollVaultClient,
  type TreasuryTokenState,
} from "../lib/payrollVaultClient";
import { priceFeedService } from "../services/priceFeedService";
import { yieldOpportunitiesService } from "../services/yieldOpportunitiesService";
import {
  calculateDaysToInsolvency,
  estimateMonthlyBurnRate,
  assessTreasuryHealth,
  evaluateScenario,
  formatRunway,
} from "../services/treasuryAnalyticsService";
import type {
  AssetAnalytics,
  BurnRateHistory,
  YieldOpportunity,
  TreasuryHealthSnapshot,
  ScenarioInput,
  ScenarioResult,
  PriceFeedConfig,
} from "../types/treasuryAnalytics";

/**
 * Mock burn rate history for demo purposes
 * In production, this would come from on-chain data
 */
function generatMockBurnRateHistory(): BurnRateHistory[] {
  const today = new Date();
  const history: BurnRateHistory[] = [];

  for (let i = 11; i >= 0; i--) {
    const date = new Date(today);
    date.setMonth(date.getMonth() - i);

    history.push({
      date: date.toISOString().split("T")[0],
      burnRate: 5000 + Math.random() * 2000, // 5-7k per month
      periodDays: 30,
      activeWorkers: Math.floor(10 + Math.random() * 5), // 10-15 workers
    });
  }

  return history;
}

function generateMockTreasuryHistory(): { date: string; balance: number }[] {
  const today = new Date();
  const history: { date: string; balance: number }[] = [];
  let balance = 100000;

  for (let i = 11; i >= 0; i--) {
    const date = new Date(today);
    date.setMonth(date.getMonth() - i);

    balance -= 5000 + Math.random() * 2000; // Decrease by burn rate
    history.push({
      date: date.toISOString().split("T")[0],
      balance: Math.max(0, balance),
    });
  }

  return history;
}

export function useYieldAwareTreasuryAnalytics(
  employerAddress: string | null,
  priceConfig?: PriceFeedConfig,
) {
  const [treasuryState, setTreasuryState] = useState<TreasuryTokenState[]>([]);
  const [assetAnalytics, setAssetAnalytics] = useState<AssetAnalytics[]>([]);
  const [yieldOpportunities, setYieldOpportunities] = useState<
    YieldOpportunity[]
  >([]);
  const [scenarios, setScenarios] = useState<ScenarioResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock data
  const burnRateHistory = useMemo(() => generatMockBurnRateHistory(), []);
  const treasuryHistory = useMemo(() => generateMockTreasuryHistory(), []);

  // Load treasury state and compute analytics
  useEffect(() => {
    async function loadAnalytics() {
      if (!employerAddress) return;

      try {
        setIsLoading(true);
        setError(null);

        // Get treasury state
        const store =
          await payrollVaultClient.getTreasuryState(employerAddress);
        setTreasuryState(store.tokenState);

        // Compute asset analytics with price data
        const analytics: AssetAnalytics[] = await Promise.all(
          store.tokenState.map(async (token) => {
            const priceData = await priceFeedService.getPrice(
              token.tokenSymbol,
              priceConfig,
            );
            const price = priceData?.price ?? 1;
            const change24h = priceFeedService.getPriceChange24h(
              token.tokenSymbol,
            );

            const availableBalance =
              token.treasuryBalance - token.totalLiability;
            const monthlyBurn = estimateMonthlyBurnRate(token, burnRateHistory);
            const daysToInsolvency = calculateDaysToInsolvency(
              availableBalance,
              monthlyBurn,
            );

            return {
              tokenSymbol: token.tokenSymbol,
              treasuryBalance: token.treasuryBalance,
              totalLiability: token.totalLiability,
              availableBalance,
              monthlyBurnRate: monthlyBurn,
              daysToInsolvency,
              usdValue: availableBalance * price,
              priceInUsd: price,
              priceChange24h: change24h,
              burnRateHistory,
            };
          }),
        );

        setAssetAnalytics(analytics);

        // Get yield opportunities
        const allOpportunities = yieldOpportunitiesService.getOpportunities();
        setYieldOpportunities(allOpportunities);
      } catch (err) {
        console.error("Failed to load treasury analytics:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }

    void loadAnalytics();
  }, [employerAddress, priceConfig, burnRateHistory]);

  // Health snapshot
  const healthSnapshot = useMemo<TreasuryHealthSnapshot | null>(() => {
    if (assetAnalytics.length === 0) return null;

    const totalUsd = assetAnalytics.reduce((sum, a) => sum + a.usdValue, 0);
    const totalLiabilityUsd = assetAnalytics.reduce(
      (sum, a) => sum + a.totalLiability * a.priceInUsd,
      0,
    );
    const aggregatedBurn = assetAnalytics.reduce(
      (sum, a) => sum + a.monthlyBurnRate,
      0,
    );
    const weightedRunway =
      assetAnalytics.reduce(
        (sum, a) =>
          sum +
          a.daysToInsolvency *
            (a.usdValue / totalUsd) *
            (totalUsd === 0 ? 0 : 1),
        0,
      ) / (totalUsd === 0 ? 1 : 1);

    return {
      timestamp: new Date().toISOString(),
      assets: assetAnalytics,
      aggregatedMetrics: {
        totalTreasuryUsd: totalUsd,
        totalLiabilityUsd,
        aggregatedMonthlyBurn: aggregatedBurn,
        weightedAverageDaysToInsolvency: weightedRunway,
        riskLevel: assessTreasuryHealth(assetAnalytics),
      },
      yieldOpportunities,
      activeScenarios: scenarios,
    };
  }, [assetAnalytics, yieldOpportunities, scenarios]);

  // Key metrics
  const metrics = useMemo(
    () => ({
      totalTreasuryValue: assetAnalytics.reduce(
        (sum, a) => sum + a.usdValue,
        0,
      ),
      totalLiabilities: assetAnalytics.reduce(
        (sum, a) => sum + a.totalLiability,
        0,
      ),
      aggregatedMonthlyBurn: assetAnalytics.reduce(
        (sum, a) => sum + a.monthlyBurnRate,
        0,
      ),
      averageDaysToInsolvency: assetAnalytics.length
        ? assetAnalytics.reduce((sum, a) => sum + a.daysToInsolvency, 0) /
          assetAnalytics.length
        : Infinity,
      healthStatus: healthSnapshot?.aggregatedMetrics.riskLevel || "low",
    }),
    [assetAnalytics, healthSnapshot],
  );

  // Run a scenario analysis
  function runScenario(input: ScenarioInput): ScenarioResult {
    const result = evaluateScenario(
      input,
      assetAnalytics,
      metrics.aggregatedMonthlyBurn,
      0.05,
    );
    setScenarios((prev) => [...prev, result]);
    return result;
  }

  // Clear a scenario
  function clearScenario(scenarioId: string): void {
    setScenarios((prev) => prev.filter((s) => s.scenarioId !== scenarioId));
  }

  return {
    // Data
    treasuryState,
    assetAnalytics,
    yieldOpportunities,
    scenarios,
    healthSnapshot,
    burnRateHistory,
    treasuryHistory,

    // Metrics
    metrics,

    // Derived data
    formattedRunway: formatRunway(metrics.averageDaysToInsolvency),

    // State
    isLoading,
    error,

    // Actions
    runScenario,
    clearScenario,
    refreshData: () => {
      // Trigger reload by clearing state
      setTreasuryState([]);
      setAssetAnalytics([]);
    },
  };
}
