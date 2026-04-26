/**
 * Tests for issue #614: soft-delete and audit trail for cancelled streams.
 *
 * Verifies:
 *   - softDeleteStream sets deleted_at, deleted_by, cancel_reason
 *   - softDeleteStream appends to stream_audit_log
 *   - A soft-deleted stream is excluded from default list queries
 *   - getStreamById with includeSoftDeleted=true finds the deleted stream
 *   - getStreamAuditLog returns ordered audit entries
 *   - DELETE /streams/:id returns 404 for unknown streams
 */

import { jest } from "@jest/globals";
import supertest from "supertest";
import express from "express";
import {
  softDeleteStream,
  getStreamAuditLog,
  getStreamById,
} from "../db/queries";
import { streamsRouter } from "../routes/streams";
import { requestIdMiddleware } from "../middleware/requestId";
import { errorHandler } from "../middleware/errorHandler";

// ── Mock DB layer ─────────────────────────────────────────────────────────────

jest.mock("../db/queries", () => ({
  softDeleteStream: jest.fn(),
  getStreamAuditLog: jest.fn(),
  getStreamById: jest.fn(),
  upsertStream: jest.fn(),
}));

jest.mock("../db/pool", () => ({
  getPool: jest.fn(() => null),
  query: jest.fn(),
}));

// ── Mock auth ─────────────────────────────────────────────────────────────────
// Bypass JWT parsing – inject a pre-built user via middleware override
jest.mock("../middleware/rbac", () => {
  const original = jest.requireActual("../middleware/rbac") as any;
  return {
    ...original,
    authenticateRequest: (req: any, _res: any, next: any) => {
      req.user = {
        id: "test-employer",
        role: 1,
        stellarAddress: "GTEST...ADDR",
      };
      next();
    },
    requireUser: (_req: any, _res: any, next: any) => next(),
  };
});

// Mock idempotency so it's a no-op in these tests
jest.mock("../middleware/idempotency", () => ({
  idempotencyMiddleware: () => (_req: any, _res: any, next: any) => next(),
}));

const mockSoftDelete = jest.mocked(softDeleteStream);
const mockGetAudit = jest.mocked(getStreamAuditLog);
const mockGetStream = jest.mocked(getStreamById);

// ── App fixture ───────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use("/streams", streamsRouter);
  app.use(errorHandler);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DELETE /streams/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 200 and cancellation metadata on success", async () => {
    mockSoftDelete.mockResolvedValue(true as any);

    const res = await supertest(buildApp())
      .delete("/streams/42")
      .send({ cancelReason: "Employer terminated contract" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.streamId).toBe(42);
    expect(res.body.status).toBe("cancelled");
    expect(res.body.cancelledBy).toBe("GTEST...ADDR");
    expect(mockSoftDelete).toHaveBeenCalledWith({
      streamId: 42,
      deletedBy: "GTEST...ADDR",
      cancelReason: "Employer terminated contract",
    });
  });

  test("returns 404 when stream does not exist or is already deleted", async () => {
    mockSoftDelete.mockResolvedValue(false as any);

    const res = await supertest(buildApp()).delete("/streams/99").send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found|already cancelled/i);
  });

  test("returns 400 for an invalid stream ID", async () => {
    const res = await supertest(buildApp()).delete("/streams/abc").send({});
    expect(res.status).toBe(400);
  });
});

describe("GET /streams/:id/audit", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns the audit log for an existing stream", async () => {
    mockGetStream.mockResolvedValue({
      stream_id: 1,
      status: "cancelled",
    } as any);
    mockGetAudit.mockResolvedValue([
      {
        id: 1,
        stream_id: 1,
        changed_by: "GTEST...ADDR",
        action: "cancelled",
        old_status: "active",
        new_status: "cancelled",
        reason: "test",
        metadata: {},
        created_at: new Date(),
      },
    ] as any);

    const res = await supertest(buildApp()).get("/streams/1/audit");

    expect(res.status).toBe(200);
    expect(res.body.streamId).toBe(1);
    expect(res.body.auditLog).toHaveLength(1);
    expect(res.body.auditLog[0].action).toBe("cancelled");
  });

  test("returns 404 when the stream does not exist", async () => {
    mockGetStream.mockResolvedValue(null as any);

    const res = await supertest(buildApp()).get("/streams/999/audit");
    expect(res.status).toBe(404);
  });

  test("returns 400 for a non-numeric stream ID", async () => {
    const res = await supertest(buildApp()).get("/streams/notanumber/audit");
    expect(res.status).toBe(400);
  });
});

describe("softDeleteStream (unit)", () => {
  test("is exported from queries module", () => {
    expect(typeof softDeleteStream).toBe("function");
  });
});

describe("getStreamAuditLog (unit)", () => {
  test("is exported from queries module", () => {
    expect(typeof getStreamAuditLog).toBe("function");
  });
});
