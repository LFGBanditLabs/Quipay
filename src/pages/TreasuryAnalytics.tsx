/**
 * TreasuryAnalyticsPage Component
 * Main page for advanced multi-token yield-aware treasury analytics
 */

import React, { useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { usePriceFeed } from "../hooks/usePriceFeed";
import { useBurnRateCalculator } from "../hooks/useBurnRateCalculator";
import { useYieldOpportunities } from "../hooks/useYieldOpportunities";
import { AdvancedBurnRateCalculator } from "../components/dashboard/AdvancedBurnRateCalculator";
import { MultiAssetYieldDashboard } from "../components/dashboard/MultiAssetYieldDashboard";
import { WhatIfScenarios } from "../components/dashboard/WhatIfScenarios";
import type {
  WhatIfScenario,
  YieldOpportunity,
  TreasuryAnalyticsSummary,
  BurnRateData,
  PriceData,
} from "../types/treasuryAnalytics";
import type { TokenVaultData } from "../contracts/payroll_vault";

interface TreasuryAnalyticsPageProps {
  vaultData?: TokenVaultData[];
  loading?: boolean;
  onError?: (error: string) => void;
}

/**
 * Calculate overall treasury health score
 */
function calculateHealthScore(
  vaultData: TokenVaultData[],
  burnRates: BurnRateData[],
): number {
  if (vaultData.length === 0) return 0;

  const criticalCount = burnRates.filter((br) => br.runwayDays < 7).length;
  const averageRunway =
    burnRates.reduce((sum, br) => sum + (br.runwayDays || 0), 0) /
    burnRates.length;

  let score = 100;
  score -= criticalCount * 30; // -30 points per critical asset
  score -= Math.max(0, (90 - averageRunway) / 2); // Decrease based on low runway

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate treasury summary
 */
function generateTreasurySummary(
  vaultData: TokenVaultData[],
  burnRates: BurnRateData[],
  opportunities: YieldOpportunity[],
  priceData: Record<string, PriceData | undefined>,
): TreasuryAnalyticsSummary {
  const totalValueUSD = vaultData.reduce((sum, vault) => {
    const price = priceData[vault.tokenSymbol]?.usdPrice || 1;
    const balance = Number(vault.balance) / Math.pow(10, 7);
    return sum + balance * price;
  }, 0);

  const totalLiabilities = vaultData.reduce((sum, vault) => {
    const price = priceData[vault.tokenSymbol]?.usdPrice || 1;
    const liability = Number(vault.liability) / Math.pow(10, 7);
    return sum + liability * price;
  }, 0);

  const availableFundsUSD = totalValueUSD - totalLiabilities;
  const averageRunway =
    burnRates.reduce((sum, br) => sum + br.runwayDays, 0) /
    (burnRates.length || 1);
  const averageBurnRate =
    burnRates.reduce((sum, br) => sum + br.monthlyBurnRate, 0) /
    (burnRates.length || 1);

  const recommendedActions: string[] = [];
  const criticalTokens = burnRates.filter((br) => br.runwayDays < 30);

  if (criticalTokens.length > 0) {
    recommendedActions.push(
      `Review ${criticalTokens.length} asset(s) with critical runway`,
    );
  }

  if (opportunities.length > 0) {
    recommendedActions.push(
      `Allocate idle funds to yield opportunities (${opportunities.length} found)`,
    );
  }

  if (totalLiabilities / totalValueUSD > 0.8) {
    recommendedActions.push(
      "High liability-to-balance ratio - consider fundraising",
    );
  }

  let riskLevel: "low" | "medium" | "high" = "low";
  if (averageRunway < 30) riskLevel = "high";
  else if (averageRunway < 90) riskLevel = "medium";

  const healthScore = calculateHealthScore(vaultData, burnRates);

  return {
    totalValueUSD,
    totalLiabilities,
    availableFundsUSD,
    overallRunwayDays: Math.floor(averageRunway),
    healthScore,
    averageBurnRate,
    recommendedActions,
    riskLevel,
  };
}

export const TreasuryAnalyticsPage: React.FC<TreasuryAnalyticsPageProps> = ({
  vaultData = [],
  loading = false,
  onError,
}) => {
  const { address } = useWallet();
  const [scenarios, setScenarios] = useState<WhatIfScenario[]>([]);
  const [selectedTab, setSelectedTab] = useState<
    "overview" | "burn-rate" | "yield" | "scenarios"
  >("overview");

  // Get supported tokens
  const tokenSymbols = vaultData.map((v) => v.tokenSymbol);

  // Price feeds
  const { prices, error: pricesError } = usePriceFeed({
    symbols: tokenSymbols,
    updateInterval: 60000,
    enabled: tokenSymbols.length > 0,
  });

  if (pricesError) {
    onError?.(pricesError);
  }

  // Burn rate calculations
  const { burnRates } = useBurnRateCalculator({
    vaultData,
    decimals: Object.fromEntries(tokenSymbols.map((symbol) => [symbol, 7])),
  });

  // Yield opportunities
  const { opportunities, totalPotentialYield } = useYieldOpportunities({
    vaultData,
    priceData: prices,
    minIdleFundsUSD: 5000,
  });

  const summary = generateTreasurySummary(
    vaultData,
    burnRates,
    opportunities,
    prices,
  );

  const handleScenarioCreate = (scenario: WhatIfScenario) => {
    setScenarios([...scenarios, scenario]);
  };

  const handleScenarioUpdate = (scenario: WhatIfScenario) => {
    setScenarios(scenarios.map((s) => (s.id === scenario.id ? scenario : s)));
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-white/10 bg-white/5">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white"></div>
          <p className="text-sm text-white/60">Loading treasury data...</p>
        </div>
      </div>
    );
  }

  if (vaultData.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-12 text-center">
        <div className="mb-4 text-4xl">📊</div>
        <p className="text-lg font-medium text-white">No Treasury Data</p>
        <p className="mt-2 text-sm text-white/60">
          Treasury data will appear here once you have connected your wallet and{" "}
          {address ? "have vault data." : "connected to a vault."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-medium text-white/70">Total Value</p>
          <p className="mt-2 text-2xl font-bold text-white">
            $
            {summary.totalValueUSD.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-medium text-white/70">Available Funds</p>
          <p className="mt-2 text-2xl font-bold text-emerald-400">
            $
            {summary.availableFundsUSD.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-medium text-white/70">Avg Runway</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {summary.overallRunwayDays} days
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-medium text-white/70">Health Score</p>
          <p
            className="mt-2 text-2xl font-bold"
            style={{
              color:
                summary.healthScore >= 70
                  ? "#22c55e"
                  : summary.healthScore >= 40
                    ? "#eab308"
                    : "#ef4444",
            }}
          >
            {summary.healthScore.toFixed(0)}/100
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-medium text-white/70">Monthly Burn</p>
          <p className="mt-2 text-2xl font-bold text-red-400">
            $
            {summary.averageBurnRate.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </p>
        </div>
      </div>

      {/* Recommendations */}
      {summary.recommendedActions.length > 0 && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
          <p className="mb-2 font-semibold text-blue-300">💡 Recommendations</p>
          <ul className="space-y-1 text-sm text-white/70">
            {summary.recommendedActions.map((action, idx) => (
              <li key={idx}>• {action}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {[
          { id: "overview", label: "Overview" },
          { id: "burn-rate", label: "Burn Rate Analysis" },
          { id: "yield", label: "Yield Opportunities" },
          { id: "scenarios", label: "What-If Scenarios" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() =>
              setSelectedTab(
                tab.id as "overview" | "burn-rate" | "yield" | "scenarios",
              )
            }
            className={`px-4 py-2 text-sm font-medium transition ${
              selectedTab === tab.id
                ? "border-b-2 border-blue-500 text-white"
                : "text-white/60 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {selectedTab === "overview" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Assets</h3>
            <div className="space-y-2">
              {vaultData.map((vault) => (
                <div
                  key={vault.token}
                  className="flex items-center justify-between rounded-lg bg-white/5 p-3"
                >
                  <div>
                    <p className="font-medium text-white">
                      {vault.tokenSymbol}
                    </p>
                    <p className="text-xs text-white/60">
                      {(Number(vault.balance) / Math.pow(10, 7)).toFixed(2)}{" "}
                      available
                    </p>
                  </div>
                  <span className="text-sm text-white/70">
                    Running{" "}
                    {
                      burnRates.find((br) => br.symbol === vault.tokenSymbol)
                        ?.timeToInsolvency
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>

          {opportunities.length > 0 && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="mb-2 text-sm font-semibold text-emerald-300">
                💰 $
                {totalPotentialYield.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
                /month Potential Yield
              </p>
              <p className="text-xs text-white/70">
                Found {opportunities.length} yield opportunities across{" "}
                {new Set(opportunities.map((o) => o.protocol)).size} protocol(s)
              </p>
            </div>
          )}
        </div>
      )}

      {selectedTab === "burn-rate" && (
        <AdvancedBurnRateCalculator burnRates={burnRates} daysToShow={90} />
      )}

      {selectedTab === "yield" && (
        <MultiAssetYieldDashboard
          opportunities={opportunities}
          totalPotentialYield={totalPotentialYield}
        />
      )}

      {selectedTab === "scenarios" && (
        <WhatIfScenarios
          currentScenarios={scenarios}
          onScenarioCreate={handleScenarioCreate}
          onScenarioUpdate={handleScenarioUpdate}
        />
      )}
    </div>
  );
};
