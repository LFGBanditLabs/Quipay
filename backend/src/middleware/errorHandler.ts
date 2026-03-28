import { Request, Response, NextFunction } from "express";

/**
 * RFC 7807 Problem Details interface
 * https://datatracker.ietf.org/doc/html/rfc7807
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  [key: string]: any; // Allow additional properties
}

/**
 * Creates a standardized RFC 7807 Problem Details response
 */
export function createProblemDetails(params: {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  [key: string]: any;
}): ProblemDetails {
  const { type, title, status, detail, instance, ...additionalProps } = params;

  return {
    type: `https://quipay.io/errors/${type}`,
    title,
    status,
    detail,
    instance,
    ...additionalProps,
  };
}

/**
 * Maps database-level error codes to HTTP status codes.
 *
 * PostgreSQL error code 57014 = query_canceled (statement_timeout exceeded).
 * Returning 503 with a Retry-After hint signals transient availability issues
 * and satisfies acceptance criteria for issue #613.
 */
function mapDbErrorToStatus(err: any): {
  status: number;
  retryAfter?: number;
} {
  const pgCode: string | undefined = err?.code;

  if (pgCode === "57014") {
    // query_canceled – statement_timeout exceeded
    return { status: 503, retryAfter: 5 };
  }
  if (pgCode === "53300") {
    // too_many_connections – pool exhausted
    return { status: 503, retryAfter: 2 };
  }

  return { status: err.status || err.statusCode || 500 };
}

/**
 * Global error handler middleware
 * Converts errors to RFC 7807 Problem Details format
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // If headers already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  const { status, retryAfter } = mapDbErrorToStatus(err);
  const message =
    status === 503 && err?.code === "57014"
      ? "The database query exceeded its time limit. Please retry."
      : err.message || "An unexpected error occurred";

  if (retryAfter !== undefined) {
    res.setHeader("Retry-After", String(retryAfter));
  }

  const problem = createProblemDetails({
    type: status === 503 ? "service-unavailable" : err.type || "internal-error",
    title:
      status === 503
        ? "Service Unavailable"
        : err.title || "Internal Server Error",
    status,
    detail: message,
    instance: req.originalUrl,
    ...(err.errors && { errors: err.errors }), // Include validation errors if present
    ...(retryAfter !== undefined && {
      retryHint: `Retry after ${retryAfter} seconds`,
    }),
  });

  // Log error for debugging (in production, use proper logging)
  console.error("[ErrorHandler]", {
    error: err,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  res.status(status).json(problem);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const problem = createProblemDetails({
    type: "not-found",
    title: "Not Found",
    status: 404,
    detail: `The requested resource '${req.originalUrl}' was not found`,
    instance: req.originalUrl,
  });

  res.status(404).json(problem);
}
