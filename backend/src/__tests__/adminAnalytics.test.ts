/**
 * Tests for Issue #859: Admin aggregate analytics
 * Tests for Issue #858: Scheduler override queue
 *
 * Verifies:
 * - GET /admin/analytics returns real aggregated data (not stub)
 * - Results are cached for 60 seconds
 * - POST /admin/scheduler/override enqueues an override
 * - GET /admin/scheduler/override lists pending overrides
 * - Input validation on override creation
 */

import { jest } from "@jest/globals";

// ── Mock DB queries ───────────────────────────────────────────────────────────
jest.mock("../db/queries", () => ({
  getPlatformAnalytics: jest.fn(),
  enqueueOverride: jest.fn(),
  getSchedulerOverrides: jest.fn(),
  getPendingDLQItems: jest.fn(),
  getPendingDLQItemsByJobType: jest.fn(),
  getDLQItemById: jest.fn(),
  updateDLQItemStatus: jest.fn(),
  getAdminAuditLogs: jest.fn(),
}));

// ── Mock cache ────────────────────────────────────────────────────────────────
const mockCacheGet = jest.fn<any>();
const mockCacheSet = jest.fn<any>();
jest.mock("../utils/cache", () => ({
  globalCache: {
    get: mockCacheGet,
    set: mockCacheSet,
    del: jest.fn(),
    invalidateByPrefix: jest.fn(),
  },
}));

// ── Mock RBAC middleware ──────────────────────────────────────────────────────
jest.mock("../middleware/rbac", () => ({
  authenticateRequest: (_req: any, _res: any, next: any) => next(),
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  requireSuperAdmin: (_req: any, _res: any, next: any) => next(),
  requireUser: (_req: any, _res: any, next: any) => next(),
}));

// ── Mock DLQ ─────────────────────────────────────────────────────────────────
jest.mock("../db/dlq", () => ({
  getPendingDLQItems: jest.fn(),
  getPendingDLQItemsByJobType: jest.fn(),
  getDLQItemById: jest.fn(),
  updateDLQItemStatus: jest.fn(),
  deleteDLQItem: jest.fn(),
}));

// ── Mock other deps ───────────────────────────────────────────────────────────
jest.mock("../delivery", () => ({
  sendWebhookNotification: jest.fn(),
  retryWebhookEvent: jest.fn(),
}));
jest.mock("../syncer", () => ({ startSyncer: jest.fn() }));
jest.mock("../db/adminAuditLog", () => ({
  logAdminAction: jest.fn(),
  getAdminAuditLogs: jest.fn(),
}));
jest.mock("../queue/asyncQueue", () => ({ enqueueJob: jest.fn() }));

import express from "express";
import request from "supertest";
import { adminRouter } from "../adminRouter";
import {
  getPlatformAnalytics,
  enqueueOverride,
  getSchedulerOverrides,
} from "../db/queries";

const mockGetPlatformAnalytics = getPlatformAnalytics as jest.MockedFunction<
  typeof getPlatformAnalytics
>;
const mockEnqueueOverride = enqueueOverride as jest.MockedFunction<
  typeof enqueueOverride
>;
const mockGetSchedulerOverrides = getSchedulerOverrides as jest.MockedFunction<
  typeof getSchedulerOverrides
>;

const app = express();
app.use(express.json());
app.use("/admin", adminRouter);

const mockAnalytics = {
  total_streams: 150,
  active_streams: 42,
  completed_streams: 100,
  cancelled_streams: 8,
  total_volume_by_token: { USDC: "1500000000", XLM: "500000000" },
  unique_employer_count: 25,
  unique_worker_count: 120,
  total_withdrawals: 300,
  total_withdrawn_amount: "750000000",
};

