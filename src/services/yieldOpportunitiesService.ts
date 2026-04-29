/**
 * Yield Opportunities Service
 * Curates and validates yield strategies available on the Soroban ecosystem
 */

import type { YieldOpportunity } from "../types/treasuryAnalytics";

/**
 * Yield opportunities available in the Soroban ecosystem
 * This would be populated from on-chain data or API in production
 */
const YIELD_OPPORTUNITIES: YieldOpportunity[] = [
  {
    id: "soroban-lending-pool-1",
    name: "Stellar Lending Protocol",
    description:
      "Supply USDC to earn interest from borrowing activity on Soroban",
    protocol: "Soroban Lending",
    supportedAssets: ["USDC", "EURC"],
    supportedNetworks: ["mainnet"],
    symbol: "USDC",
    idleFunds: 0,
    potentialYield: 0,
    apy: 0.045, // 4.5%
    tvl: 50000000, // $50M
    riskLevel: "medium",
    lockupPeriod: 0,
    minDeposit: 100,
    maxDeposit: 1000000,
    verified: true,
    url: "https://example.com/soroban-lending",
  },
  {
    id: "xlm-liquidity-pool",
    name: "XLM-USDC Automated Market Maker",
    description:
      "Provide liquidity to XLM-USDC pair and earn trading fees + rewards",
    protocol: "Soroban Liquidity Pool",
    supportedAssets: ["XLM", "USDC"],
    supportedNetworks: ["mainnet"],
    symbol: "USDC",
    idleFunds: 0,
    potentialYield: 0,
    apy: 0.062, // 6.2%
    tvl: 35000000,
    riskLevel: "high", // Impermanent loss risk
    lockupPeriod: 0,
    minDeposit: 500,
    maxDeposit: null, // No limit
    verified: true,
    url: "https://example.com/amm",
  },
  {
    id: "stellar-path-payment",
    name: "Stellar Path Payment Stream",
    description:
      "Lock funds in time-bound Stellar operations earning interest yields",
    protocol: "Stellar Path Payment",
    supportedAssets: ["USDC", "BTC"],
    supportedNetworks: ["mainnet"],
    symbol: "USDC",
    idleFunds: 0,
    potentialYield: 0,
    apy: 0.035, // 3.5%
    tvl: 100000000,
    riskLevel: "low",
    lockupPeriod: 30, // 30 days
    minDeposit: 1000,
    maxDeposit: 5000000,
    verified: true,
    url: "https://example.com/stellar-path",
  },
  {
    id: "composable-yield-1",
    name: "Multi-Layer Yield Aggregator",
    description:
      "Automatically routes funds to highest-yielding opportunities, rebalancing daily",
    protocol: "Yield Aggregator",
    supportedAssets: ["USDC", "EURC"],
    supportedNetworks: ["mainnet"],
    symbol: "USDC",
    idleFunds: 0,
    potentialYield: 0,
    apy: 0.055, // 5.5%
    tvl: 25000000,
    riskLevel: "high", // Complex strategy
    lockupPeriod: 0,
    minDeposit: 5000,
    maxDeposit: 500000,
    verified: false, // Not yet audited
    url: "https://example.com/aggregator",
  },
  {
    id: "staking-derivatives",
    name: "Staking Derivatives",
    description:
      "Earn yield on XLM through validator rewards while maintaining liquidity",
    protocol: "Staking",
    supportedAssets: ["XLM"],
    supportedNetworks: ["mainnet"],
    symbol: "XLM",
    idleFunds: 0,
    potentialYield: 0,
    apy: 0.08, // 8%
    tvl: 15000000,
    riskLevel: "medium",
    lockupPeriod: 0,
    minDeposit: 100,
    maxDeposit: 1000000,
    verified: true,
    url: "https://example.com/staking",
  },
];

