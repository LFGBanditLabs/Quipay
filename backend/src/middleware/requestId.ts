import { Request, Response, NextFunction } from "express";
import { AsyncLocalStorage } from "async_hooks";
import crypto from "crypto";

export const requestContext = new AsyncLocalStorage<{ requestId: string }>();

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const existingId = req.headers["x-request-id"] as string;
  const requestId = existingId || crypto.randomUUID();

  // Return X-Request-ID in response headers
  res.setHeader("X-Request-ID", requestId);

  // Expose request context to the async execution tree (e.g. serviceLogger)
  requestContext.run({ requestId }, () => {
    next();
  });
}
