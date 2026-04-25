/**
 * HTTP Request Logger Middleware
 *
 * Emits one structured JSON log line per HTTP request containing:
 * correlationId, walletAddress, method, path, statusCode, durationMs.
 *
 * Satisfies acceptance criteria for issue #611.
 */

import { Request, Response, NextFunction } from "express";
import { requestContext } from "./requestId";
import { logger } from "../logger";

export function httpLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startTime;
    const store = requestContext.getStore();

    logger.info({
      event: "http_request",
      requestId: store?.requestId,
      correlationId: store?.correlationId,
      walletAddress: store?.walletAddress,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
    });
  });

  next();
}
