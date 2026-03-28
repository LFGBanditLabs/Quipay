/**
 * usePriceFeed Hook
 * Fetches current prices for tokens from Band or Pyth price feeds
 */

import { useState, useEffect, useCallback } from "react";
import type { PriceData } from "../types/treasuryAnalytics";

// Fallback prices for common tokens (update regularly in production)
const FALLBACK_PRICES: Record<string, number> = {
  XLM: 0.11,
  USDC: 1.0,
  EURC: 1.08,
  USDT: 1.0,
  BTC: 62500,
  ETH: 2500,
};

// Band Protocol API
const BAND_API_URL = "https://laozi1.bandchain.org/api/v1/oracle/prices";
const BAND_SYMBOLS: Record<string, string> = {
  XLM: "STELLAR",
  USDC: "USDC",
  EURC: "EURC",
  USDT: "USDT",
  BTC: "BTC",
  ETH: "ETH",
};

/**
 * Fetch price from Band Protocol
 */
async function fetchBandPrice(symbol: string): Promise<PriceData | null> {
  try {
    const bandSymbol = BAND_SYMBOLS[symbol] || symbol;
    const response = await fetch(
      `${BAND_API_URL}?symbols=${bandSymbol}&min_count=10&ask_count=16`,
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      result?: Array<{
        symbol: string;
        px: string;
        last_updated_base: number;
      }> | null;
    };

    if (!data.result || data.result.length === 0) return null;

    const result = data.result[0];
    return {
      symbol,
      usdPrice: parseFloat(result.px),
      timestamp: result.last_updated_base,
      source: "band",
    };
  } catch {
    return null;
  }
}

/**
 * Fetch price with fallback
 */
async function fetchPrice(symbol: string): Promise<PriceData> {
  const bandPrice = await fetchBandPrice(symbol);
  if (bandPrice) return bandPrice;

  // Use fallback price
  return {
    symbol,
    usdPrice: FALLBACK_PRICES[symbol] || 0,
    timestamp: Date.now(),
    source: "fallback",
  };
}

interface UsePriceFeedOptions {
  symbols: string[];
  updateInterval?: number;
  enabled?: boolean;
}

interface UsePriceFeedResult {
  prices: Record<string, PriceData>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and cache price feeds for multiple tokens
 */
export function usePriceFeed(options: UsePriceFeedOptions): UsePriceFeedResult {
  const { symbols, updateInterval = 60000, enabled = true } = options;
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled || symbols.length === 0) return;

    try {
      setError(null);
      const fetchedPrices = await Promise.all(
        symbols.map((symbol) => fetchPrice(symbol)),
      );

      const priceMap = fetchedPrices.reduce(
        (acc, priceData) => {
          acc[priceData.symbol] = priceData;
          return acc;
        },
        {} as Record<string, PriceData>,
      );

      setPrices(priceMap);
      setLoading(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch prices";
      setError(message);
      setLoading(false);
    }
  }, [symbols, enabled]);

  useEffect(() => {
    if (!enabled || symbols.length === 0) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();

    if (updateInterval === 0) return;

    const interval = setInterval(() => {
      void refetch();
    }, updateInterval);

    return () => clearInterval(interval);
  }, [symbols, enabled, updateInterval, refetch]);

  return { prices, loading, error, refetch };
}
