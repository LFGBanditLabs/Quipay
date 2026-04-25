/**
 * Idempotency Service
 *
 * Provides Redis-backed idempotency for write endpoints.
 * Cached responses are keyed by (endpoint, idempotencyKey) and expire after 24 h.
 *
 * Satisfies acceptance criteria for issue #612.
 */

import Redis from "ioredis";
import { query, getPool } from "../db/pool";
import { serviceLogger } from "../audit/serviceLogger";

/** 24-hour TTL in seconds */
const TTL_SECONDS = 86_400;

export interface CachedIdempotentResponse {
  statusCode: number;
  body: unknown;
  createdAt: string;
}

export class IdempotencyService {
  private redis: Redis | null;

  constructor(redis: Redis | null) {
    this.redis = redis;
  }

  private cacheKey(endpoint: string, idempotencyKey: string): string {
    return `idempotency:${endpoint}:${idempotencyKey}`;
  }

  /**
   * Look up an existing cached response.
   * Returns null when no record exists or when Redis is unavailable.
   */
  async get(
    endpoint: string,
    idempotencyKey: string,
  ): Promise<CachedIdempotentResponse | null> {
    if (!this.redis) return null;

    try {
      const raw = await this.redis.get(this.cacheKey(endpoint, idempotencyKey));
      if (!raw) return null;
      return JSON.parse(raw) as CachedIdempotentResponse;
    } catch (err) {
      await serviceLogger.warn(
        "IdempotencyService",
        "Redis read failed; skipping idempotency cache",
        { idempotency_key: idempotencyKey, error: String(err) },
      );
      return null;
    }
  }

  /**
   * Persist a response in Redis (TTL = 24 h) and in the DB for audit.
   */
  async set(
    endpoint: string,
    idempotencyKey: string,
    statusCode: number,
    body: unknown,
  ): Promise<void> {
    const payload: CachedIdempotentResponse = {
      statusCode,
      body,
      createdAt: new Date().toISOString(),
    };

    if (this.redis) {
      try {
        await this.redis.set(
          this.cacheKey(endpoint, idempotencyKey),
          JSON.stringify(payload),
          "EX",
          TTL_SECONDS,
        );
      } catch (err) {
        await serviceLogger.warn(
          "IdempotencyService",
          "Redis write failed; response will not be cached",
          { idempotency_key: idempotencyKey, error: String(err) },
        );
      }
    }

    // Persist for audit even when Redis is unavailable
    if (getPool()) {
      try {
        await query(
          `INSERT INTO idempotency_keys (idempotency_key, endpoint, status_code, response_body, expires_at)
           VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours')
           ON CONFLICT (idempotency_key, endpoint) DO NOTHING`,
          [idempotencyKey, endpoint, statusCode, JSON.stringify(body)],
        );
      } catch (err) {
        await serviceLogger.warn(
          "IdempotencyService",
          "DB write for idempotency key failed",
          { idempotency_key: idempotencyKey, error: String(err) },
        );
      }
    }
  }
}

let _instance: IdempotencyService | null = null;

export function getIdempotencyService(): IdempotencyService {
  if (!_instance) {
    let redis: Redis | null = null;
    if (process.env.REDIS_URL) {
      try {
        redis = new Redis(process.env.REDIS_URL, {
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        });
      } catch {
        redis = null;
      }
    }
    _instance = new IdempotencyService(redis);
  }
  return _instance;
}

/** Replace the singleton (useful in tests). */
export function setIdempotencyService(svc: IdempotencyService): void {
  _instance = svc;
}
