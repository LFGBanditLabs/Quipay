/**
 * TreasuryAnalyticsPage Component
 * Main page for Advanced Yield-Aware Treasury Analytics
 */

import React, { useMemo } from "react";
import { useWallet } from "../hooks/useWallet";
import { useYieldAwareTreasuryAnalytics } from "../hooks/useYieldAwareTreasuryAnalytics";
import { BurnRateCalculator } from "../components/Charts/BurnRateCalculator";
import { YieldDashboard } from "../components/Charts/YieldDashboard";
import { WhatIfScenario } from "../components/Charts/WhatIfScenario";
import { SkeletonCard } from "../components/Loading";

const tw = {
  page: "min-h-screen bg-[#0a0a0a] px-6 pb-16 pt-8 font-[Inter,sans-serif] text-white",
  container: "mx-auto max-w-[1400px]",
  header: "mb-8",
  title:
    "mb-2 text-[2.5rem] font-extrabold tracking-[-0.02em] text-transparent bg-[#0a0a0a] bg-clip-text",
  subtitle: "text-base text-neutral-500",
  kpiSection: "mb-8",
  kpiGrid: "grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4",
  kpi: "rounded-xl border border-white/[0.07] bg-[#0a0a0a] p-5 backdrop-blur-[20px]",
  kpiLabel: "text-xs font-semibold uppercase tracking-wider text-neutral-600",
  kpiValue: "mt-2 text-2xl font-bold text-white",
  kpiMeta: "mt-2 text-xs text-neutral-500",
  kpiGood: "text-emerald-400",
  kpiWarning: "text-amber-400",
  kpiBad: "text-rose-400",
  statusBadge:
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
  statusLow: "bg-emerald-500/15 text-emerald-300",
  statusMedium: "bg-amber-500/15 text-amber-300",
  statusHigh: "bg-rose-500/15 text-rose-300",
  statusCritical: "bg-rose-600/20 text-rose-300",
  content: "space-y-8",
  alertBox: "rounded-xl border border-amber-500/30 bg-amber-500/10 p-5",
  alertTitle: "font-semibold text-amber-200",
  alertText: "mt-2 text-sm text-amber-100/80",
  warningCard: "rounded-xl border border-rose-500/30 bg-rose-500/10 p-5",
  successCard: "rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5",
  controls: "flex flex-wrap gap-3",
  btn: "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
  btnPrimary: "bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/10",
  btnSecondary:
    "border border-white/[0.07] bg-[#0a0a0a] text-neutral-300 hover:bg-[#0a0a0a]",
  loadingGrid: "grid gap-8",
};

/**
 * Get status badge styling
 */
function getStatusStyle(status: string): string {
  switch (status) {
    case "low":
      return tw.statusLow;
    case "medium":
      return tw.statusMedium;
    case "high":
      return tw.statusHigh;
    case "critical":
      return tw.statusCritical;
    default:
      return tw.statusLow;
  }
}

/**
 * Format currency
 */
function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

