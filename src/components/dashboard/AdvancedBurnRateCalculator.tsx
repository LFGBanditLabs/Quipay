/**
 * AdvancedBurnRateCalculator Component
 * Displays burn rate analysis and time-to-insolvency calculations for each asset
 */

import React from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { BurnRateData } from "../../types/treasuryAnalytics";

interface AdvancedBurnRateCalculatorProps {
  burnRates: BurnRateData[];
  daysToShow?: number;
}

function generateProjectionData(
  burnRate: BurnRateData,
  daysToShow: number,
): Array<{ day: number; remaining: number }> {
  const data: Array<{ day: number; remaining: number }> = [];
  const dailyBurn = burnRate.dailyBurnRate;
  const initialRemaining = burnRate.runwayDays;

  for (
    let i = 0;
    i < Math.min(daysToShow, Math.ceil(burnRate.runwayDays));
    i += 5
  ) {
    data.push({
      day: i,
      remaining: Math.max(0, initialRemaining - (i * dailyBurn) / 5),
    });
  }

  return data;
}

/**
 * Format runway time for display
 */
function formatRunwayTime(days: number): string {
  if (!isFinite(days)) return "∞ (No burn)";
  if (days < 1) return "< 1 day (Critical)";
  if (days < 30) return `${Math.floor(days)} days`;
  const months = Math.floor(days / 30);
  const remainingDays = Math.floor(days % 30);
  return `${months}m ${remainingDays}d`;
}

/**
 * Get health color based on runway days
 */
function getHealthColor(days: number): string {
  if (days < 7) return "#ef4444"; // red
  if (days < 30) return "#f97316"; // orange
  if (days < 90) return "#eab308"; // yellow
  return "#22c55e"; // green
}

export const AdvancedBurnRateCalculator: React.FC<
  AdvancedBurnRateCalculatorProps
> = ({ burnRates, daysToShow = 90 }) => {
  if (burnRates.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-sm text-white/60">No burn rate data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {burnRates.map((br) => (
          <div
            key={br.token}
            className="rounded-lg border border-white/10 bg-white/5 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">{br.symbol}</h4>
              <span
                className="rounded-full px-2 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: `${getHealthColor(br.runwayDays)}20`,
                  color: getHealthColor(br.runwayDays),
                }}
              >
                {formatRunwayTime(br.runwayDays)}
              </span>
            </div>

            <div className="space-y-2 text-xs text-white/70">
              <div className="flex justify-between">
                <span>Daily Burn:</span>
                <span className="text-white">
                  {br.dailyBurnRate.toFixed(2)} {br.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Monthly Burn:</span>
                <span className="text-white">
                  {br.monthlyBurnRate.toFixed(2)} {br.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Annual Burn:</span>
                <span className="text-white">
                  {br.annualBurnRate.toFixed(2)} {br.symbol}
                </span>
              </div>
              <div className="border-t border-white/10 pt-2">
                <div className="flex justify-between">
                  <span>Time to Insolvency:</span>
                  <span
                    className="font-semibold"
                    style={{ color: getHealthColor(br.runwayDays) }}
                  >
                    {br.timeToInsolvency}
                  </span>
                </div>
              </div>
              {br.trend !== "stable" && (
                <div className="flex justify-between">
                  <span>Trend:</span>
                  <span
                    className={
                      br.trend === "increasing"
                        ? "text-red-400"
                        : "text-green-400"
                    }
                  >
                    {br.trend === "increasing" ? "↑" : "↓"}{" "}
                    {br.trendPercentage.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Charts */}
      {burnRates.map((br) => (
        <div
          key={`chart-${br.token}`}
          className="rounded-lg border border-white/10 bg-white/5 p-6"
        >
          <h4 className="mb-4 text-sm font-semibold text-white">
            {br.symbol} - Runway Projection
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={generateProjectionData(br, daysToShow)}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey="day"
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }}
                axisLine={false}
                tickFormatter={(value: number) =>
                  `${(value / 1000).toFixed(0)}k`
                }
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(17,17,27,0.9)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 12,
                }}
                formatter={(value: number | undefined) => [
                  `${(value ?? 0).toFixed(2)}`,
                  "Available",
                ]}
              />
              <Line
                type="monotone"
                dataKey="remaining"
                stroke={getHealthColor(br.runwayDays)}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>

          <div className="mt-4 rounded-lg bg-white/5 p-3 text-xs text-white/60">
            <p className="mb-2 font-medium text-white">Key Metrics:</p>
            <ul className="space-y-1">
              <li>
                • Daily burn consuming{" "}
                {((br.dailyBurnRate / br.runwayDays) * 100).toFixed(2)}% of
                runway per day
              </li>
              <li>
                • If burn increases 10%: runway drops to{" "}
                {formatRunwayTime(br.runwayDays / 1.1)}
              </li>
              <li>
                • If burn decreases 10%: runway extends to{" "}
                {formatRunwayTime(br.runwayDays / 0.9)}
              </li>
            </ul>
          </div>
        </div>
      ))}

      {/* Multi-Token Burn Comparison */}
      {burnRates.length > 1 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
          <h4 className="mb-4 text-sm font-semibold text-white">
            Multi-Asset Burn Rate Comparison
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={burnRates.map((br) => ({
                symbol: br.symbol,
                daily: br.dailyBurnRate,
                monthly: br.monthlyBurnRate / 30,
              }))}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey="symbol"
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(17,17,27,0.9)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="square" />
              <Bar dataKey="daily" fill="#f87171" name="Daily Burn" />
              <Bar dataKey="monthly" fill="#fb923c" name="Monthly Avg" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
