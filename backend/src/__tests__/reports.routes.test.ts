import express from "express";
import request from "supertest";
import { reportsRouter } from "../routes/reports";
import * as reportScheduleDb from "../db/payrollReportSchedule";

jest.mock("../db/payrollReportSchedule");
jest.mock("../middleware/rbac", () => ({
  authenticateRequest: (req: any, _res: any, next: any) => {
    req.user = {
      id: req.headers["x-user-id"] || "owner-1",
      role: 1,
    };
    next();
  },
  requireUser: (_req: any, _res: any, next: any) => next(),
}));

const app = express();
app.use(express.json());
app.use("/reports", reportsRouter);

describe("reportsRouter DELETE /reports/schedule/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 and does not delete when caller is not the owner", async () => {
    (reportScheduleDb.getReportScheduleById as jest.Mock).mockResolvedValue({
      id: 7,
      employerId: "owner-1",
      frequency: "weekly",
      email: "owner@example.com",
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await request(app)
      .delete("/reports/schedule/7")
      .set("x-user-id", "not-owner");

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Not authorized to delete this schedule");
    expect(reportScheduleDb.deleteReportSchedule).not.toHaveBeenCalled();
  });
});
