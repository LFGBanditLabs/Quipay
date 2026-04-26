import Redis from "ioredis";
import { globalCache } from "../utils/cache";

type PayrollSummaryValue = unknown;

let redisClient: Redis | null | undefined;

const getRedisClient = (): Redis | null => {
  if (redisClient !== undefined) {
    return redisClient;
  }

  if (!process.env.REDIS_URL) {
    redisClient = null;
    return redisClient;
  }

  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    void redisClient.connect().catch(() => {
      redisClient = null;
    });
  } catch {
    redisClient = null;
  }

  return redisClient;
};

export const getCachedPayrollSummary = async <T = PayrollSummaryValue>(
  key: string,
): Promise<T | null> => {
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(key);
      if (raw) {
        return JSON.parse(raw) as T;
      }
    } catch {
      redisClient = null;
    }
  }

  return globalCache.get<T>(key);
};

export const setCachedPayrollSummary = async <T = PayrollSummaryValue>(
  key: string,
  value: T,
  ttlMs: number,
): Promise<void> => {
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), "PX", ttlMs);
    } catch {
      redisClient = null;
    }
  }

  globalCache.set(key, value, ttlMs);
};

export const invalidatePayrollSummaryCache = async (
  orgId: string,
): Promise<void> => {
  const prefix = `payroll-summary:${orgId}:`;
  const redis = getRedisClient();

  if (redis) {
    try {
      const keys = await redis.keys(`${prefix}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {
      redisClient = null;
    }
  }

  globalCache.invalidateByPrefix(prefix);
};