export const yieldOpportunitiesService = {
  /**
   * Get all available yield opportunities
   */
  getOpportunities(): YieldOpportunity[] {
    return structuredClone(YIELD_OPPORTUNITIES);
  },

  /**
   * Filter opportunities by supported asset
   */
  getOpportunitiesForAsset(asset: string): YieldOpportunity[] {
    return YIELD_OPPORTUNITIES.filter((op) =>
      op.supportedAssets.includes(asset),
    );
  },

  /**
   * Filter by risk level
   */
  getOpportunitiesByRisk(
    riskLevel: "low" | "medium" | "high",
  ): YieldOpportunity[] {
    return YIELD_OPPORTUNITIES.filter((op) => op.riskLevel === riskLevel);
  },

  /**
   * Get verified opportunities only
   */
  getVerifiedOpportunities(): YieldOpportunity[] {
    return YIELD_OPPORTUNITIES.filter((op) => op.verified);
  },

  /**
   * Rank opportunities by APY
   */
  getRankedByAPY(): YieldOpportunity[] {
    return structuredClone(YIELD_OPPORTUNITIES).sort((a, b) => b.apy - a.apy);
  },

  /**
   * Recommend opportunities for given assets and risk tolerance
   */
  getRecommendations(
    assets: string[],
    riskTolerance: "conservative" | "moderate" | "aggressive",
    minApy: number = 0,
  ): YieldOpportunity[] {
    const riskMap = {
      conservative: "low",
      moderate: "medium",
      aggressive: "high",
    } as const;

    return YIELD_OPPORTUNITIES.filter((op) => {
      const riskMatch =
        op.riskLevel === riskMap[riskTolerance] ||
        riskTolerance === "aggressive"; // Aggressive can handle any risk
      const assetMatch = assets.some((a) => op.supportedAssets.includes(a));
      const apyMatch = op.apy >= minApy;

      return riskMatch && assetMatch && apyMatch;
    }).sort((a, b) => b.apy - a.apy);
  },

  /**
   * Get single opportunity by ID
   */
  getOpportunityById(id: string): YieldOpportunity | null {
    return YIELD_OPPORTUNITIES.find((op) => op.id === id) || null;
  },

  /**
   * Estimate yield generation for an amount and period
   */
  estimateYield(
    opportunityId: string,
    amount: number,
    monthsAhead: number,
  ): number | null {
    const opportunity = YIELD_OPPORTUNITIES.find(
      (op) => op.id === opportunityId,
    );
    if (!opportunity) return null;

    // Simple compound interest formula: A = P(1 + r/12)^n
    const monthlyRate = opportunity.apy / 12;
    return amount * (Math.pow(1 + monthlyRate, monthsAhead) - 1);
  },

  /**
   * Check if amount meets opportunity requirements
   */
  meetsRequirements(
    opportunityId: string,
    amount: number,
  ): { meets: boolean; reason?: string } {
    const opportunity = YIELD_OPPORTUNITIES.find(
      (op) => op.id === opportunityId,
    );
    if (!opportunity) {
      return { meets: false, reason: "Opportunity not found" };
    }

    if (amount < opportunity.minDeposit) {
      return {
        meets: false,
        reason: `Minimum deposit is $${opportunity.minDeposit}`,
      };
    }

    if (opportunity.maxDeposit && amount > opportunity.maxDeposit) {
      return {
        meets: false,
        reason: `Maximum deposit is $${opportunity.maxDeposit}`,
      };
    }

    return { meets: true };
  },

  /**
   * Get risk-adjusted return (Return / Risk)
   */
  getRiskAdjustedReturn(opportunity: YieldOpportunity): number {
    const riskMultiplier = {
      low: 1.5,
      medium: 1.0,
      high: 0.5,
    };
    return opportunity.apy * riskMultiplier[opportunity.riskLevel];
  },

  /**
   * Portfolio recommendation based on total amount and risk profile
   */
  recommendPortfolio(
    totalAmount: number,
    riskProfile: "conservative" | "moderate" | "aggressive",
    supportedAssets: string[] = ["USDC", "XLM"],
  ): Array<{ opportunity: YieldOpportunity; allocation: number }> {
    const recommendations = this.getRecommendations(
      supportedAssets,
      riskProfile,
      0,
    );

    if (recommendations.length === 0) {
      return [];
    }

    // Simple allocation strategy: evenly allocate with slight preference to higher APY
    const weights = recommendations.map((_, i) => 1 / Math.exp(i * 0.1));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    return recommendations.map((opportunity, i) => ({
      opportunity,
      allocation: (weights[i] / totalWeight) * totalAmount,
    }));
  },

  /**
   * Format APY as percentage string
   */
  formatAPY(apy: number): string {
    return `${(apy * 100).toFixed(2)}%`;
  },

  /**
   * Format TVL as currency
   */
  formatTVL(tvl: number): string {
    if (tvl >= 1000000) {
      return `$${(tvl / 1000000).toFixed(1)}M`;
    }
    if (tvl >= 1000) {
      return `$${(tvl / 1000).toFixed(1)}K`;
    }
    return `$${tvl.toFixed(0)}`;
  },
};
