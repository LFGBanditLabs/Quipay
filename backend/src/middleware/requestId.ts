import { Request, Response, NextFunction } from "express";
import { AsyncLocalStorage } from "async_hooks";
import crypto from "crypto";

export interface RequestContextStore {
  requestId: string;
  /** RFC-compliant correlation identifier; defaults to requestId when not supplied by caller */
  correlationId: string;
  /** Authenticated wallet / user address, populated by auth middleware */
  walletAddress?: string;
  /** HTTP method of the incoming request */
  method?: string;
  /** URL path of the incoming request */
  path?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const existingRequestId = req.headers["x-request-id"] as string | undefined;
  const existingCorrelationId = req.headers["x-correlation-id"] as
    | string
    | undefined;

  const requestId = existingRequestId || crypto.randomUUID();
  // Honour inbound X-Correlation-ID; fall back to requestId so every log line
  // always carries a correlation identifier.
  const correlationId = existingCorrelationId || requestId;

  // Echo both identifiers in response headers so callers can trace requests
  res.setHeader("X-Request-ID", requestId);
  res.setHeader("X-Correlation-ID", correlationId);

  const store: RequestContextStore = {
    requestId,
    correlationId,
    method: req.method,
    path: req.path,
  };

  // Expose request context to the async execution tree (e.g. serviceLogger)
  requestContext.run(store, () => {
    next();
  });
}

/**
 * Attach the authenticated wallet address to the current request context so
 * every downstream log line can include it without passing it explicitly.
 */
export function setWalletAddressInContext(walletAddress: string): void {
  const store = requestContext.getStore();
  if (store) {
    store.walletAddress = walletAddress;
  }
}
