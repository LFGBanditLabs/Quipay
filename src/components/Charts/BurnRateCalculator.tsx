/**
 * BurnRateCalculator Component
 * Displays time-to-insolvency for each asset with trend analysis
 */

import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import type {
  AssetAnalytics,
  BurnRateHistory,
} from "../../types/treasuryAnalytics";

interface BurnRateCalculatorProps {
  assets: AssetAnalytics[];
}

const tw = {
  container:
    "rounded-2xl border border-indigo-500/15 bg-slate-800/55 p-6 backdrop-blur-[20px]",
  header: "mb-6 flex items-center justify-between gap-4",
  title: "text-lg font-bold text-slate-100",
  subtitle: "text-sm text-slate-400",
  grid: "mb-6 grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4",
  card: "rounded-lg border border-indigo-500/10 bg-slate-900/50 p-4",
  cardLabel: "text-xs font-semibold uppercase tracking-wide text-slate-500",
  cardValue: "mt-2 text-2xl font-bold",
  cardMeta: "mt-2 text-xs text-slate-400",
  runwayBad: "text-rose-400",
  runwayWarning: "text-amber-300",
  runwayGood: "text-emerald-400",
  trendsContainer: "mb-6",
  chartsGrid: "grid grid-cols-1 gap-4 md:grid-cols-2",
  chart: "rounded-lg border border-indigo-500/10 bg-slate-900/50 p-4",
  chartTitle: "mb-4 text-sm font-semibold text-slate-100",
  trendBadge:
    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
  trendUp: "bg-rose-500/15 text-rose-300",
  trendStable: "bg-slate-500/15 text-slate-300",
  trendDown: "bg-emerald-500/15 text-emerald-300",
};

/**
 * Format runway into readable duration
 */
function formatRunway(days: number): string {
  if (!Number.isFinite(days)) return "N/A";
  if (days <= 0) return "Insolvent";
  const months = Math.floor(days / 30);
  const remainingDays = Math.round(days % 30);
  if (months > 0) {
    return `${months}m ${remainingDays}d`;
  }
  return `${remainingDays}d`;
}

/**
 * Get runway color based on days
 */
function getRunwayColor(days: number): string {
  if (days < 30) return tw.runwayBad;
  if (days < 90) return tw.runwayWarning;
  return tw.runwayGood;
}

/**
 * Calculate burn rate trend
 */
function calculateTrend(history: BurnRateHistory[]): "up" | "stable" | "down" {
  if (history.length < 2) return "stable";
  const recent = history.slice(-3);
  const ratesPerDay = recent.map((h) => h.burnRate / h.periodDays);
  const avgOldRate = ratesPerDay[0];
  const avgNewRate = ratesPerDay[ratesPerDay.length - 1];
  const changePercent = ((avgNewRate - avgOldRate) / avgOldRate) * 100;

  if (Math.abs(changePercent) < 5) return "stable";
  return changePercent > 0 ? "up" : "down";
}

/**
 * Prepare burn rate chart data
 */
