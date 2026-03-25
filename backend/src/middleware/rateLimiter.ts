import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import Redis from "ioredis";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { createProblemDetails } from "./errorHandler";

// Initialize Redis client (optional, falls back to memory store if not configured)
let redisClient: Redis | null = null;
const STELLAR_WALLET_ADDRESS = /^G[A-Z2-7]{55}$/;
const walletSlidingWindowStore = new Map<string, number[]>();

if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
    });

    redisClient.on("error", (err: Error) => {
      console.error("[RateLimiter] Redis connection error:", err);
    });

    redisClient.on("connect", () => {
      console.log("[RateLimiter] ✅ Connected to Redis for rate limiting");
    });
  } catch (error) {
    console.error("[RateLimiter] Failed to initialize Redis:", error);
    redisClient = null;
  }
}

/**
 * Custom handler for rate limit exceeded responses
 * Returns RFC 7807 Problem Details format
 */
const rateLimitHandler = (req: Request, res: Response) => {
  const problem = createProblemDetails({
    type: "rate-limit-exceeded",
    title: "Too Many Requests",
    status: 429,
    detail: "You have exceeded the rate limit. Please try again later.",
    instance: req.originalUrl,
    retryAfter: res.getHeader("Retry-After") as string,
  });

  res.status(429).json(problem);
};

function normalizeWalletCandidate(candidate: unknown): string | null {
  if (Array.isArray(candidate)) {
    for (const value of candidate) {
      const normalized = normalizeWalletCandidate(value);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  if (typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }

  const bearerMatch = trimmed.match(/^Bearer\s+(.+)$/i);
  const maybeWallet = bearerMatch ? bearerMatch[1].trim() : trimmed;

  return STELLAR_WALLET_ADDRESS.test(maybeWallet) ? maybeWallet : null;
}

function extractWalletFromRecord(
  record: Record<string, unknown> | undefined,
): string | null {
  if (!record) {
    return null;
  }

  const candidates = [
    record.wallet,
    record.walletAddress,
    record.wallet_address,
    record.employer,
    record.worker,
    record.address,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeWalletCandidate(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function extractWalletAddress(req: Request): string | null {
  const headerCandidates = [
    req.headers["x-wallet-address"],
    req.headers["x-employer-address"],
    req.headers["x-worker-address"],
    req.headers.authorization,
  ];

  for (const candidate of headerCandidates) {
    const normalized = normalizeWalletCandidate(candidate);
    if (normalized) {
      return normalized;
    }
  }

  const bodyWallet = extractWalletFromRecord(
    req.body && typeof req.body === "object"
      ? (req.body as Record<string, unknown>)
      : undefined,
  );
  if (bodyWallet) {
    return bodyWallet;
  }

  const paramsWallet = extractWalletFromRecord(
    req.params as Record<string, unknown>,
  );
  if (paramsWallet) {
    return paramsWallet;
  }

  return extractWalletFromRecord(
    req.query as Record<string, unknown> | undefined,
  );
}

function consumeWalletWindow(
  key: string,
  now: number,
  windowMs: number,
  maxRequests: number,
): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
} {
  const windowStart = now - windowMs;
  const activeTimestamps = (walletSlidingWindowStore.get(key) || []).filter(
    (timestamp) => timestamp > windowStart,
  );

  if (activeTimestamps.length >= maxRequests) {
    walletSlidingWindowStore.set(key, activeTimestamps);
    const oldestTimestamp = activeTimestamps[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((oldestTimestamp + windowMs - now) / 1000),
      ),
    };
  }

  activeTimestamps.push(now);
  walletSlidingWindowStore.set(key, activeTimestamps);

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - activeTimestamps.length),
  };
}

function chainRateLimiters(...middlewares: RequestHandler[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    let index = 0;

    const run = (err?: unknown) => {
      if (err) {
        return next(err);
      }

      const middleware = middlewares[index];
      index += 1;

      if (!middleware) {
        return next();
      }

      return middleware(req, res, run);
    };

    run();
  };
}

export function createWalletSlidingWindowRateLimiter(
  maxRequests: number,
  windowMs: number,
  prefix: string,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const walletAddress = extractWalletAddress(req);

    if (!walletAddress) {
      return next();
    }

    const key = `${prefix}:${walletAddress}`;
    const result = consumeWalletWindow(key, Date.now(), windowMs, maxRequests);

    res.setHeader("X-RateLimit-Remaining", String(result.remaining));

    if (!result.allowed) {
      if (result.retryAfterSeconds) {
        res.setHeader("Retry-After", String(result.retryAfterSeconds));
      }
      return rateLimitHandler(req, res);
    }

    return next();
  };
}

export function resetWalletRateLimiterStore(): void {
  walletSlidingWindowStore.clear();
}

/**
 * Standard rate limiter for general API endpoints
 * 100 requests per 15 minutes per IP
 */
const standardIpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === "/health" || req.path === "/metrics";
  },
  ...(redisClient && {
    store: new RedisStore({
      sendCommand: (async (...args: any[]) =>
        await redisClient!.call(...(args as [any, ...any[]]))) as any,
      prefix: "rl:standard:",
    }),
  }),
});
const standardWalletRateLimiter = createWalletSlidingWindowRateLimiter(
  100,
  15 * 60 * 1000,
  "wallet:standard",
);
export const standardRateLimiter = chainRateLimiters(
  standardIpRateLimiter,
  standardWalletRateLimiter,
);

/**
 * Strict rate limiter for expensive operations (AI, webhooks)
 * 20 requests per 15 minutes per IP
 */
const strictIpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  ...(redisClient && {
    store: new RedisStore({
      sendCommand: (async (...args: any[]) =>
        await redisClient!.call(...(args as [any, ...any[]]))) as any,
      prefix: "rl:strict:",
    }),
  }),
});
const strictWalletRateLimiter = createWalletSlidingWindowRateLimiter(
  20,
  15 * 60 * 1000,
  "wallet:strict",
);
export const strictRateLimiter = chainRateLimiters(
  strictIpRateLimiter,
  strictWalletRateLimiter,
);

/**
 * Very strict rate limiter for webhook registration
 * 5 requests per hour per IP
 */
const webhookRegistrationIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  ...(redisClient && {
    store: new RedisStore({
      sendCommand: (async (...args: any[]) =>
        await redisClient!.call(...(args as [any, ...any[]]))) as any,
      prefix: "rl:webhook:",
    }),
  }),
});
const webhookRegistrationWalletRateLimiter =
  createWalletSlidingWindowRateLimiter(5, 60 * 60 * 1000, "wallet:webhook");
export const webhookRegistrationLimiter = chainRateLimiters(
  webhookRegistrationIpLimiter,
  webhookRegistrationWalletRateLimiter,
);

/**
 * API key-based rate limiter (for future use with API keys)
 * Can be extended to track by API key instead of IP
 */
export const createApiKeyRateLimiter = (
  maxRequests: number,
  windowMs: number,
) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    keyGenerator: (req: Request) => {
      // Use API key from header if present, otherwise fall back to IP
      const apiKey = req.headers["x-api-key"] as string;
      return apiKey || req.ip || "unknown";
    },
    ...(redisClient && {
      store: new RedisStore({
        sendCommand: (async (...args: any[]) =>
          await redisClient!.call(...(args as [any, ...any[]]))) as any,
        prefix: "rl:apikey:",
      }),
    }),
  });
};

/**
 * Cleanup function to close Redis connection gracefully
 */
export const closeRateLimiterRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    console.log("[RateLimiter] Redis connection closed");
  }
};
