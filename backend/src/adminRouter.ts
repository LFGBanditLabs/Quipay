import { Router, Response } from "express";
import {
  authenticateRequest,
  requireAdmin,
  requireSuperAdmin,
  requireUser,
  AuthenticatedRequest,
} from "./middleware/rbac";

export const adminRouter = Router();

// Apply authentication to every admin route
adminRouter.use(authenticateRequest);

/**
 * GET /admin/users
 * Admin-only: list all registered users (paginated in production).
 */
adminRouter.get(
  "/users",
  requireAdmin,
  (req: AuthenticatedRequest, res: Response) => {
    res.json({
      message: "User list (stub) – replace with real DB query",
      requestedBy: req.user,
    });
  },
);

/**
 * GET /admin/analytics
 * Admin-only: view aggregated analytics for all employers.
 */
adminRouter.get(
  "/analytics",
  requireAdmin,
  (req: AuthenticatedRequest, res: Response) => {
    res.json({
      message:
        "Aggregated analytics (stub) – replace with real analytics query",
      requestedBy: req.user,
    });
  },
);

/**
 * POST /admin/users/:id/suspend
 * SuperAdmin-only: suspend a user account.
 */
adminRouter.post(
  "/users/:id/suspend",
  requireSuperAdmin,
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    res.json({
      message: `User ${id} suspended (stub) – replace with real DB mutation`,
      requestedBy: req.user,
    });
  },
);

/**
 * DELETE /admin/users/:id
 * SuperAdmin-only: permanently delete a user account (dangerous override).
 */
adminRouter.delete(
  "/users/:id",
  requireSuperAdmin,
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    res.json({
      message: `User ${id} deleted (stub) – replace with real DB mutation`,
      requestedBy: req.user,
    });
  },
);

/**
 * GET /admin/scheduler/override
 * Admin-only: view pending manual override jobs.
 */
adminRouter.get(
  "/scheduler/override",
  requireAdmin,
  (req: AuthenticatedRequest, res: Response) => {
    res.json({
      message: "Scheduler override queue (stub)",
      requestedBy: req.user,
    });
  },
);

/**
 * POST /admin/scheduler/override
 * SuperAdmin-only: create a manual payroll override.
 */
adminRouter.post(
  "/scheduler/override",
  requireSuperAdmin,
  (req: AuthenticatedRequest, res: Response) => {
    res.json({
      message: "Manual payroll override applied (stub)",
      requestedBy: req.user,
      body: req.body,
    });
  },
);

/**
 * GET /admin/me
 * Any authenticated user: returns the currently authenticated user's info.
 */
adminRouter.get(
  "/me",
  requireUser,
  (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
  },
);
