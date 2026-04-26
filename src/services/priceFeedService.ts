/**
 * Price Feed Service
 * Integrates multiple price feed providers (Band, Pyth, CoinGecko) with caching
 */

import type {
  PriceFeedData,
  PriceFeedConfig,
} from "../types/treasuryAnalytics";

// Mock price data for development/testing
const MOCK_PRICES: Record<string, { price: number; change24h: number }> = {
  USDC: { price: 1.0, change24h: 0.01 },
  USD: { price: 1.0, change24h: 0.01 },
  EURC: { price: 1.08, change24h: 0.05 },
  XLM: { price: 12.5, change24h: 2.3 },
  BTC: { price: 66432.5, change24h: -1.2 },
  ETH: { price: 3542.8, change24h: 0.8 },
  BRL: { price: 0.2, change24h: 0.1 },
  INR: { price: 0.012, change24h: 0.02 },
};

// Price cache with timestamps
const priceCache = new Map<string, PriceFeedData & { cachedAt: number }>();

/**
 * Validate if cached price is still fresh
 */
function isCacheFresh(
  cachedData: (PriceFeedData & { cachedAt: number }) | undefined,
  ttl: number,
): boolean {
  if (!cachedData) return false;
  return Date.now() - cachedData.cachedAt < ttl;
}

/**
 * Fetch price from CoinGecko API
 * Reliable but can be rate-limited
 */
async function fetchFromCoinGecko(
  tokenSymbol: string,
): Promise<{ price: number; change24h: number } | null> {
  try {
    // Map token symbols to CoinGecko IDs
    const coinGeckoIds: Record<string, string> = {
      USDC: "usd-coin",
      XLM: "stellar",
      BTC: "bitcoin",
      ETH: "ethereum",
      EURC: "euro-coin",
      BRL: "brazilian-real", // Placeholder for demo
      INR: "indian-rupee", // Placeholder for demo
    };

    const coinId = coinGeckoIds[tokenSymbol];
    if (!coinId) return null;

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(5000) },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as Record<
      string,
      { usd: number; usd_24h_change: number }
    >;
    const priceData = data[coinId];

    if (!priceData) return null;

    return {
      price: priceData.usd,
      change24h: priceData.usd_24h_change,
    };
  } catch (error) {
    console.warn(`Failed to fetch ${tokenSymbol} from CoinGecko:`, error);
    return null;
  }
}

/**
 * Simulate Band Protocol feed integration
 * In production, this would call the actual Band contract on Stellar
 */
function fetchFromBand(
  tokenSymbol: string,
): { price: number; confidence: number } | null {
  // In a real implementation:
  // 1. Call Band's Stellar contract (e.g., via Soroban RPC)
  // 2. Decode the price data
  // 3. Return with confidence interval
  // For now, return mock data
  const mock = MOCK_PRICES[tokenSymbol];
  if (!mock) return null;
  return {
    price: mock.price,
    confidence: 0.01, // 1% confidence interval
  };
}

/**
 * Simulate Pyth Network feed integration
 * In production, this would call Pyth's contract on Soroban
 */
function fetchFromPyth(
  tokenSymbol: string,
): { price: number; confidence: number } | null {
  // Similar to Band but using Pyth contract/API
  // Pyth provides very low latency price feeds with confidence intervals
  const mock = MOCK_PRICES[tokenSymbol];
  if (!mock) return null;
  return {
    price: mock.price,
    confidence: 0.001, // 0.1% confidence interval
  };
}

/**
 * Get price from configured provider or fallback chain
 */
