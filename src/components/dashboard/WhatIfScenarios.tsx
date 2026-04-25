/**
 * WhatIfScenarios Component
 * Allows modeling different treasury scenarios to make informed decisions
 */

import React, { useState } from "react";
import type {
  WhatIfScenario,
  ScenarioVariable,
  ScenarioResult,
} from "../../types/treasuryAnalytics";

interface WhatIfScenariosProps {
  currentScenarios: WhatIfScenario[];
  onScenarioUpdate?: (scenario: WhatIfScenario) => void;
  onScenarioCreate?: (scenario: WhatIfScenario) => void;
}

interface FormState {
  name: string;
  description: string;
  variables: Record<string, number>;
}

/**
 * Simulate scenario results
 */
function simulateScenario(variables: Record<string, number>): ScenarioResult {
  const workers = variables["workerCount"] || 5;
  const hourlyRate = variables["hourlyRate"] || 10;
  const dailyHours = variables["dailyHours"] || 8;
  const newWorkers = variables["newWorkers"] || 0;
  const newHourlyRate = variables["newHourlyRate"] || 10;

  // Calculate projections
  const currentDailyCost = workers * hourlyRate * dailyHours;
  const additionalDailyCost = newWorkers * newHourlyRate * dailyHours;
  const projectedDailyCost = currentDailyCost + additionalDailyCost;
  const monthlyBurnincrease = additionalDailyCost * 30;

  // Assume 100k starting balance
  const startingBalance = 100000;
  const projectedRunway = Math.floor(startingBalance / projectedDailyCost);
  const projectedBuildup = monthlyBurnincrease > 0 ? 0 : 5000;
  const projectedYield = variables["allocatedYield"] || 0;
  const timeToGoal =
    projectedDailyCost > 0 ? Math.floor(50000 / monthlyBurnincrease) : null;

  const riskFactors: string[] = [];
  if (newWorkers > 0 && monthlyBurnincrease > 20000) {
    riskFactors.push("Significant increase in monthly expenses");
  }
  if (projectedRunway < 30) {
    riskFactors.push("Runway drops below 30 days");
  }
  if (projectedYield < 0) {
    riskFactors.push("Negative yield impact");
  }

  return {
    projectedRunway,
    projectedBuildup,
    projectedYield,
    timeToGoal,
    riskFactors,
  };
}