describe("GET /admin/analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockReturnValue(null); // cache miss by default
  });

  it("returns real aggregated analytics from DB", async () => {
    mockGetPlatformAnalytics.mockResolvedValue(mockAnalytics);

    const res = await request(app).get("/admin/analytics");

    expect(res.status).toBe(200);
    expect(res.body.total_streams).toBe(150);
    expect(res.body.active_streams).toBe(42);
    expect(res.body.unique_employer_count).toBe(25);
    expect(res.body.unique_worker_count).toBe(120);
    expect(res.body.total_volume_by_token).toEqual({
      USDC: "1500000000",
      XLM: "500000000",
    });
    expect(res.body.cached).toBe(false);
  });

  it("caches results for 60 seconds", async () => {
    mockGetPlatformAnalytics.mockResolvedValue(mockAnalytics);

    await request(app).get("/admin/analytics");

    expect(mockCacheSet).toHaveBeenCalledWith(
      "admin:platform-analytics",
      mockAnalytics,
      60_000,
    );
  });

  it("returns cached result on second call", async () => {
    mockCacheGet.mockReturnValue(mockAnalytics);

    const res = await request(app).get("/admin/analytics");

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(true);
    expect(mockGetPlatformAnalytics).not.toHaveBeenCalled();
  });

  it("returns 500 on DB error", async () => {
    mockGetPlatformAnalytics.mockRejectedValue(new Error("DB connection lost"));

    const res = await request(app).get("/admin/analytics");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to fetch platform analytics");
  });
});

describe("POST /admin/scheduler/override", () => {
  beforeEach(() => jest.clearAllMocks());

  it("enqueues a valid create_stream override", async () => {
    mockEnqueueOverride.mockResolvedValue(7);

    const res = await request(app)
      .post("/admin/scheduler/override")
      .send({
        employerAddress: "GABC123",
        workerAddress: "GDEF456",
        action: "create_stream",
        params: { rate: "100000000", token: "USDC", durationDays: 30 },
      });

    expect(res.status).toBe(200);
    expect(res.body.overrideId).toBe(7);
    expect(res.body.message).toContain("queued successfully");
    expect(mockEnqueueOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        employerAddress: "GABC123",
        workerAddress: "GDEF456",
        action: "create_stream",
      }),
    );
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/admin/scheduler/override")
      .send({ employerAddress: "GABC123" }); // missing workerAddress and action

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Missing required fields");
    expect(mockEnqueueOverride).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid action type", async () => {
    const res = await request(app).post("/admin/scheduler/override").send({
      employerAddress: "GABC123",
      workerAddress: "GDEF456",
      action: "delete_everything",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid action");
    expect(mockEnqueueOverride).not.toHaveBeenCalled();
  });

  it("returns 500 on DB error", async () => {
    mockEnqueueOverride.mockRejectedValue(new Error("DB error"));

    const res = await request(app).post("/admin/scheduler/override").send({
      employerAddress: "GABC123",
      workerAddress: "GDEF456",
      action: "create_stream",
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to create scheduler override");
  });
});

describe("GET /admin/scheduler/override", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns list of pending overrides", async () => {
    const mockOverrides = [
      {
        id: 1,
        employer_address: "GABC123",
        worker_address: "GDEF456",
        action: "create_stream",
        params: {},
        status: "pending",
        created_by: "admin1",
        error_message: null,
        stream_id: null,
        created_at: new Date().toISOString(),
        executed_at: null,
      },
    ];
    mockGetSchedulerOverrides.mockResolvedValue(mockOverrides as any);

    const res = await request(app).get("/admin/scheduler/override");

    expect(res.status).toBe(200);
    expect(res.body.overrides).toHaveLength(1);
    expect(res.body.count).toBe(1);
    expect(res.body.overrides[0].action).toBe("create_stream");
  });

  it("passes status filter to query", async () => {
    mockGetSchedulerOverrides.mockResolvedValue([]);

    await request(app).get("/admin/scheduler/override?status=completed");

    expect(mockGetSchedulerOverrides).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockGetSchedulerOverrides.mockRejectedValue(new Error("DB error"));

    const res = await request(app).get("/admin/scheduler/override");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to fetch scheduler overrides");
  });
});
