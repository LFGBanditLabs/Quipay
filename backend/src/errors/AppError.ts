/**
 * Custom Error Class Hierarchy for Quipay Backend
 *
 * All custom errors extend AppError, giving every thrown error:
 *  - A consistent HTTP status code
 *  - A machine-readable `code` string (for API clients)
 *  - An optional `details` payload for validation errors, etc.
 *  - `isOperational` flag so the global handler can distinguish
 *    expected app errors from unexpected programming errors.
 */

// ─── Base Error ───────────────────────────────────────────────────────────────

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  /** true = predictable domain error; false = unexpected crash */
  readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: unknown,
    isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── 400 Bad Request ─────────────────────────────────────────────────────────

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: unknown) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

// ─── 401 Unauthorized ────────────────────────────────────────────────────────

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

// ─── 403 Forbidden ───────────────────────────────────────────────────────────

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden: insufficient permissions") {
    super(message, 403, "FORBIDDEN");
  }
}

// ─── 404 Not Found ───────────────────────────────────────────────────────────

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}

// ─── 409 Conflict ────────────────────────────────────────────────────────────

export class ConflictError extends AppError {
  constructor(message = "Resource already exists", details?: unknown) {
    super(message, 409, "CONFLICT", details);
  }
}

// ─── 422 Unprocessable Entity ─────────────────────────────────────────────────

export class UnprocessableError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, "UNPROCESSABLE_ENTITY", details);
  }
}

// ─── 500 Internal Server Error ────────────────────────────────────────────────

export class DatabaseError extends AppError {
  constructor(message = "Database operation failed", details?: unknown) {
    super(message, 500, "DATABASE_ERROR", details, false);
  }
}

export class InternalError extends AppError {
  constructor(message = "Internal server error") {
    super(message, 500, "INTERNAL_ERROR", undefined, false);
  }
}

// ─── 502/503 Upstream Errors ─────────────────────────────────────────────────

export class StellarNetworkError extends AppError {
  constructor(message = "Stellar network request failed", details?: unknown) {
    super(message, 502, "STELLAR_NETWORK_ERROR", details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable") {
    super(message, 503, "SERVICE_UNAVAILABLE");
  }
}