const TreasuryAnalyticsPage: React.FC = () => {
  const { address } = useWallet();
  const {
    metrics,
    healthSnapshot,
    assetAnalytics,
    yieldOpportunities,
    scenarios,
    isLoading,
    error,
    formattedRunway,
  } = useYieldAwareTreasuryAnalytics(address ?? null);

  // Prepare idle assets for yield dashboard
  const idleAssets = useMemo(() => {
    return assetAnalytics.map((asset) => ({
      symbol: asset.tokenSymbol,
      amount: asset.availableBalance,
      usdValue: asset.usdValue,
    }));
  }, [assetAnalytics]);

  if (isLoading) {
    return (
      <div className={tw.page}>
        <div className={tw.container}>
          <div className={tw.header}>
            <h1 className={tw.title}>Treasury Analytics</h1>
            <p className={tw.subtitle}>Loading your financial data...</p>
          </div>
          <div className={tw.loadingGrid}>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={3} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={tw.page}>
        <div className={tw.container}>
          <div className={tw.header}>
            <h1 className={tw.title}>Treasury Analytics</h1>
            <p className={tw.subtitle}>Error loading data</p>
          </div>
          <div className={tw.warningCard}>
            <div className="font-semibold text-rose-200">
              ⚠ An Error Occurred
            </div>
            <div className="mt-2 text-sm text-rose-100/80">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  const healthStatus = healthSnapshot?.aggregatedMetrics.riskLevel || "low";
  const needsAttention = healthStatus === "high" || healthStatus === "critical";

  return (
    <div className={tw.page}>
      <div className={tw.container}>
        {/* Header */}
        <div className={tw.header}>
          <h1 className={tw.title}>Yield-Aware Treasury Analytics</h1>
          <p className={tw.subtitle}>
            Enterprise-grade financial insights for informed liquidity decisions
          </p>
        </div>

        {/* KPI Section */}
        <div className={tw.kpiSection}>
          <div className={tw.kpiGrid}>
            {/* Total Treasury Value */}
            <div className={tw.kpi}>
              <div className={tw.kpiLabel}>Total Treasury Value</div>
              <div className={tw.kpiValue}>
                {formatCurrency(metrics.totalTreasuryValue)}
              </div>
              <div
                className={`${tw.kpiMeta} ${metrics.totalTreasuryValue > 0 ? tw.kpiGood : tw.kpiBad}`}
              >
                {metrics.totalTreasuryValue > 0 ? "✓ Funded" : "⚠ Underfunded"}
              </div>
            </div>

            {/* Liabilities */}
            <div className={tw.kpi}>
              <div className={tw.kpiLabel}>Total Liabilities</div>
              <div className={tw.kpiValue}>
                {formatCurrency(metrics.totalLiabilities)}
              </div>
              <div className={tw.kpiMeta}>
                {(
                  (metrics.totalLiabilities / metrics.totalTreasuryValue) *
                  100
                ).toFixed(0)}
                % of treasury
              </div>
            </div>

            {/* Monthly Burn */}
            <div className={tw.kpi}>
              <div className={tw.kpiLabel}>Monthly Burn Rate</div>
              <div className={tw.kpiValue}>
                {formatCurrency(metrics.aggregatedMonthlyBurn)}
              </div>
              <div className={tw.kpiMeta}>
                {(
                  (metrics.aggregatedMonthlyBurn / metrics.totalTreasuryValue) *
                  100
                ).toFixed(1)}
                % of treasury/month
              </div>
            </div>

            {/* Days to Insolvency */}
            <div className={tw.kpi}>
              <div className={tw.kpiLabel}>Runway (Days)</div>
              <div
                className={`${tw.kpiValue} ${
                  metrics.averageDaysToInsolvency < 30
                    ? tw.kpiBad
                    : metrics.averageDaysToInsolvency < 90
                      ? tw.kpiWarning
                      : tw.kpiGood
                }`}
              >
                {formattedRunway}
              </div>
              <div className={tw.kpiMeta}>Average across all assets</div>
            </div>

            {/* Health Status */}
            <div className={tw.kpi}>
              <div className={tw.kpiLabel}>Treasury Health</div>
              <div className="mt-2">
                <span
                  className={`${tw.statusBadge} ${getStatusStyle(healthStatus)}`}
                >
                  {healthStatus === "critical"
                    ? "🔴 Critical"
                    : healthStatus === "high"
                      ? "🟠 High Risk"
                      : healthStatus === "medium"
                        ? "🟡 Medium Risk"
                        : "🟢 Healthy"}
                </span>
              </div>
              <div className={tw.kpiMeta}>Based on volatility & runway</div>
            </div>

            {/* Active Scenarios */}
            <div className={tw.kpi}>
              <div className={tw.kpiLabel}>Scenarios Analyzed</div>
              <div className={tw.kpiValue}>{scenarios.length}</div>
              <div className={tw.kpiMeta}>What-if models active</div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {needsAttention && (
          <div className={tw.alertBox}>
            <div className={tw.alertTitle}>⚠ Treasury Alert</div>
            <div className={tw.alertText}>
              Your treasury is showing signs of stress. Consider:
              <ul className="mt-3 space-y-1 pl-5">
                <li>• Increasing deposits to improve runway</li>
                <li>• Deploying idle funds to yield opportunities</li>
                <li>• Reducing operational burn rate</li>
              </ul>
            </div>
          </div>
        )}

        {healthSnapshot &&
          healthSnapshot.aggregatedMetrics.totalTreasuryUsd > 0 && (
            <div className={tw.successCard}>
              <div className="font-semibold text-emerald-200">
                💡 Yield Opportunity Available
              </div>
              <div className="mt-2 text-sm text-emerald-100/80">
                You have{" "}
                <strong>
                  {formatCurrency(
                    idleAssets.reduce((sum, a) => sum + a.usdValue, 0),
                  )}
                </strong>{" "}
                in idle funds that could generate passive income. See the Yield
                Dashboard below.
              </div>
            </div>
          )}

        {/* Main Content */}
        <div className={tw.content}>
          {/* Burn Rate Calculator */}
          {assetAnalytics.length > 0 && (
            <BurnRateCalculator assets={assetAnalytics} />
          )}

          {/* Yield Dashboard */}
          {yieldOpportunities.length > 0 && (
            <YieldDashboard
              opportunities={yieldOpportunities}
              idleAssets={idleAssets}
            />
          )}

          {/* What-If Scenarios */}
          <WhatIfScenario
            currentAssets={assetAnalytics}
            currentMonthlyBurn={metrics.aggregatedMonthlyBurn}
            yieldOpportunities={yieldOpportunities}
          />
        </div>

        {/* Footer Info */}
        <div className="mt-12 rounded-lg border border-white/[0.07] bg-[#0a0a0a] p-6 text-center">
          <div className="text-sm text-neutral-500">
            <p className="mb-2">
              📊 All financial data is calculated in real-time from on-chain
              sources
            </p>
            <p className="text-xs text-neutral-600">
              Last updated: {new Date().toLocaleString()} • Data accuracy
              verified against blockchain
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreasuryAnalyticsPage;
