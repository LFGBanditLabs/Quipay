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

  // Default to 500 Internal Server Error
  const status = err.status || err.statusCode || 500;
  const message = err.message || "An unexpected error occurred";

  const problem = createProblemDetails({
    type: err.type || "internal-error",
    title: err.title || "Internal Server Error",
    status,
    detail: message,
    instance: req.originalUrl,
    ...(err.errors && { errors: err.errors }), // Include validation errors if present
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
