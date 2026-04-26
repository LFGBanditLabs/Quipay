import { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "crypto";

function secureCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Protects /monitor/status with a bearer token.
 *
 * If MONITOR_STATUS_ADMIN_TOKEN is not configured in production, returns 503
 * to alert operators of misconfiguration. In non-production environments,
 * allows access without authentication if token is not set.
 *
 * If configured, request must include:
 *   Authorization: Bearer <MONITOR_STATUS_ADMIN_TOKEN>
 */
export function requireMonitorStatusAdminToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const configuredToken = process.env.MONITOR_STATUS_ADMIN_TOKEN?.trim();
  const isProduction = process.env.NODE_ENV === "production";

  // In production, token MUST be configured
  if (isProduction && !configuredToken) {
    res.status(503).json({
      error:
        "Service Unavailable: MONITOR_STATUS_ADMIN_TOKEN is not configured",
      message:
        "The monitor status endpoint requires authentication but the token is not set. Please configure MONITOR_STATUS_ADMIN_TOKEN in your environment.",
    });
    return;
  }

  // In non-production, allow access if token is not set (for development)
  if (!configuredToken) {
    next();
    return;
  }

  const authorization = req.headers.authorization;
  const bearerMatch =
    typeof authorization === "string"
      ? authorization.match(/^Bearer\s+(.+)$/i)
      : null;
  const providedToken = bearerMatch?.[1]?.trim() ?? "";

  if (!providedToken || !secureCompare(providedToken, configuredToken)) {
    res
      .status(401)
      .json({ error: "Unauthorized: invalid monitor status token" });
    return;
  }

  next();
}
