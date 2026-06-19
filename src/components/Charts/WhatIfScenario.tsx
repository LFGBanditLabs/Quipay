/**
 * WhatIfScenario Component
 * Allows users to model impacts of changes (hiring, deposits, yield deployment)
 */

import React, { useState, useMemo } from "react";
import {
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
  ScenarioResult,
  YieldOpportunity,
} from "../../types/treasuryAnalytics";
import {
  evaluateScenario,
  formatRunway,
} from "../../services/treasuryAnalyticsService";

interface WhatIfScenarioProps {
  currentAssets: AssetAnalytics[];
  currentMonthlyBurn: number;
  yieldOpportunities: YieldOpportunity[];
  onScenarioRun?: (result: ScenarioResult) => void;
}

interface ProjectionChartData {
  month: string;
  current: number;
  projected: number;
}

const tw = {
  container:
    "rounded-2xl border border-indigo-500/15 bg-slate-800/55 p-6 backdrop-blur-[20px]",
  header: "mb-6",
  title: "text-lg font-bold text-slate-100",
  subtitle: "text-sm text-slate-400",
  form: "mb-6 rounded-lg border border-indigo-500/10 bg-slate-900/50 p-6",
  formSection: "mb-6",
  formSectionTitle: "mb-3 font-semibold text-slate-100",
  formGrid: "grid grid-cols-1 gap-4 md:grid-cols-2",
  fieldLabel: "block text-sm font-medium text-slate-300 mb-2",
  fieldHelp: "mt-1 text-xs text-slate-500",
  input:
    "w-full rounded-lg border border-indigo-500/20 bg-slate-900/60 px-4 py-2 text-slate-200 placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
  select:
    "w-full rounded-lg border border-indigo-500/20 bg-slate-900/60 px-4 py-2 text-slate-200 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
  checkbox:
    "h-4 w-4 rounded border-indigo-500/20 bg-slate-900 accent-indigo-500",
  checkboxLabel: "ml-2 text-sm text-slate-300",
  divider: "my-6 border-t border-slate-700",
  buttonGroup: "flex gap-3",
  btn: "flex-1 rounded-lg px-4 py-3 font-semibold transition-all",
  btnPrimary: "bg-indigo-500/30 text-indigo-200 hover:bg-indigo-500/40",
  btnSecondary:
    "border border-slate-600 bg-slate-900/30 text-slate-300 hover:bg-slate-800/50",
  results: "space-y-4",
  resultCard: "rounded-lg border border-indigo-500/10 bg-slate-900/50 p-5",
  resultHeader: "mb-3 flex items-center justify-between gap-2",
  resultTitle: "font-semibold text-slate-100",
  viabilityBadge:
    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
  viableGood: "bg-emerald-500/15 text-emerald-300",
  viableBad: "bg-rose-500/15 text-rose-300",
  metricsGrid: "grid grid-cols-2 gap-3 md:grid-cols-4",
  metricBox: "rounded-lg bg-slate-800/50 p-3",
  metricLabel: "text-xs font-semibold uppercase text-slate-500",
  metricValue: "mt-1 text-lg font-bold",
  metricLabelPositive: "text-emerald-400",
  metricLabelNegative: "text-rose-400",
  riskFactorsSection: "mt-4 rounded-lg bg-slate-800/30 p-4",
  riskFactorsTitle: "mb-3 font-semibold text-slate-100",
  riskFactor: "flex items-start gap-3 text-sm",
  riskSeverity: "mt-0.5 inline-flex rounded px-2 py-0.5 text-xs font-semibold",
  riskSeverityLow: "bg-amber-500/15 text-amber-300",
  riskSeverityMedium: "bg-orange-500/15 text-orange-300",
  riskSeverityHigh: "bg-rose-500/15 text-rose-300",
  chartContainer:
    "mt-6 rounded-lg border border-indigo-500/10 bg-slate-900/50 p-4",
  chartTitle: "mb-4 text-sm font-semibold text-slate-100",
  emptyState:
    "rounded-lg border border-dashed border-slate-600 p-8 text-center text-slate-400",
};

