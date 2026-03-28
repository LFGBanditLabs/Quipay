/**
 * HTTP Request Logger Middleware
 *
 * Emits one structured JSON log line per HTTP request containing:
 * correlationId, walletAddress, method, path, statusCode, durationMs.
 *
 * Satisfies acceptance criteria for issue #611.
 */

import { Request, Response, NextFunction } from "express";
import { serviceLogger } from "../audit/serviceLogger";
import { requestContext } from "./requestId";

export function httpLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startTime;
    const store = requestContext.getStore();

    void serviceLogger.info("HttpRequest", `${req.method} ${req.path}`, {
      correlation_id: store?.correlationId,
      request_id: store?.requestId,
      wallet_address: store?.walletAddress,
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
      duration_ms: durationMs,
    });
  });

  next();
}
