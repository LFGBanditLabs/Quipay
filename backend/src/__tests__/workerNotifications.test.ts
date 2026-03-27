import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import { workerNotificationsRouter } from "../routes/workerNotifications";

const mockGetWorkerNotificationSettings = jest.fn();
const mockUpsertWorkerNotificationSettings = jest.fn();

jest.mock("../db/queries", () => ({
  getWorkerNotificationSettings: (...args: unknown[]) =>
    mockGetWorkerNotificationSettings(...args),
  upsertWorkerNotificationSettings: (...args: unknown[]) =>
    mockUpsertWorkerNotificationSettings(...args),
}));

describe("workerNotificationsRouter", () => {
  let app: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use("/worker-notifications", workerNotificationsRouter);
  });

  it("returns default preferences when no worker settings exist yet", async () => {
    mockGetWorkerNotificationSettings.mockResolvedValueOnce(null);

    const res = await request(app).get("/worker-notifications/GWORKER123");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      data: {
        worker: "GWORKER123",
        emailNotifications: true,
        browserPush: true,
        streamEvents: true,
        withdrawalReminders: true,
      },
    });
  });

  it("maps the API payload into the existing worker notification settings table", async () => {
    mockUpsertWorkerNotificationSettings.mockResolvedValueOnce(undefined);
    mockGetWorkerNotificationSettings.mockResolvedValueOnce({
      worker: "GWORKER123",
      email_enabled: false,
      in_app_enabled: true,
      cliff_unlock_alerts: false,
      stream_ending_alerts: true,
      low_runway_alerts: true,
    });

    const res = await request(app)
      .put("/worker-notifications/GWORKER123")
      .send({
        emailNotifications: false,
        browserPush: true,
        streamEvents: true,
        withdrawalReminders: false,
      });

    expect(mockUpsertWorkerNotificationSettings).toHaveBeenCalledWith({
      worker: "GWORKER123",
      emailEnabled: false,
      inAppEnabled: true,
      cliffUnlockAlerts: false,
      streamEndingAlerts: true,
      lowRunwayAlerts: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.withdrawalReminders).toBe(false);
  });

  it("rejects invalid payloads", async () => {
    const res = await request(app)
      .put("/worker-notifications/GWORKER123")
      .send({
        emailNotifications: "yes",
        browserPush: true,
        streamEvents: true,
        withdrawalReminders: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });
});
