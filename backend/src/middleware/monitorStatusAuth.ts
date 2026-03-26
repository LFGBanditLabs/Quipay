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
 * Optionally protects /monitor/status with a bearer token.
 *
 * If MONITOR_STATUS_ADMIN_TOKEN is not configured, this middleware is a no-op.
 * If configured, request must include:
 *   Authorization: Bearer <MONITOR_STATUS_ADMIN_TOKEN>
 */
export function requireMonitorStatusAdminToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const configuredToken = process.env.MONITOR_STATUS_ADMIN_TOKEN?.trim();

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
