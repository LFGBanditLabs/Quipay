import { Router, Response } from "express";
import {
  authenticateRequest,
  requireUser,
  AuthenticatedRequest,
} from "../middleware/rbac";
import {
  createReportSchedule,
  getReportSchedulesByEmployer,
  deleteReportSchedule,
} from "../db/payrollReportSchedule";

export const reportsRouter = Router();

// Apply authentication to all routes
reportsRouter.use(authenticateRequest);

/**
 * POST /api/reports/schedule
 * Create a new payroll report schedule
 */
reportsRouter.post(
  "/schedule",
  requireUser,
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    try {
      const { frequency, email } = req.body;

      if (!frequency || !email) {
        return res.status(400).json({
          error: "Missing required fields: frequency, email",
        });
      }

      if (!["weekly", "monthly"].includes(frequency)) {
        return res.status(400).json({
          error: "Invalid frequency. Must be 'weekly' or 'monthly'",
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: "Invalid email format",
        });
      }

      const employerId = req.user?.id || "unknown";

      const schedule = await createReportSchedule({
        employerId,
        frequency: frequency as "weekly" | "monthly",
        email,
      });

      res.status(201).json({
        message: "Report schedule created successfully",
        schedule,
      });
    } catch (error: any) {
      console.error("[Reports] Error creating schedule:", error.message);
      res.status(500).json({
        error: "Failed to create report schedule",
        details: error.message,
      });
    }
  },
);

/**
 * GET /api/reports/schedule
 * Get all report schedules for the authenticated user
 */
reportsRouter.get(
  "/schedule",
  requireUser,
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    try {
      const employerId = req.user?.id || "unknown";

      const schedules = await getReportSchedulesByEmployer(employerId);

      res.json({ schedules });
    } catch (error: any) {
      console.error("[Reports] Error fetching schedules:", error.message);
      res.status(500).json({
        error: "Failed to fetch report schedules",
        details: error.message,
      });
    }
  },
);

/**
 * DELETE /api/reports/schedule/:id
 * Delete a report schedule
 */
reportsRouter.delete(
  "/schedule/:id",
  requireUser,
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    try {
      const { id } = req.params;
      const employerId = req.user?.id || "unknown";

      const schedule = await deleteReportSchedule(parseInt(id, 10));

      if (!schedule) {
        return res.status(404).json({
          error: "Report schedule not found",
        });
      }

      // Verify ownership
      if (schedule.employerId !== employerId) {
        return res.status(403).json({
          error: "Not authorized to delete this schedule",
        });
      }

      res.json({
        message: "Report schedule deleted successfully",
        schedule,
      });
    } catch (error: any) {
      console.error("[Reports] Error deleting schedule:", error.message);
      res.status(500).json({
        error: "Failed to delete report schedule",
        details: error.message,
      });
    }
  },
);
