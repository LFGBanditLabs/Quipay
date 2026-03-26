import { Router, Response, Request } from "express";
import {
  authenticateRequest,
  requireAdmin,
  requireSuperAdmin,
  requireUser,
  AuthenticatedRequest,
} from "./middleware/rbac";
import {
  getPendingDLQItems,
  getDLQItemById,
  updateDLQItemStatus,
  deleteDLQItem,
} from "./db/dlq";
import { enqueueJob } from "./queue/asyncQueue";
import { sendWebhookNotification } from "./delivery"; // used for replay examples
import { startSyncer } from "./syncer"; // used for replay examples
import {
  logAdminAction,
  getAdminAuditLogs,
} from "./db/adminAuditLog";

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
 * GET /admin/dlq
 * Admin-only: list all pending items in the Dead Letter Queue.
 */
adminRouter.get(
  "/dlq",
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const items = await getPendingDLQItems(limit, offset);
      res.json({ items });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: "Failed to fetch DLQ items", details: err.message });
    }
  },
);

/**
 * POST /admin/dlq/:id/replay
 * SuperAdmin-only: Manually replay a terminally failed job.
 */
adminRouter.post(
  "/dlq/:id/replay",
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    const id = req.params.id as string;
    try {
      const item = await getDLQItemById(id);
      if (!item) {
        return res.status(404).json({ error: "DLQ item not found" });
      }
      if (item.status !== "pending") {
        return res.status(400).json({
          error: `DLQ item already processed. Status: ${item.status}`,
        });
      }

      // Route the replay logic based on job type.
      // This runs synchronously giving immediate feedback to the admin.
      if (item.job_type === "webhook_delivery") {
        const payload = item.payload as any;
        await sendWebhookNotification(
          payload.eventType,
          payload.originalPayload,
        );
      } else if (item.job_type === "ledger_sync_batch") {
        // We trigger the syncer manually or ignore if syncer self-recovers
        console.log(
          `[DLQ] Admin triggered ledger sync replay for ledger block.`,
        );
        // Assuming startSyncer runs a catch-up block sequence anyway
        startSyncer().catch(console.error);
      } else {
        return res
          .status(400)
          .json({ error: `Unknown job_type: ${item.job_type}` });
      }

      // Mark as replayed
      await updateDLQItemStatus(id, "replayed");

      res.json({
        message: `Successfully replayed DLQ item ${id} of type ${item.job_type}`,
        requestedBy: req.user,
      });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: "Failed to replay DLQ item", details: err.message });
    }
  },
);

/**
 * DELETE /admin/dlq/:id
 * SuperAdmin-only: Permanently delete/discard an item from the DLQ.
 */
adminRouter.delete(
  "/dlq/:id",
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id as string;
    try {
      await updateDLQItemStatus(id, "discarded");
      // Optionally fully delete it with `await deleteDLQItem(id);` but soft-delete provides better auditing
      res.json({ message: `DLQ item ${id} discarded` });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: "Failed to discard DLQ item", details: err.message });
    }
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

/**
 * GET /admin/audit-log
 * Admin-only: retrieve audit trail logs with pagination and filtering
 */
adminRouter.get(
  "/audit-log",
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    try {
      const {
        startDate,
        endDate,
        admin: adminAddress,
        action,
        limit = "50",
        offset = "0",
      } = req.query;

      const filters = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        adminAddress: adminAddress as string | undefined,
        action: action as string | undefined,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      };

      const { logs, total } = await getAdminAuditLogs(filters);

      res.json({
        logs,
        pagination: {
          total,
          limit: filters.limit,
          offset: filters.offset,
          hasMore: filters.offset + filters.limit < total,
        },
      });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: "Failed to fetch audit logs", details: err.message });
    }
  },
);

// Helper function to extract client IP from request
function getClientIP(req: Request): string | undefined {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip
  );
}

// Middleware to log admin actions
const logAdminActionMiddleware = (
  actionName: string,
  targetParam?: string,
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: any,
  ) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to log after response is prepared
    res.json = (body: any) => {
      // Log the admin action asynchronously (don't block response)
      void logAdminAction({
        adminAddress: req.user?.id || "unknown",
        action: actionName,
        target: targetParam ? req.params[targetParam] : undefined,
        details: {
          method: req.method,
          path: req.path,
          query: req.query,
          body: req.body,
          responseBody: body,
        },
        ipAddress: getClientIP(req),
        userAgent: req.headers["user-agent"],
      });

      return originalJson(body);
    };

    next();
  };
};

// Apply audit logging middleware to all admin mutation routes
adminRouter.post("/users/:id/suspend", logAdminActionMiddleware("user_suspend", "id"));
adminRouter.delete("/users/:id", logAdminActionMiddleware("user_delete", "id"));
adminRouter.post("/scheduler/override", logAdminActionMiddleware("scheduler_override"));
adminRouter.post("/dlq/:id/replay", logAdminActionMiddleware("dlq_replay", "id"));
adminRouter.delete("/dlq/:id", logAdminActionMiddleware("dlq_discard", "id"));
