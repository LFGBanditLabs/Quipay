import { Request as ExpressRequest, Response, NextFunction } from "express";

// ─── Role Definitions ────────────────────────────────────────────────────────

/**
 * Standard user roles for Quipay. Higher numeric value = broader privilege.
 * Use bitmask-compatible powers of 2 to allow composing permissions.
 */
export enum Role {
  User = 1, // Standard authenticated user
  Admin = 2, // Has access to admin management endpoints
  SuperAdmin = 4, // Full access including dangerous overrides
}

// Human-readable string to Role mapping (used when decoding JWT/API-key claims)
export const ROLE_MAP: Record<string, Role> = {
  user: Role.User,
  admin: Role.Admin,
  superadmin: Role.SuperAdmin,
};

// ─── Extended Request ─────────────────────────────────────────────────────────

/**
 * Augments the base Express Request with the authenticated user payload.
 * Populated by `authenticateRequest` middleware above the RBAC check.
 */
export interface AuthenticatedRequest
  extends ExpressRequest<Record<string, string>, any, any, any> {
  user?: {
    id: string;
    role: Role;
    email?: string;
  };
}

// ─── Auth Extraction ──────────────────────────────────────────────────────────

/**
 * Simulates token extraction/validation.
 *
 * In production this would verify a signed JWT or look up an API key in the
 * database. For now it reads a plain `X-User-Role` header so the system can
 * be exercised end-to-end without a full auth service.
 *
 * Replace this function body with your real JWT/session verification logic.
 */
function extractUser(
  req: AuthenticatedRequest,
): { id: string; role: Role } | null {
  const roleHeader = req.headers["x-user-role"] as string | undefined;
  const userId = req.headers["x-user-id"] as string | undefined;

  if (!roleHeader || !userId) return null;

  const role = ROLE_MAP[roleHeader.toLowerCase()];
  if (role === undefined) return null;

  return { id: userId, role };
}

// ─── Middleware Factories ────────────────────────────────────────────────────

/**
 * Ensures that the incoming request carries valid credentials.
 * Populates `req.user` for downstream handlers.
 *
 * Must be placed before any `requireRole` middleware on a route.
 */
export function authenticateRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const user = extractUser(req);
  if (!user) {
    res
      .status(401)
      .json({ error: "Unauthorized: missing or invalid credentials" });
    return;
  }
  req.user = user;
  next();
}

/**
 * Role-Based Access Control middleware factory.
 *
 * Accepts one or more allowed roles. The request is permitted when the
 * authenticated user holds **at least one** of the required roles (bitmask OR).
 *
 * @example
 *   // Only SuperAdmins can call this route
 *   router.delete("/users/:id", authenticateRequest, requireRole(Role.SuperAdmin), handler);
 *
 *   // Both Admins and SuperAdmins can call this route
 *   router.get("/analytics", authenticateRequest, requireRole(Role.Admin, Role.SuperAdmin), handler);
 */
export function requireRole(...allowedRoles: Role[]) {
  const allowedMask = allowedRoles.reduce((acc, r) => acc | r, 0);

  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized: not authenticated" });
      return;
    }

    const hasPermission = (req.user.role & allowedMask) !== 0;
    if (!hasPermission) {
      res.status(403).json({
        error: "Forbidden: insufficient permissions",
        required: allowedRoles.map((r) => Role[r]),
        actual: Role[req.user.role],
      });
      return;
    }

    next();
  };
}

/**
 * Shorthand middleware factories for common role checks.
 */
export const requireAdmin = requireRole(Role.Admin, Role.SuperAdmin);
export const requireSuperAdmin = requireRole(Role.SuperAdmin);
export const requireUser = requireRole(Role.User, Role.Admin, Role.SuperAdmin);
