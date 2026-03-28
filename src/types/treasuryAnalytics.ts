/**
 * Treasury Analytics Types
 * Types and interfaces for advanced treasury analytics features including
 * burn rate calculations, yield opportunities, and what-if scenarios
 */

/**
 * Price data for a token
 */
export interface PriceData {
  symbol: string;
  usdPrice: number;
  timestamp: number;
  source: "band" | "pyth" | "fallback";
  change24h?: number;
}

/**
 * Token balance with USD equivalent
 */
export interface TokenBalance {
  symbol: string;
  amount: bigint;
  decimals: number;
  usdValue: number;
  priceData: PriceData | null;
}

/**
 * Monthly burn rate data
 */
export interface BurnRateData {
  token: string;
  symbol: string;
  dailyBurnRate: number;
  monthlyBurnRate: number;
  annualBurnRate: number;
  runwayDays: number;
  runwayMonths: number;
  timeToInsolvency: string; // "X days", "X months", etc
  trend: "increasing" | "decreasing" | "stable";
  trendPercentage: number;
}

/**
 * Yield opportunity for idle funds
 */
export interface YieldOpportunity {
  id: string;
  protocol: string;
  symbol: string;
  apy: number;
  tvl: number;
  riskLevel: "low" | "medium" | "high";
  minDeposit: number;
  idleFunds: number;
  potentialYield: number;
  lockupPeriod?: string;
  supportedNetworks: string[];
}

/**
 * What-if scenario for treasury modeling
 */
export interface WhatIfScenario {
  id: string;
  name: string;
  description: string;
  variables: ScenarioVariable[];
  results: ScenarioResult | null;
  createdAt: number;
}

/**
 * Variable for what-if scenario
 */
export interface ScenarioVariable {
  key: string;
  label: string;
  value: number;
  unit: string;
  originalValue: number;
  min?: number;
  max?: number;
}

/**
 * Results from a what-if scenario
 */
export interface ScenarioResult {
  projectedRunway: number;
  projectedBuildup: number;
  projectedYield: number;
  timeToGoal: number | null;
  riskFactors: string[];
}

/**
 * Treasury analytics summary
 */
export interface TreasuryAnalyticsSummary {
  totalValueUSD: number;
  totalLiabilities: number;
  availableFundsUSD: number;
  overallRunwayDays: number;
  healthScore: number; // 0-100
  averageBurnRate: number;
  recommendedActions: string[];
  riskLevel: "low" | "medium" | "high";
}

/**
 * Multi-token vault analysis
 */
export interface VaultAnalysis {
  token: string;
  symbol: string;
  balance: bigint;
  balanceUSD: number;
  liability: bigint;
  available: bigint;
  availableUSD: number;
  burnRate: BurnRateData;
  yieldOpportunities: YieldOpportunity[];
  concentration: number; // percentage of total treasury
}

/**
 * Price feed configuration
 */
export interface PriceFeedConfig {
  source: "band" | "pyth";
  apiUrl: string;
  tokens: string[];
  updateInterval: number; // milliseconds
}
