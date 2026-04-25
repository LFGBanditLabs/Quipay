/**
 * Idempotency Middleware
 *
 * Reads the optional `Idempotency-Key` request header and, when present:
 *   - Returns the cached response immediately on a duplicate submission.
 *   - Captures the outbound response body and stores it after a successful request.
 *
 * Satisfies acceptance criteria for issue #612.
 */

import { Request, Response, NextFunction } from "express";
import { getIdempotencyService } from "../services/idempotencyService";

/** Validate that a key looks like a UUID v4 (loose check). */
function isValidIdempotencyKey(key: string): boolean {
  return /^[0-9a-f-]{8,64}$/i.test(key);
}

/**
 * Factory that returns an idempotency middleware bound to a specific endpoint
 * label (e.g. "POST /streams").  Using an explicit label rather than the live
 * req.path keeps the cache key stable even when the route has path parameters.
 */
export function idempotencyMiddleware(endpoint: string) {
  return async function (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const rawKey = req.headers["idempotency-key"] as string | undefined;

    // No header → pass through unchanged
    if (!rawKey) {
      next();
      return;
    }

    if (!isValidIdempotencyKey(rawKey)) {
      res.status(400).json({
        error: "Invalid Idempotency-Key format. Expected a UUID.",
      });
      return;
    }

    const svc = getIdempotencyService();

    // ── Cache hit → replay stored response ───────────────────────────────────
    const cached = await svc.get(endpoint, rawKey);
    if (cached) {
      res.setHeader("X-Idempotency-Replayed", "true");
      res.status(cached.statusCode).json(cached.body);
      return;
    }

    // ── Cache miss → intercept the response before sending it downstream ─────
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown) {
      // Fire-and-forget persistence; errors are swallowed by the service layer
      void svc.set(endpoint, rawKey, res.statusCode, body);
      return originalJson(body);
    };

    next();
  };
}
