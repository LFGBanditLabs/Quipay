/**
 * YieldDashboard Component
 * Shows where idle funds could earn interest with risk-adjusted recommendations
 */

import React, { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import { yieldOpportunitiesService } from "../../services/yieldOpportunitiesService";
import type { YieldOpportunity } from "../../types/treasuryAnalytics";

interface YieldDashboardProps {
  opportunities: YieldOpportunity[];
  idleAssets: { symbol: string; amount: number; usdValue: number }[];
}

const tw = {
  container:
    "rounded-2xl border border-indigo-500/15 bg-slate-800/55 p-6 backdrop-blur-[20px]",
  header: "mb-6 flex items-center justify-between gap-4",
  headerText: "flex-1",
  title: "text-lg font-bold text-slate-100",
  subtitle: "text-sm text-slate-400",
  filterBar: "mb-6 flex flex-wrap gap-3",
  filterBtn:
    "relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
  filterBtnInactive:
    "border border-slate-600 bg-slate-900/30 text-slate-400 hover:bg-slate-800/50",
  filterBtnActive:
    "border border-indigo-400/50 bg-indigo-500/20 text-indigo-200",
  grid: "mb-6 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4",
  card: "group rounded-lg border border-indigo-500/10 bg-slate-900/50 p-4 transition-all hover:border-indigo-500/30 hover:bg-slate-900/80",
  cardHeader: "mb-3 flex items-start justify-between gap-2",
  cardTitle: "font-semibold text-slate-100",
  protocolBadge:
    "inline-flex items-center rounded-full bg-indigo-500/15 px-2 py-1 text-xs font-semibold text-indigo-300",
  cardBody: "space-y-2 text-sm",
  metricRow: "flex items-center justify-between gap-2",
  metricLabel: "text-slate-400",
  metricValue: "font-semibold text-slate-100",
  apyValue: "text-lg font-bold text-emerald-400",
  tvlValue: "text-slate-300",
  assetsRow: "flex flex-wrap gap-1",
  assetPill:
    "inline-flex items-center rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300",
  riskIcon: "text-lg",
  riskLow: "text-emerald-400",
  riskMedium: "text-amber-300",
  riskHigh: "text-rose-400",
  requirementsSection: "mt-3 border-t border-slate-700 pt-3",
  requirementText: "text-xs text-slate-400",
  requirementMet: "text-emerald-400",
  requirementUnmet: "text-rose-400",
  chartContainer:
    "mb-6 rounded-lg border border-indigo-500/10 bg-slate-900/50 p-4",
  chartTitle: "mb-4 text-sm font-semibold text-slate-100",
  actionBtn:
    "w-full rounded-lg bg-indigo-500/20 px-3 py-2 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-500/30",
  emptyState:
    "rounded-lg border border-dashed border-slate-600 p-8 text-center",
  emptyIcon: "mb-3 text-4xl",
  emptyText: "text-slate-400",
};

/**
 * Risk level indicator
 */
function RiskIndicator({ level }: { level: "low" | "medium" | "high" }) {
  const icons = { low: "🟢", medium: "🟡", high: "🔴" };
  const className =
    level === "low"
      ? tw.riskLow
      : level === "medium"
        ? tw.riskMedium
        : tw.riskHigh;
  return <span className={`${tw.riskIcon} ${className}`}>{icons[level]}</span>;
}

/**
 * Format APY as percentage
 */
function formatAPY(apy: number): string {
  return `${(apy * 100).toFixed(2)}%`;
}

/**
 * Format TVL value
 */
function formatTVL(tvl: number): string {
  return yieldOpportunitiesService.formatTVL(tvl);
}

export const YieldDashboard: React.FC<YieldDashboardProps> = ({
  opportunities,
  idleAssets,
}) => {
  const [selectedRisk, setSelectedRisk] = useState<
    "all" | "low" | "medium" | "high"
  >("all");
  const [selectedAsset, setSelectedAsset] = useState<string>("all");

  // Filter opportunities
  const filtered = useMemo(() => {
    return opportunities.filter((op) => {
      const riskMatch = selectedRisk === "all" || op.riskLevel === selectedRisk;
      const assetMatch =
        selectedAsset === "all" ||
        op.supportedAssets.some((a) => a === selectedAsset);
      return riskMatch && assetMatch;
    });
  }, [opportunities, selectedRisk, selectedAsset]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return filtered.map((op) => ({
      name: op.name.substring(0, 15),
      apy: op.apy * 100,
      tvl: op.tvl / 1000000, // Convert to millions for chart
      riskValue: { low: 1, medium: 2, high: 3 }[op.riskLevel],
      risk: op.riskLevel,
    }));
  }, [filtered]);

  // Risk-adjusted rankings
  const rankedByRiskAdjusted = useMemo(() => {
    return filtered
      .map((op) => ({
        opportunity: op,
        riskAdjustedReturn: yieldOpportunitiesService.getRiskAdjustedReturn(op),
      }))
      .sort((a, b) => b.riskAdjustedReturn - a.riskAdjustedReturn)
      .slice(0, 5);
  }, [filtered]);

  // Portfolio recommendation
  const portfolioRec = useMemo(() => {
    const totalIdle = idleAssets.reduce((sum, a) => sum + a.usdValue, 0);
    if (totalIdle === 0) return [];
    return yieldOpportunitiesService.recommendPortfolio(totalIdle, "moderate");
  }, [idleAssets]);

  // Estimated yield
  const estimatedMonthlyYield = useMemo(() => {
    return portfolioRec.reduce((sum, rec) => {
      const monthlyYield = (rec.allocation * rec.opportunity.apy) / 12;
      return sum + monthlyYield;
    }, 0);
  }, [portfolioRec]);

  const uniqueAssets = useMemo(
    () => [
      "all",
      ...new Set(opportunities.flatMap((op) => op.supportedAssets)),
    ],
    [opportunities],
  );

  return (
    <div className={tw.container}>
      {/* Header */}
      <div className={tw.header}>
        <div className={tw.headerText}>
          <h2 className={tw.title}>Yield Opportunities</h2>
          <p className={tw.subtitle}>
            Deploy idle funds to generate passive income on Soroban ecosystem
            protocols
          </p>
        </div>
      </div>

      {/* Idle Assets Summary */}
      {idleAssets.length > 0 && (
        <div className="mb-6 rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-4">
          <div className="text-sm font-semibold text-emerald-300">
            💰 Idle Funds Available
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            {idleAssets.map((asset) => (
              <div key={asset.symbol}>
                <div className="text-xs text-slate-400">{asset.symbol}</div>
                <div className="text-lg font-bold text-slate-100">
                  $
                  {asset.usdValue.toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>
            ))}
          </div>
          {estimatedMonthlyYield > 0 && (
            <div className="mt-3 rounded-lg bg-emerald-500/10 p-3">
              <div className="text-xs text-slate-400">
                Estimated Monthly Yield (Conservative Portfolio)
              </div>
              <div className="text-xl font-bold text-emerald-400">
                $
                {estimatedMonthlyYield.toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className={tw.filterBar}>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Risk Level
          </div>
          <div className="flex gap-2">
            {(["all", "low", "medium", "high"] as const).map((risk) => (
              <button
                key={risk}
                onClick={() => setSelectedRisk(risk)}
                className={`${tw.filterBtn} ${selectedRisk === risk ? tw.filterBtnActive : tw.filterBtnInactive}`}
              >
                {risk.charAt(0).toUpperCase() + risk.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Asset
          </div>
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-900/30 px-3 py-2 text-sm text-slate-300 outline-none transition hover:border-slate-500"
          >
            {uniqueAssets.map((asset) => (
              <option key={asset} value={asset}>
                {asset === "all" ? "All Assets" : asset}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Opportunities Grid */}
      {filtered.length === 0 ? (
        <div className={tw.emptyState}>
          <div className={tw.emptyIcon}>📊</div>
          <div className={tw.emptyText}>
            No opportunities match your filters
          </div>
        </div>
      ) : (
        <>
          <div className={tw.grid}>
            {filtered.map((opportunity) => {
              const meetsRequirements =
                yieldOpportunitiesService.meetsRequirements(
                  opportunity.id,
                  idleAssets.reduce((sum, a) => sum + a.usdValue, 0),
                );

              return (
                <div key={opportunity.id} className={tw.card}>
                  <div className={tw.cardHeader}>
                    <div>
                      <div className={tw.cardTitle}>{opportunity.name}</div>
                      <span className={tw.protocolBadge}>
                        {opportunity.protocol}
                      </span>
                    </div>
                    <RiskIndicator level={opportunity.riskLevel} />
                  </div>

                  <div className={tw.cardBody}>
                    <div className={tw.metricRow}>
                      <span className={tw.metricLabel}>APY</span>
                      <span className={tw.apyValue}>
                        {formatAPY(opportunity.apy)}
                      </span>
                    </div>

                    <div className={tw.metricRow}>
                      <span className={tw.metricLabel}>TVL</span>
                      <span className={tw.tvlValue}>
                        {formatTVL(opportunity.tvl)}
                      </span>
                    </div>

                    {Number(opportunity.lockupPeriod) > 0 && (
                      <div className={tw.metricRow}>
                        <span className={tw.metricLabel}>Lockup</span>
                        <span className={tw.metricValue}>
                          {typeof opportunity.lockupPeriod === "number"
                            ? `${opportunity.lockupPeriod} days`
                            : opportunity.lockupPeriod}
                        </span>
                      </div>
                    )}

                    <div>
                      <span className={tw.metricLabel}>Assets</span>
                      <div className={tw.assetsRow}>
                        {opportunity.supportedAssets.map((asset) => (
                          <span key={asset} className={tw.assetPill}>
                            {asset}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className={tw.requirementsSection}>
                      <div
                        className={
                          meetsRequirements.meets
                            ? tw.requirementMet
                            : tw.requirementUnmet
                        }
                      >
                        {meetsRequirements.meets
                          ? "✓ Meets minimum requirements"
                          : `⚠ ${meetsRequirements.reason}`}
                      </div>

                      {opportunity.verified && (
                        <div className="mt-2 text-xs text-emerald-400">
                          ✓ Security audited
                        </div>
                      )}

                      {!opportunity.verified && (
                        <div className="mt-2 text-xs text-amber-400">
                          ⚠ Not yet audited - Higher risk
                        </div>
                      )}
                    </div>
                  </div>

                  <button className={tw.actionBtn}>
                    {opportunity.url ? "Learn More" : "Coming Soon"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Charts */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* APY vs TVL Scatter */}
            {chartData.length > 0 && (
              <div className={tw.chartContainer}>
                <h3 className={tw.chartTitle}>Risk-Return Profile</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid #475569",
                        borderRadius: "8px",
                      }}
                    />
                    <XAxis
                      type="number"
                      dataKey="tvl"
                      name="TVL ($M)"
                      stroke="#cbd5e1"
                    />
                    <YAxis
                      type="number"
                      dataKey="apy"
                      name="APY (%)"
                      stroke="#cbd5e1"
                    />
                    <Scatter
                      name="Opportunities"
                      data={chartData}
                      fill="#6366f1"
                      fillOpacity={0.6}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top Opportunities by Risk-Adjusted Return */}
            {rankedByRiskAdjusted.length > 0 && (
              <div className={tw.chartContainer}>
                <h3 className={tw.chartTitle}>
                  Top Risk-Adjusted Opportunities
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={rankedByRiskAdjusted.slice(0, 5).map((rec) => ({
                      name: rec.opportunity.name.substring(0, 12),
                      return: Number((rec.riskAdjustedReturn * 100).toFixed(1)),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid #475569",
                        borderRadius: "8px",
                      }}
                    />
                    <XAxis dataKey="name" stroke="#cbd5e1" />
                    <YAxis stroke="#cbd5e1" />
                    <Bar
                      dataKey="return"
                      fill="#10b981"
                      name="Risk-Adj Return (%)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