export const WhatIfScenarios: React.FC<WhatIfScenariosProps> = ({
  currentScenarios,
  onScenarioUpdate,
  onScenarioCreate,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [selectedScenario, setSelectedScenario] =
    useState<WhatIfScenario | null>(null);
  const [formData, setFormData] = useState<FormState>({
    name: "",
    description: "",
    variables: {},
  });

  const defaultVariables: ScenarioVariable[] = [
    {
      key: "workerCount",
      label: "Current Workers",
      value: 5,
      unit: "people",
      originalValue: 5,
      min: 1,
      max: 100,
    },
    {
      key: "hourlyRate",
      label: "Hourly Rate",
      value: 10,
      unit: "USDC/hr",
      originalValue: 10,
      min: 1,
      max: 100,
    },
    {
      key: "dailyHours",
      label: "Daily Work Hours",
      value: 8,
      unit: "hours",
      originalValue: 8,
      min: 1,
      max: 24,
    },
    {
      key: "newWorkers",
      label: "New Workers to Add",
      value: 0,
      unit: "people",
      originalValue: 0,
      min: 0,
      max: 50,
    },
    {
      key: "newHourlyRate",
      label: "New Worker Rate",
      value: 10,
      unit: "USDC/hr",
      originalValue: 10,
      min: 1,
      max: 100,
    },
    {
      key: "allocatedYield",
      label: "Allocated Yield",
      value: 0,
      unit: "USDC/month",
      originalValue: 0,
      min: 0,
      max: 50000,
    },
  ];

  const handleCreateScenario = () => {
    if (!formData.name) return;

    const variables = defaultVariables.map((v) => ({
      ...v,
      value: formData.variables[v.key] || v.value,
    }));

    const newScenario: WhatIfScenario = {
      id: Date.now().toString(),
      name: formData.name,
      description: formData.description,
      variables,
      results: simulateScenario(formData.variables),
      createdAt: Date.now(),
    };

    onScenarioCreate?.(newScenario);
    setFormData({ name: "", description: "", variables: {} });
    setShowForm(false);
  };

  const handleUpdateScenario = (
    scenarioId: string,
    updatedVars: Record<string, number>,
  ) => {
    const scenario = currentScenarios.find((s) => s.id === scenarioId);
    if (!scenario) return;

    const updatedScenario: WhatIfScenario = {
      ...scenario,
      variables: scenario.variables.map((v: ScenarioVariable) => ({
        ...v,
        value: updatedVars[v.key] ?? v.value,
      })),
      results: simulateScenario(updatedVars),
    };

    onScenarioUpdate?.(updatedScenario);
  };

  return (
    <div className="space-y-6">
      {/* Create Scenario Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full rounded-lg border border-dashed border-white/30 bg-white/5 px-4 py-6 text-center transition hover:border-white/50 hover:bg-white/10"
        >
          <span className="text-2xl">+</span>
          <p className="mt-2 text-sm font-medium text-white">
            Create New Scenario
          </p>
          <p className="mt-1 text-xs text-white/60">
            Model different treasury configurations
          </p>
        </button>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
          <h3 className="mb-4 text-sm font-semibold text-white">
            Create Scenario
          </h3>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-white/70">
                Scenario Name
              </label>
              <input
                type="text"
                placeholder="e.g., Add 5 Workers"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 transition focus:border-white/30 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-white/70">
                Description (Optional)
              </label>
              <textarea
                placeholder="Describe this scenario..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 transition focus:border-white/30 focus:outline-none"
                rows={2}
              />
            </div>

            {/* Variables */}
            <div className="space-y-3 border-t border-white/10 pt-4">
              <label className="block text-xs font-medium text-white/70">
                Variables
              </label>
              {defaultVariables.map((variable) => (
                <div key={variable.key}>
                  <label className="mb-1 flex justify-between text-xs text-white/60">
                    <span>{variable.label}</span>
                    <span className="text-white">
                      {formData.variables[variable.key] ?? variable.value}{" "}
                      {variable.unit}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={variable.min}
                    max={variable.max}
                    value={formData.variables[variable.key] ?? variable.value}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        variables: {
                          ...formData.variables,
                          [variable.key]: parseInt(e.target.value, 10),
                        },
                      })
                    }
                    className="w-full"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 border-t border-white/10 pt-4">
              <button
                onClick={handleCreateScenario}
                disabled={!formData.name}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                Create Scenario
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scenarios List */}
      <div className="space-y-3">
        {currentScenarios.map((scenario) => (
          <div
            key={scenario.id}
            className="rounded-lg border border-white/10 bg-white/5 p-6"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-white">{scenario.name}</h4>
                {scenario.description && (
                  <p className="mt-1 text-sm text-white/60">
                    {scenario.description}
                  </p>
                )}
              </div>
              <button
                onClick={() =>
                  setSelectedScenario(
                    selectedScenario?.id === scenario.id ? null : scenario,
                  )
                }
                className="text-white/60 transition hover:text-white"
              >
                {selectedScenario?.id === scenario.id ? "▼" : "▶"}
              </button>
            </div>

            {/* Variables Editor */}
            {selectedScenario?.id === scenario.id && (
              <div className="mb-4 space-y-3 border-t border-white/10 py-4">
                {scenario.variables.map((variable: ScenarioVariable) => (
                  <div key={variable.key}>
                    <label className="mb-1 flex justify-between text-xs text-white/60">
                      <span>{variable.label}</span>
                      <span className="text-white">
                        {variable.value} {variable.unit}
                      </span>
                    </label>
                    <input
                      type="range"
                      min={variable.min}
                      max={variable.max}
                      value={variable.value}
                      onChange={(e) => {
                        const updatedVars = scenario.variables.reduce(
                          (
                            acc: Record<string, number>,
                            v: ScenarioVariable,
                          ) => {
                            acc[v.key] =
                              v.key === variable.key
                                ? parseInt(e.target.value, 10)
                                : v.value;
                            return acc;
                          },
                          {} as Record<string, number>,
                        );
                        handleUpdateScenario(scenario.id, updatedVars);
                      }}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Results */}
            {scenario.results && (
              <div className="grid gap-3 sm:grid-cols-4 border-t border-white/10 pt-4">
                <div className="rounded-lg bg-white/5 p-3 text-center">
                  <p className="text-2xl font-bold text-white">
                    {scenario.results.projectedRunway}
                  </p>
                  <p className="text-xs text-white/60">Days Runway</p>
                </div>
                <div className="rounded-lg bg-white/5 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-400">
                    ${(scenario.results.projectedBuildup / 1000).toFixed(1)}K
                  </p>
                  <p className="text-xs text-white/60">Monthly Buildup</p>
                </div>
                <div className="rounded-lg bg-white/5 p-3 text-center">
                  <p className="text-2xl font-bold text-blue-400">
                    ${(scenario.results.projectedYield / 1000).toFixed(1)}K
                  </p>
                  <p className="text-xs text-white/60">Annual Yield</p>
                </div>
                <div className="rounded-lg bg-white/5 p-3 text-center">
                  <p className="text-2xl font-bold text-white">
                    {scenario.results.timeToGoal || "∞"}
                  </p>
                  <p className="text-xs text-white/60">Months to Goal</p>
                </div>
              </div>
            )}

            {/* Risk Factors */}
            {scenario.results && scenario.results.riskFactors.length > 0 && (
              <div className="mt-3 rounded-lg bg-red-500/10 p-3">
                <p className="mb-2 text-xs font-medium text-red-400">
                  ⚠️ Risk Factors:
                </p>
                <ul className="text-xs text-red-300/80">
                  {scenario.results.riskFactors.map(
                    (factor: string, idx: number) => (
                      <li key={idx}>• {factor}</li>
                    ),
                  )}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