async function fetchPrice(
  tokenSymbol: string,
  config: PriceFeedConfig,
): Promise<PriceFeedData | null> {
  const now = new Date().toISOString();

  // Try primary provider
  try {
    switch (config.provider) {
      case "band": {
        const data = fetchFromBand(tokenSymbol);
        if (data) {
          return {
            tokenSymbol,
            price: data.price,
            timestamp: now,
            source: "band",
            confidence: data.confidence,
          };
        }
        break;
      }

      case "pyth": {
        const data = fetchFromPyth(tokenSymbol);
        if (data) {
          return {
            tokenSymbol,
            price: data.price,
            timestamp: now,
            source: "pyth",
            confidence: data.confidence,
          };
        }
        break;
      }

      case "coingecko": {
        const data = await fetchFromCoinGecko(tokenSymbol);
        if (data) {
          return {
            tokenSymbol,
            price: data.price,
            timestamp: now,
            source: "coingecko",
          };
        }
        break;
      }

      case "mock": {
        const mock = MOCK_PRICES[tokenSymbol];
        if (mock) {
          return {
            tokenSymbol,
            price: mock.price,
            timestamp: now,
            source: "cached",
          };
        }
        break;
      }
    }
  } catch (error) {
    console.warn(
      `Failed to fetch ${tokenSymbol} from ${config.provider}:`,
      error,
    );
  }

  // Fallback to configured prices
  if (config.fallbackPrices?.[tokenSymbol]) {
    return {
      tokenSymbol,
      price: config.fallbackPrices[tokenSymbol],
      timestamp: now,
      source: "cached",
    };
  }

  // Fallback to mock
  const mock = MOCK_PRICES[tokenSymbol];
  if (mock) {
    return {
      tokenSymbol,
      price: mock.price,
      timestamp: now,
      source: "cached",
    };
  }

  return null;
}

export const priceFeedService = {
  /**
   * Get price for a token with caching
   */
  async getPrice(
    tokenSymbol: string,
    config: PriceFeedConfig | undefined = undefined,
  ): Promise<PriceFeedData | null> {
    const cfg = config || { provider: "mock", cacheTTL: 60000 };
    const cacheKey = `price_${tokenSymbol}`;
    const cached = priceCache.get(cacheKey);

    // Return cached if fresh
    if (isCacheFresh(cached, cfg.cacheTTL)) {
      return cached || null;
    }

    // Fetch new price
    const fresh = await fetchPrice(tokenSymbol, cfg);
    if (fresh) {
      priceCache.set(cacheKey, { ...fresh, cachedAt: Date.now() });
    }

    return fresh;
  },

  /**
   * Get prices for multiple tokens
   */
  async getPrices(
    tokenSymbols: string[],
    config?: PriceFeedConfig,
  ): Promise<Map<string, PriceFeedData>> {
    const results = new Map<string, PriceFeedData>();
    const prices = await Promise.all(
      tokenSymbols.map((sym) => this.getPrice(sym, config)),
    );

    tokenSymbols.forEach((sym, i) => {
      const price = prices[i];
      if (price) {
        results.set(sym, price);
      }
    });

    return results;
  },

  /**
   * Get 24h price change (mock for now)
   */
  getPriceChange24h(tokenSymbol: string): number {
    return MOCK_PRICES[tokenSymbol]?.change24h ?? 0;
  },

  /**
   * Invalidate cache for a token
   */
  invalidateCache(tokenSymbol: string): void {
    priceCache.delete(`price_${tokenSymbol}`);
  },

  /**
   * Invalidate all cache
   */
  invalidateAllCache(): void {
    priceCache.clear();
  },

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): Record<string, { cached: boolean; age: number }> {
    const status: Record<string, { cached: boolean; age: number }> = {};
    priceCache.forEach((value, key) => {
      status[key] = {
        cached: true,
        age: Date.now() - value.cachedAt,
      };
    });
    return status;
  },

  /**
   * Convert token amount to USD equivalent
   */
  async convertToUsd(
    amount: number,
    tokenSymbol: string,
    config?: PriceFeedConfig,
  ): Promise<number | null> {
    const priceData = await this.getPrice(tokenSymbol, config);
    if (!priceData) return null;
    return amount * priceData.price;
  },

  /**
   * Batch convert multiple assets to USD
   */
  async convertMultipleToUsd(
    amounts: Record<string, number>,
    config?: PriceFeedConfig,
  ): Promise<{ total: number; breakdown: Record<string, number> }> {
    const breakdown: Record<string, number> = {};
    let total = 0;

    const prices = await this.getPrices(Object.keys(amounts), config);

    for (const [token, amount] of Object.entries(amounts)) {
      const price = prices.get(token);
      if (price) {
        const usdValue = amount * price.price;
        breakdown[token] = usdValue;
        total += usdValue;
      }
    }

    return { total, breakdown };
  },
};
