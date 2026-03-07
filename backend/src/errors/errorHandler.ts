import { Request, Response, NextFunction } from "express";
import { AppError } from "./AppError";

/**
 * Standard API error response shape.
 * Every error returned from the API follows this strict schema.
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ─── 404 Catch-All ───────────────────────────────────────────────────────────

/**
 * Catches requests to undefined routes and converts them to a structured
 * 404 response. Mount AFTER all route definitions.
 */
export function notFoundHandler(req: Request, res: Response): void {
  const body: ErrorResponse = {
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  };
  res.status(404).json(body);
}

// ─── Global Error Handler ────────────────────────────────────────────────────

/**
 * Centralized Express error-handling middleware.
 *
 * Handles both:
 *  - Operational `AppError` subclasses → structured JSON response
 *  - Unknown programming errors → generic 500 to avoid leaking internals
 *
 * Mount as the LAST middleware in your Express app (after all routes).
 */
export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Log every error for observability
  console.error(
    `[ErrorHandler] ${req.method} ${req.originalUrl} → ${err.name}: ${err.message}`,
    err instanceof AppError
      ? { code: err.code, statusCode: err.statusCode }
      : {},
  );

  // Operational errors: safe to forward details to the client
  if (err instanceof AppError) {
    const body: ErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // Async route errors: Express doesn't catch promise rejections automatically
  // in older setups, so we also handle generic Error objects.

  // Unknown / programming error: never leak internal details
  console.error("[ErrorHandler] Unhandled error:", err);
  const body: ErrorResponse = {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred. Please try again later.",
    },
  };
  res.status(500).json(body);
}

// ─── Async Route Wrapper ──────────────────────────────────────────────────────

/**
 * Wraps async Express route handlers so unhandled promise rejections are
 * automatically forwarded to the global error handler via `next(err)`.
 *
 * @example
 *   router.get("/users", asyncHandler(async (req, res) => {
 *     const users = await db.query("SELECT * FROM users");
 *     res.json({ success: true, data: users });
 *   }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