function prepareBurnRateChartData(history: BurnRateHistory[]) {
  return history.map((h) => ({
    date: new Date(h.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    burnRate: h.burnRate,
    activeWorkers: h.activeWorkers,
    avgBurnPerDay: h.burnRate / h.periodDays,
  }));
}

/**
 * Prepare runway projection data
 */
function prepareRunwayProjection(asset: AssetAnalytics) {
  const data = [];
  let remainingBalance = asset.availableBalance;

  for (let month = 0; month <= 12; month++) {
    data.push({
      month: `M${month}`,
      balance: Math.max(0, remainingBalance),
      runway: Math.max(0, (remainingBalance * 30) / asset.monthlyBurnRate),
    });
    remainingBalance -= asset.monthlyBurnRate;
  }

  return data;
}

export const BurnRateCalculator: React.FC<BurnRateCalculatorProps> = ({
  assets,
}) => {
  const chartDataMultiple = useMemo(() => {
    return assets.map((asset) => ({
      tokenSymbol: asset.tokenSymbol,
      data: prepareBurnRateChartData(asset.burnRateHistory),
      projectionData: prepareRunwayProjection(asset),
      trend: calculateTrend(asset.burnRateHistory),
    }));
  }, [assets]);

  const aggregatedMetrics = useMemo(() => {
    return {
      avgBurnRate:
        assets.reduce((sum, a) => sum + a.monthlyBurnRate, 0) / assets.length,
      avgRunway:
        assets.reduce((sum, a) => sum + a.daysToInsolvency, 0) / assets.length,
      totalBurnRate: assets.reduce((sum, a) => sum + a.monthlyBurnRate, 0),
      lowestRunway: Math.min(...assets.map((a) => a.daysToInsolvency)),
    };
  }, [assets]);

  return (
    <div className={tw.container}>
      {/* Header */}
      <div className={tw.header}>
        <div>
          <h2 className={tw.title}>Burn Rate Analysis</h2>
          <p className={tw.subtitle}>
            Time-to-insolvency projections and burn rate trends
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className={tw.grid}>
        {assets.map((asset) => {
          const trend = calculateTrend(asset.burnRateHistory);
          const trendClass =
            trend === "up"
              ? tw.trendUp
              : trend === "down"
                ? tw.trendDown
                : tw.trendStable;

          return (
            <div key={asset.tokenSymbol} className={tw.card}>
              <div className={tw.cardLabel}>{asset.tokenSymbol}</div>
              <div className={tw.cardValue}>
                <span className={getRunwayColor(asset.daysToInsolvency)}>
                  {formatRunway(asset.daysToInsolvency)}
                </span>
              </div>
              <div className={tw.cardMeta}>
                <div className="mb-2">
                  Monthly burn: $
                  {asset.monthlyBurnRate.toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Trend:</span>
                  <span className={`${tw.trendBadge} ${trendClass}`}>
                    {trend === "up"
                      ? "↑ Increasing"
                      : trend === "down"
                        ? "↓ Decreasing"
                        : "→ Stable"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className={tw.chartsGrid}>
        {/* Burn Rate Trend */}
        {chartDataMultiple[0] && (
          <div className={tw.chart}>
            <h3 className={tw.chartTitle}>
              {chartDataMultiple[0].tokenSymbol} Monthly Burn Rate
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartDataMultiple[0].data}>
                <defs>
                  <linearGradient id="colorBurn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "8px",
                  }}
                />
                <XAxis dataKey="date" stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" />
                <Area
                  type="monotone"
                  dataKey="burnRate"
                  stroke="#ef4444"
                  fillOpacity={1}
                  fill="url(#colorBurn)"
                  name="Monthly Burn"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Runway Projection */}
        {chartDataMultiple[0] && (
          <div className={tw.chart}>
            <h3 className={tw.chartTitle}>
              {chartDataMultiple[0].tokenSymbol} Runway Projection
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartDataMultiple[0].projectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "8px",
                  }}
                />
                <XAxis dataKey="month" stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="runway"
                  stroke="#6366f1"
                  name="Days of Runway"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Aggregated View */}
        {assets.length > 1 && (
          <div className={tw.chart}>
            <h3 className={tw.chartTitle}>Multi-Asset Burn Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={assets.map((a) => ({
                  name: a.tokenSymbol,
                  burnRate: a.monthlyBurnRate,
                  runway: a.daysToInsolvency,
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
                <Legend />
                <Bar
                  dataKey="burnRate"
                  fill="#ef4444"
                  name="Monthly Burn ($)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Key Insights Card */}
        <div className={tw.chart}>
          <h3 className={tw.chartTitle}>Key Insights</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-indigo-400">•</span>
              <div>
                <div className="font-semibold text-slate-100">
                  Aggregate Monthly Burn
                </div>
                <div className="text-slate-400">
                  $
                  {aggregatedMetrics.totalBurnRate.toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-indigo-400">•</span>
              <div>
                <div className="font-semibold text-slate-100">
                  Critical Runway
                </div>
                <div
                  className={`${getRunwayColor(aggregatedMetrics.lowestRunway)} font-medium`}
                >
                  {formatRunway(aggregatedMetrics.lowestRunway)}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-indigo-400">•</span>
              <div>
                <div className="font-semibold text-slate-100">
                  Average Runway
                </div>
                <div className="text-slate-400">
                  {formatRunway(aggregatedMetrics.avgRunway)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
