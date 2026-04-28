/**
 * useYieldOpportunities Hook
 * Identifies yield generation opportunities for idle treasury funds
 */

import { useMemo } from "react";
import type { YieldOpportunity } from "../types/treasuryAnalytics";
import type { TokenVaultData } from "../contracts/payroll_vault";
import type { PriceData } from "../types/treasuryAnalytics";

// Known yield opportunities on Stellar/Soroban ecosystem
const YIELD_OPPORTUNITIES: Record<string, YieldOpportunity[]> = {
  XLM: [
    {
      id: "stellar-lp-1",
      name: "Stellar DEX Liquidity",
      description: "Provide liquidity for XLM trading pairs on Stellar DEX.",
      protocol: "Stellar DEX",
      symbol: "XLM",
      supportedAssets: ["XLM"],
      apy: 8.5,
      tvl: 50000000,
      riskLevel: "low",
      lockupPeriod: 0,
      minDeposit: 100,
      idleFunds: 0,
      potentialYield: 0,
      supportedNetworks: ["mainnet", "testnet"],
      verified: true,
    },
    {
      id: "soroswap-xlm",
      name: "SoroSwap XLM Pool",
      description: "Earn yield by staking XLM in the SoroSwap AMM pool.",
      protocol: "SoroSwap",
      symbol: "XLM",
      supportedAssets: ["XLM"],
      apy: 12.5,
      tvl: 25000000,
      riskLevel: "medium",
      lockupPeriod: 0,
      minDeposit: 50,
      idleFunds: 0,
      potentialYield: 0,
      supportedNetworks: ["mainnet"],
      verified: false,
    },
  ],
  USDC: [
    {
      id: "stellar-stable-1",
      name: "Stellar Stable Yield",
      description: "Deposit USDC into stable yield pools on Stellar.",
      protocol: "Stellar Stable",
      symbol: "USDC",
      supportedAssets: ["USDC"],
      apy: 5.0,
      tvl: 100000000,
      riskLevel: "low",
      lockupPeriod: 0,
      minDeposit: 1000,
      idleFunds: 0,
      potentialYield: 0,
      supportedNetworks: ["mainnet", "testnet"],
      verified: true,
    },
    {
      id: "lend-protocol",
      name: "Lend Protocol",
      description: "Short-duration USDC lending for predictable yield.",
      protocol: "Lend Protocol",
      symbol: "USDC",
      supportedAssets: ["USDC"],
      apy: 8.2,
      tvl: 75000000,
      riskLevel: "medium",
      lockupPeriod: 7,
      minDeposit: 500,
      idleFunds: 0,
      potentialYield: 0,
      supportedNetworks: ["mainnet"],
      verified: false,
    },
  ],
};

interface UseYieldOpportunitiesOptions {
  vaultData: TokenVaultData[];
  priceData: Record<string, PriceData>;
  minIdleFundsUSD?: number;
  decimals?: Record<string, number>;
}

interface UseYieldOpportunitiesResult {
  opportunities: YieldOpportunity[];
  totalPotentialYield: number;
  topOpportunity: YieldOpportunity | null;
}

/**
 * Calculate potential yield for an opportunity
 */
function calculatePotentialYield(idleFundsUSD: number, apy: number): number {
  return (idleFundsUSD * apy) / 100;
}

/**
 * Hook to identify and calculate yield opportunities
 */
export function useYieldOpportunities(
  options: UseYieldOpportunitiesOptions,
): UseYieldOpportunitiesResult {
  const {
    vaultData,
    priceData,
    minIdleFundsUSD = 5000,
    decimals: decimalsMap = {},
  } = options;

  const result = useMemo(() => {
    const opportunities: YieldOpportunity[] = [];

    vaultData.forEach((vault) => {
      const tokenDecimals = decimalsMap[vault.tokenSymbol] || 7;
      const available = Number(vault.available) / Math.pow(10, tokenDecimals);
      const price = priceData[vault.tokenSymbol];
      const priceUSD = price?.usdPrice || 1;
      const idleFundsUSD = available * priceUSD;

      if (idleFundsUSD < minIdleFundsUSD) {
        return;
      }

      const tokenOpportunities = YIELD_OPPORTUNITIES[vault.tokenSymbol] || [];

      tokenOpportunities.forEach((opp) => {
        const potentialYield = calculatePotentialYield(idleFundsUSD, opp.apy);
        opportunities.push({
          ...opp,
          idleFunds: available,
          potentialYield,
        });
      });
    });

    // Sort by potential yield (highest first)
    opportunities.sort((a, b) => b.potentialYield - a.potentialYield);

    const totalPotentialYield = opportunities.reduce(
      (sum, opp) => sum + opp.potentialYield,
      0,
    );
    const topOpportunity = opportunities.length > 0 ? opportunities[0] : null;

    return {
      opportunities,
      totalPotentialYield,
      topOpportunity,
    };
  }, [vaultData, priceData, minIdleFundsUSD, decimalsMap]);

  return result;
}
