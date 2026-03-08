import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger";

declare module "express-serve-static-core" {
  interface Request {
    correlationId?: string;
  }
}

/**
 * Middleware to generate or propagate X-Correlation-ID for every incoming request
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Get correlation ID from request header or generate a new one
  const correlationId = req.get("X-Correlation-ID") || uuidv4();

  // Add to request object for easy access
  req.correlationId = correlationId;

  // Set response header for client-side tracking
  res.setHeader("X-Correlation-ID", correlationId);

  // Set logger context for this request
  logger.updateContext({
    correlationId,
    requestId: uuidv4(),
    method: req.method,
    url: req.url,
    userAgent: req.get("User-Agent"),
    ip: req.ip || req.connection.remoteAddress,
  });

  // Log request start
  logger.info("Incoming request", {
    method: req.method,
    url: req.url,
    correlationId,
  });

  // Override res.end to log request completion
  const originalEnd = res.end.bind(res);
  res.end = function (chunk?: any, encoding?: any, cb?: any) {
    logger.info("Request completed", {
      method: req.method,
      url: req.url,
      correlationId,
      statusCode: res.statusCode,
    });

    // Call original end with proper signature
    return originalEnd(chunk, encoding, cb);
  };

  next();
}

/**
 * Utility function to run async operations with correlation context
 */
export function withCorrelationContext<T>(
  correlationId: string,
  fn: () => T,
): T {
  return logger.withContext({ correlationId }, fn);
}

/**
 * Utility function to get current correlation ID
 */
export function getCurrentCorrelationId(): string | undefined {
  return logger.getCurrentContext().correlationId;
}
