/**
 * Types for the Advanced Treasury Analytics suite
 * Covers burn rate calculations, yield opportunities, and what-if scenarios
 */

/** Asset information with funding details */
export interface AssetAnalytics {
  tokenSymbol: string;
  tokenAddress?: string;
  treasuryBalance: number;
  totalLiability: number;
  availableBalance: number;
  /** Monthly burn rate (liability-based usage) */
  monthlyBurnRate: number;
  /** Days of runway before insolvency */
  daysToInsolvency: number;
  /** USD equivalent value */
  usdValue: number;
  /** Current price in USD */
  priceInUsd: number;
  /** 24h price change percentage */
  priceChange24h: number;
  /** Historical burn rates for trend analysis */
  burnRateHistory: BurnRateHistory[];
}

/** Historical burn rate data for trend analysis */
export interface BurnRateHistory {
  date: string; // ISO 8601
  burnRate: number; // Amount burned in this period
  periodDays: number; // Duration of the period
  activeWorkers: number; // Number of active workers in this period
}

/** Yield opportunity for idle funds */
export interface YieldOpportunity {
  id: string;
  name: string;
  description?: string;
  protocol: string; // e.g., "Soroban Lending", "Stellar Path Payment", "LP Pool"
  supportedAssets: string[]; // Token symbols like ["USDC", "EURC"]
  supportedNetworks: string[];
  symbol: string;
  apy: number; // Annual Percentage Yield
  tvl: number; // Total Value Locked in USD
  riskLevel: "low" | "medium" | "high";
  lockupPeriod: number | string; // Days (0 = no lockup) or descriptive string
  minDeposit: number;
  maxDeposit?: number | null;
  idleFunds: number;
  potentialYield: number;
  verified?: boolean; // Has passed security audit
  url?: string; // Link to protocol
}

export interface BurnRateData {
  id: string;
  token: string;
  symbol: string;
  dailyBurnRate: number;
  monthlyBurnRate: number;
  annualBurnRate: number;
  runwayDays: number;
  runwayMonths: number;
  timeToInsolvency: string;
  trend: "increasing" | "decreasing" | "stable";
  trendPercentage: number;
  burnRateHistory?: BurnRateHistory[];
}

export interface PriceData {
  usdPrice: number;
  timestamp?: string;
  source?: string;
}

/** What-if scenario parameters */
export interface ScenarioInput {
  id: string;
  name: string;
  description: string;
  // Worker changes
  newWorkerCount?: number;
  newWorkerPayRate?: number; // Per hour
  workerHoursPerWeek?: number;
  // Additional funding
  additionalDeposit?: number;
  depositAsset?: string;
  // Yield deployment
  allocateToYieldOpportunity?: string; // YieldOpportunity.id
  yieldAllocationAmount?: number;
}

/** Result of a what-if scenario calculation */
export interface ScenarioResult {
  scenarioId: string;
  timestamp: string; // ISO 8601
  // Original state
  originalDaysToInsolvency: number;
  originalUsdValue: number;
  originalMonthlyBurn: number;
  // Projected state (usually 12 months out)
  projectedDaysToInsolvency: number;
  projectedUsdValue: number;
  projectedMonthlyBurn: number;
  // Changes
  daysToInsolvencyDelta: number; // Positive = improvement
  usdValueDelta: number;
  monthlyBurnDelta: number;
  projectionPeriodMonths: number;
  // Projected yield generation
  projectedYieldGenerated: number;
  yieldAsset: string;
  // Risk assessment
  riskFactors: RiskFactor[];
  isViable: boolean;
}

/** Risk factor in a scenario */
export interface RiskFactor {
  type:
    | "low-runway"
    | "high-burn-increase"
    | "asset-volatility"
    | "yield-counterparty"
    | "market-risk";
  severity: "low" | "medium" | "high";
  description: string;
  mitigation?: string;
}

/** Price feed data from external provider */
export interface PriceFeedData {
  tokenSymbol: string;
  price: number; // USD
  timestamp: string; // ISO 8601
  source: "band" | "pyth" | "coingecko" | "cached";
  confidence?: number; // For Pyth: confidence interval
  expiresIn?: number; // Seconds until price is stale
}

/** Price feed configuration */
export interface PriceFeedConfig {
  provider: "band" | "pyth" | "coingecko" | "mock";
  /** Cache TTL in milliseconds */
  cacheTTL: number;
  /** Contract addresses for Band/Pyth on Stellar/Soroban */
  contractAddresses?: Record<string, string>;
  fallbackPrices?: Record<string, number>;
}

/** Comprehensive treasury health snapshot */
export interface TreasuryHealthSnapshot {
  timestamp: string; // ISO 8601
  assets: AssetAnalytics[];
  aggregatedMetrics: {
    totalTreasuryUsd: number;
    totalLiabilityUsd: number;
    aggregatedMonthlyBurn: number;
    weightedAverageDaysToInsolvency: number;
    riskLevel: "low" | "medium" | "high" | "critical";
  };
  yieldOpportunities: YieldOpportunity[];
  activeScenarios: ScenarioResult[];
}

/** Chart data for visualizations */
export interface BurnRateChartData {
  date: string;
  burnRate: number;
  projectedRunway: number; // Days
  activeWorkers: number;
}

export interface YieldOpportunitiesChartData {
  protocol: string;
  apy: number;
  tvl: number;
  riskLevel: string;
}

export interface UsdValueChartData {
  date: string;
  totalValue: number;
  breakdown: Record<string, number>; // token -> value
}