export const WhatIfScenario: React.FC<WhatIfScenarioProps> = ({
  currentAssets,
  currentMonthlyBurn,
  yieldOpportunities,
  onScenarioRun,
}) => {
  // Form state
  const [scenarioName, setScenarioName] = useState("Scenario 1");
  const [newWorkerCount, setNewWorkerCount] = useState(0);
  const [newWorkerRate, setNewWorkerRate] = useState(0);
  const [workerHours, setWorkerHours] = useState(40);
  const [additionalDeposit, setAdditionalDeposit] = useState(0);
  const [selectedOpportunity, setSelectedOpportunity] = useState<string>("");
  const [yieldAmount, setYieldAmount] = useState(0);

  // Results state
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(
    null,
  );
  const [projectionChartData, setProjectionChartData] = useState<
    ProjectionChartData[]
  >([]);

  // Run scenario
  const handleRunScenario = () => {
    const scenario = {
      id: `scenario_${Date.now()}`,
      name: scenarioName,
      description: `What-if scenario: +${newWorkerCount} workers, +$${additionalDeposit} deposit`,
      newWorkerCount: newWorkerCount > 0 ? newWorkerCount : undefined,
      newWorkerPayRate: newWorkerRate > 0 ? newWorkerRate : undefined,
      workerHoursPerWeek: workerHours,
      additionalDeposit: additionalDeposit > 0 ? additionalDeposit : undefined,
      depositAsset: "USDC",
      allocateToYieldOpportunity: selectedOpportunity || undefined,
      yieldAllocationAmount: yieldAmount > 0 ? yieldAmount : undefined,
    };

    const result = evaluateScenario(
      scenario,
      currentAssets,
      currentMonthlyBurn,
      0.05,
    );
    setScenarioResult(result);
    onScenarioRun?.(result);

    // Generate projection chart data
    const chartData = [];
    for (let month = 0; month <= 12; month++) {
      chartData.push({
        month: `M${month}`,
        current: Math.max(
          0,
          currentAssets.reduce((sum, a) => sum + a.availableBalance, 0) -
            currentMonthlyBurn * month,
        ),
        projected: Math.max(
          0,
          result.projectedUsdValue - result.projectedMonthlyBurn * month,
        ),
      });
    }
    setProjectionChartData(chartData);
  };

  const totalCurrentBurn = useMemo(
    () =>
      currentMonthlyBurn + newWorkerCount * newWorkerRate * workerHours * 4.33,
    [newWorkerCount, newWorkerRate, workerHours, currentMonthlyBurn],
  );

  const totalCurrentTreasury = useMemo(
    () =>
      currentAssets.reduce((sum, a) => sum + a.availableBalance, 0) +
      additionalDeposit,
    [currentAssets, additionalDeposit],
  );

  const currentRunway = useMemo(
    () => (totalCurrentTreasury / currentMonthlyBurn) * 30,
    [totalCurrentTreasury, currentMonthlyBurn],
  );

  const projectedRunway = useMemo(
    () =>
      scenarioResult
        ? (scenarioResult.projectedUsdValue / totalCurrentBurn) * 30
        : 0,
    [scenarioResult, totalCurrentBurn],
  );

  return (
    <div className={tw.container}>
      <div className={tw.header}>
        <h2 className={tw.title}>What-If Scenarios</h2>
        <p className={tw.subtitle}>
          Model the impact of changes: hiring workers, deposits, or yield
          strategies
        </p>
      </div>

      <div className={tw.form}>
        {/* Scenario Name */}
        <div className={tw.formSection}>
          <label className={tw.fieldLabel}>Scenario Name</label>
          <input
            type="text"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder="e.g., Hire 3 developers"
            className={tw.input}
          />
        </div>

        {/* Worker Changes */}
        <div className={tw.formSection}>
          <h3 className={tw.formSectionTitle}>👥 Workforce Changes</h3>
          <div className={tw.formGrid}>
            <div>
              <label className={tw.fieldLabel}>Additional Workers</label>
              <input
                type="number"
                value={newWorkerCount}
                onChange={(e) => setNewWorkerCount(Number(e.target.value))}
                min="0"
                placeholder="0"
                className={tw.input}
              />
              <span className={tw.fieldHelp}>
                Number of new employees to add
              </span>
            </div>
            <div>
              <label className={tw.fieldLabel}>Hourly Rate (USDC)</label>
              <input
                type="number"
                value={newWorkerRate}
                onChange={(e) => setNewWorkerRate(Number(e.target.value))}
                min="0"
                step="0.01"
                placeholder="0"
                className={tw.input}
              />
              <span className={tw.fieldHelp}>Pay per hour for new workers</span>
            </div>
            <div>
              <label className={tw.fieldLabel}>Hours per Week</label>
              <input
                type="number"
                value={workerHours}
                onChange={(e) => setWorkerHours(Number(e.target.value))}
                min="0"
                max="168"
                placeholder="40"
                className={tw.input}
              />
              <span className={tw.fieldHelp}>
                Average weekly hours per worker
              </span>
            </div>
            {newWorkerCount > 0 && newWorkerRate > 0 && (
              <div className="rounded-lg bg-indigo-500/10 p-3">
                <div className="text-xs font-semibold text-slate-400">
                  Estimated Monthly Cost
                </div>
                <div className="mt-1 text-lg font-bold text-indigo-300">
                  $
                  {(
                    newWorkerCount *
                    newWorkerRate *
                    workerHours *
                    4.33
                  ).toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={tw.divider} />

        {/* Funding Changes */}
        <div className={tw.formSection}>
          <h3 className={tw.formSectionTitle}>💰 Treasury Changes</h3>
          <div className={tw.formGrid}>
            <div>
              <label className={tw.fieldLabel}>Additional Deposit (USDC)</label>
              <input
                type="number"
                value={additionalDeposit}
                onChange={(e) => setAdditionalDeposit(Number(e.target.value))}
                min="0"
                step="100"
                placeholder="0"
                className={tw.input}
              />
              <span className={tw.fieldHelp}>One-time capital injection</span>
            </div>
          </div>
        </div>

        <div className={tw.divider} />

        {/* Yield Opportunity */}
        <div className={tw.formSection}>
          <h3 className={tw.formSectionTitle}>🌱 Yield Strategy</h3>
          <div className={tw.formGrid}>
            <div>
              <label className={tw.fieldLabel}>Deploy to Opportunity</label>
              <select
                value={selectedOpportunity}
                onChange={(e) => setSelectedOpportunity(e.target.value)}
                className={tw.select}
              >
                <option value="">-- None --</option>
                {yieldOpportunities.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name} ({(op.apy * 100).toFixed(1)}% APY)
                  </option>
                ))}
              </select>
              <span className={tw.fieldHelp}>
                Select where to allocate funds
              </span>
            </div>
            {selectedOpportunity && (
              <div>
                <label className={tw.fieldLabel}>
                  Allocation Amount (USDC)
                </label>
                <input
                  type="number"
                  value={yieldAmount}
                  onChange={(e) => setYieldAmount(Number(e.target.value))}
                  min="0"
                  step="100"
                  placeholder="0"
                  className={tw.input}
                />
                <span className={tw.fieldHelp}>How much to deploy</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className={tw.buttonGroup}>
          <button
            onClick={() => {
              setScenarioName("Scenario 1");
              setNewWorkerCount(0);
              setNewWorkerRate(0);
              setAdditionalDeposit(0);
              setSelectedOpportunity("");
              setYieldAmount(0);
              setScenarioResult(null);
              setProjectionChartData([]);
            }}
            className={`${tw.btn} ${tw.btnSecondary}`}
          >
            Reset
          </button>
          <button
            onClick={handleRunScenario}
            className={`${tw.btn} ${tw.btnPrimary}`}
          >
            Run Scenario
          </button>
        </div>
      </div>

      {/* Results */}
      {scenarioResult && (
        <div className={tw.results}>
          {/* Header */}
          <div className={tw.resultCard}>
            <div className={tw.resultHeader}>
              <h3 className={tw.resultTitle}>{scenarioName}</h3>
              <span
                className={`${tw.viabilityBadge} ${scenarioResult.isViable ? tw.viableGood : tw.viableBad}`}
              >
                {scenarioResult.isViable ? "✓ Viable" : "⚠ High Risk"}
              </span>
            </div>

            {/* Metrics Grid */}
            <div className={tw.metricsGrid}>
              <div className={tw.metricBox}>
                <div className={tw.metricLabel}>Current Runway</div>
                <div className={tw.metricValue}>
                  {formatRunway(currentRunway)}
                </div>
              </div>
              <div className={tw.metricBox}>
                <div className={tw.metricLabel}>Projected Runway</div>
                <div className={tw.metricValue}>
                  <span
                    className={
                      projectedRunway > currentRunway
                        ? tw.metricLabelPositive
                        : tw.metricLabelNegative
                    }
                  >
                    {formatRunway(projectedRunway)}
                  </span>
                </div>
              </div>
              <div className={tw.metricBox}>
                <div className={tw.metricLabel}>Monthly Burn Impact</div>
                <div
                  className={`${tw.metricValue} ${scenarioResult.monthlyBurnDelta > 0 ? tw.metricLabelNegative : tw.metricLabelPositive}`}
                >
                  {scenarioResult.monthlyBurnDelta > 0 ? "+" : ""}$
                  {scenarioResult.monthlyBurnDelta.toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>
              <div className={tw.metricBox}>
                <div className={tw.metricLabel}>Treasury Value Change</div>
                <div
                  className={`${tw.metricValue} ${scenarioResult.usdValueDelta > 0 ? tw.metricLabelPositive : tw.metricLabelNegative}`}
                >
                  {scenarioResult.usdValueDelta > 0 ? "+" : ""}$
                  {scenarioResult.usdValueDelta.toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>
            </div>

            {/* Risk Factors */}
            {scenarioResult.riskFactors.length > 0 && (
              <div className={tw.riskFactorsSection}>
                <h4 className={tw.riskFactorsTitle}>⚠ Risk Factors</h4>
                <div className="space-y-2">
                  {scenarioResult.riskFactors.map((risk, i) => (
                    <div key={i} className={tw.riskFactor}>
                      <span
                        className={`${tw.riskSeverity} ${risk.severity === "low" ? tw.riskSeverityLow : risk.severity === "medium" ? tw.riskSeverityMedium : tw.riskSeverityHigh}`}
                      >
                        {risk.severity.charAt(0).toUpperCase() +
                          risk.severity.slice(1)}
                      </span>
                      <div>
                        <div className="font-medium text-slate-100">
                          {risk.description}
                        </div>
                        {risk.mitigation && (
                          <div className="mt-1 text-slate-400">
                            💡 {risk.mitigation}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Projection Chart */}
          {projectionChartData.length > 0 && (
            <div className={tw.chartContainer}>
              <h3 className={tw.chartTitle}>12-Month Projection</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={projectionChartData}>
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
                    dataKey="current"
                    stroke="#6366f1"
                    name="Current Path"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="projected"
                    stroke="#10b981"
                    name="With Scenario"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {!scenarioResult && (
        <div className={tw.emptyState}>
          <div className="text-4xl">📊</div>
          <div className="mt-3">Run a scenario to see projections</div>
        </div>
      )}
    </div>
  );
};
