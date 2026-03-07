import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import Redis from "ioredis";
import { Request, Response } from "express";
import { createProblemDetails } from "./errorHandler";

// Initialize Redis client (optional, falls back to memory store if not configured)
let redisClient: Redis | null = null;

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

/**
 * Standard rate limiter for general API endpoints
 * 100 requests per 15 minutes per IP
 */
export const standardRateLimiter = rateLimit({
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

/**
 * Strict rate limiter for expensive operations (AI, webhooks)
 * 20 requests per 15 minutes per IP
 */
export const strictRateLimiter = rateLimit({
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

/**
 * Very strict rate limiter for webhook registration
 * 5 requests per hour per IP
 */
export const webhookRegistrationLimiter = rateLimit({
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
