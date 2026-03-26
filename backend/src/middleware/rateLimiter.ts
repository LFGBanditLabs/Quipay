import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import Redis from "ioredis";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { createProblemDetails } from "./errorHandler";
import { decodeJwtPayload } from "./rbac";

// Initialize Redis client (optional, falls back to memory store if not configured)
let redisClient: Redis | null = null;
const STELLAR_WALLET_ADDRESS = /^G[A-Z2-7]{55}$/;
const identitySlidingWindowStore = new Map<string, number[]>();

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

function extractStellarAddressFromJwtClaims(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== "string") {
    return null;
  }

  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    return null;
  }

  const payload = decodeJwtPayload(bearerMatch[1]);
  if (!payload) {
    return null;
  }

  const candidates = [
    payload.stellar_address,
    payload.stellarAddress,
    payload.wallet_address,
    payload.walletAddress,
    payload.address,
    payload.sub,
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
  const jwtWallet = extractStellarAddressFromJwtClaims(req);
  if (jwtWallet) {
    return jwtWallet;
  }

  const headerCandidates = [
    req.headers["x-wallet-address"],
    req.headers["x-employer-address"],
    req.headers["x-worker-address"],
    req.headers["x-stellar-address"],
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

function isReadRequest(req: Request): boolean {
  return ["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase());
}

function consumeSlidingWindow(
  key: string,
  now: number,
  windowMs: number,
  maxRequests: number,
): {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
  retryAfterSeconds?: number;
} {
  const windowStart = now - windowMs;
  const activeTimestamps = (identitySlidingWindowStore.get(key) || []).filter(
    (timestamp) => timestamp > windowStart,
  );

  if (activeTimestamps.length >= maxRequests) {
    identitySlidingWindowStore.set(key, activeTimestamps);
    const oldestTimestamp = activeTimestamps[0];
    const resetAtMs = oldestTimestamp + windowMs;
    return {
      allowed: false,
      remaining: 0,
      resetAtMs,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
    };
  }

  activeTimestamps.push(now);
  identitySlidingWindowStore.set(key, activeTimestamps);

  const oldestTimestamp = activeTimestamps[0] ?? now;
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - activeTimestamps.length),
    resetAtMs: oldestTimestamp + windowMs,
  };
}

function getIdentityKey(req: Request): {
  key: string;
  source: "stellar" | "ip";
} {
  const walletAddress = extractWalletAddress(req);
  if (walletAddress) {
    return { key: `stellar:${walletAddress}`, source: "stellar" };
  }

  return { key: `ip:${req.ip || "unknown"}`, source: "ip" };
}

function createIdentityAwareRateLimiter(): RequestHandler {
  const READ_LIMIT = 30;
  const WRITE_LIMIT = 5;
  const WINDOW_MS = 60_000;

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/health" || req.path === "/metrics") {
      return next();
    }

    const { key } = getIdentityKey(req);
    const maxRequests = isReadRequest(req) ? READ_LIMIT : WRITE_LIMIT;
    const result = consumeSlidingWindow(
      key,
      Date.now(),
      WINDOW_MS,
      maxRequests,
    );

    res.setHeader("X-RateLimit-Limit", String(maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(result.remaining));
    res.setHeader(
      "X-RateLimit-Reset",
      String(Math.ceil(result.resetAtMs / 1000)),
    );

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
  identitySlidingWindowStore.clear();
}

const identityAwareRateLimiter = createIdentityAwareRateLimiter();

/**
 * Standard rate limiter for API endpoints.
 * Authenticated users are limited per Stellar address.
 * Unauthenticated users fall back to IP limiting.
 */
export const standardRateLimiter = identityAwareRateLimiter;

/**
 * Strict limiter retains the same identity-aware semantics but is applied on
 * routes that are already sensitive or expensive.
 */
export const strictRateLimiter = identityAwareRateLimiter;

/**
 * Webhook registration uses the same authenticated-vs-IP identity model while
 * inheriting the write quota of 5 requests/minute.
 */
export const webhookRegistrationLimiter = identityAwareRateLimiter;

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
