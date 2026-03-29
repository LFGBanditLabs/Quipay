/**
 * MultiAssetYieldDashboard Component
 * Shows yield generation opportunities for idle treasury funds
 */

import React from "react";
import type { YieldOpportunity } from "../../types/treasuryAnalytics";

interface MultiAssetYieldDashboardProps {
  opportunities: YieldOpportunity[];
  totalPotentialYield: number;
  onClick?: (opportunity: YieldOpportunity) => void;
}

/**
 * Get risk level badge color
 */
function getRiskColor(riskLevel: "low" | "medium" | "high"): {
  bg: string;
  text: string;
} {
  switch (riskLevel) {
    case "low":
      return { bg: "bg-green-500/15", text: "text-green-400" };
    case "medium":
      return { bg: "bg-yellow-500/15", text: "text-yellow-400" };
    case "high":
      return { bg: "bg-red-500/15", text: "text-red-400" };
  }
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

export const MultiAssetYieldDashboard: React.FC<
  MultiAssetYieldDashboardProps
> = ({ opportunities, totalPotentialYield, onClick }) => {
  if (opportunities.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center">
        <div className="mb-3 text-3xl">📊</div>
        <p className="text-sm font-medium text-white">No Yield Opportunities</p>
        <p className="mt-1 text-xs text-white/60">
          Insufficient idle funds to generate yield. Yield opportunities appear
          when idle funds exceed minimum thresholds.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-xs font-medium text-white/70">
            Total Idle Funds
          </p>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(
              opportunities.reduce((sum, opp) => sum + opp.idleFunds, 0) * 1,
            )}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-xs font-medium text-white/70">
            Annual Yield Potential
          </p>
          <p className="text-2xl font-bold text-emerald-400">
            {formatCurrency(totalPotentialYield * 12)}
          </p>
        </div>
      </div>

      {/* Opportunities List */}
      <div className="space-y-3">
        {opportunities.map((opp) => {
          const riskColor = getRiskColor(opp.riskLevel);
          const potentialYearlyYield = opp.potentialYield * 12;

          return (
            <div
              key={opp.id}
              onClick={() => onClick?.(opp)}
              className="cursor-pointer rounded-lg border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h4 className="font-semibold text-white">{opp.protocol}</h4>
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium">
                      <span
                        className={`${riskColor.text} rounded-full px-2 py-0.5 text-xs font-semibold`}
                      >
                        {opp.riskLevel.charAt(0).toUpperCase() +
                          opp.riskLevel.slice(1)}{" "}
                        Risk
                      </span>
                    </span>
                  </div>
                  <p className="text-sm text-white/60">{opp.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-emerald-400">
                    {opp.apy.toFixed(2)}%
                  </p>
                  <p className="text-xs text-white/60">APY</p>
                </div>
              </div>

              <div className="mb-3 grid grid-cols-3 gap-4 border-t border-white/10 pt-3 text-center text-xs">
                <div>
                  <p className="text-white/60">Idle Funds</p>
                  <p className="font-semibold text-white">
                    {opp.idleFunds.toFixed(4)} {opp.symbol}
                  </p>
                </div>
                <div>
                  <p className="text-white/60">Monthly Yield</p>
                  <p className="font-semibold text-white">
                    {(opp.potentialYield / 12).toFixed(4)} {opp.symbol}{" "}
                  </p>
                </div>
                <div>
                  <p className="text-white/60">Annual Yield</p>
                  <p className="font-semibold text-emerald-400">
                    {potentialYearlyYield.toFixed(4)} {opp.symbol}
                  </p>
                </div>
              </div>

              <div className="border-t border-white/10 pt-3 text-xs text-white/70">
                <div className="mb-2 flex justify-between">
                  <span>Minimum Deposit:</span>
                  <span className="text-white">
                    {opp.minDeposit} {opp.symbol}
                  </span>
                </div>
                <div className="mb-2 flex justify-between">
                  <span>Total Value Locked:</span>
                  <span className="text-white">{formatCurrency(opp.tvl)}</span>
                </div>
                {opp.lockupPeriod && (
                  <div className="flex justify-between">
                    <span>Lockup Period:</span>
                    <span className="text-white">{opp.lockupPeriod}</span>
                  </div>
                )}
              </div>

              {opp.supportedNetworks.length > 0 && (
                <div className="mt-3 flex gap-1">
                  {opp.supportedNetworks.map((net: string) => (
                    <span
                      key={net}
                      className="rounded bg-white/5 px-2 py-1 text-xs text-white/60"
                    >
                      {net}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Best Opportunity Recommendation */}
      {opportunities.length > 0 && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="mb-2 flex items-start gap-2">
            <span className="text-lg">💡</span>
            <div>
              <p className="font-semibold text-emerald-300">
                Best Opportunity: {opportunities[0].protocol}
              </p>
              <p className="mt-1 text-sm text-white/70">
                Allocating {opportunities[0].idleFunds.toFixed(4)}{" "}
                {opportunities[0].symbol} to {opportunities[0].protocol} at{" "}
                {opportunities[0].apy.toFixed(2)}% APY could generate
                {formatCurrency(opportunities[0].potentialYield * 12)} annually
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
