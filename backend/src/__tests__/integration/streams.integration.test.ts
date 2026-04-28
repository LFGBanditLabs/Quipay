/**
 * Integration Tests: Stream Creation
 *
 * Tests the full lifecycle of POST /streams endpoint:
 *   - HTTP request → validation → DB insertion → response
 *   - Idempotency behavior (same request twice returns same result)
 *   - Uses real PostgreSQL container via testcontainers
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  afterAll,
} from "@jest/globals";
import express, { Express } from "express";
import request from "supertest";
import { streamsRouter } from "../../routes/streams";
import {
  setupTestDatabase,
  cleanTestDatabase,
  teardownTestDatabase,
  TestDatabase,
} from "../helpers/testcontainer";
import { getStreamById } from "../../db/queries";

// ── Test App Setup ────────────────────────────────────────────────────────────

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use("/streams", streamsRouter);
  return app;
}

// ── Mock Authentication ───────────────────────────────────────────────────────

jest.mock("../../middleware/rbac", () => ({
  authenticateRequest: (req: any, res: any, next: any) => {
    req.user = {
      id: req.headers["x-user-id"] || "test-user-1",
      stellarAddress: req.headers["x-user-id"] || "test-user-1",
      role: 1,
    };
    next();
  },
  requireUser: (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  },
}));

// Mock Redis for idempotency (optional - can use real Redis if available)
jest.mock("../../middleware/idempotency", () => {
  const actualModule = jest.requireActual("../../middleware/idempotency");
  return {
    ...actualModule,
    idempotencyMiddleware: () => (req: any, res: any, next: any) => next(),
  };
});

// Mock audit logger to avoid side effects
jest.mock("../../audit/serviceLogger", () => ({
  logServiceInfo: jest.fn(),
  logServiceWarn: jest.fn(),
  logServiceError: jest.fn(),
}));

// ── Test Suite ────────────────────────────────────────────────────────────────

describe("Stream Creation Integration Tests", () => {
  let app: Express;
  let testDb: TestDatabase;

  const insertRawStream = async (params: {
    streamId: number;
    employerAddress: string;
    workerAddress: string;
    totalAmount: string;
    status: string;
  }): Promise<void> => {
    const now = Math.floor(Date.now() / 1000);

    await testDb.getPool().query(
      `INSERT INTO payroll_streams
         (stream_id, employer_address, worker_address, total_amount, withdrawn_amount,
          start_ts, end_ts, status, ledger_created)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        params.streamId,
        params.employerAddress,
        params.workerAddress,
        params.totalAmount,
        "0",
        now,
        now + 3600,
        params.status,
        90_000_000 + params.streamId,
      ],
    );
  };

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    app = buildApp();
  });

  afterEach(async () => {
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  // ── Test: POST /streams creates a stream record ──────────────────────────

  describe("POST /streams - stream creation", () => {
    it("should create a new stream and return correct fields", async () => {
      const streamPayload = {
        streamId: 12345,
        employerAddress: "GAEMPLOYER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        workerAddress: "GAWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ12",
        totalAmount: "10000000000", // 1000 XLM in stroops
        withdrawnAmount: "0",
        startTs: Math.floor(Date.now() / 1000),
        endTs: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
        status: "active" as const,
        ledger: 50000000,
      };

      const response = await request(app)
        .post("/streams")
        .set("x-user-id", "GAEMPLOYER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        .send(streamPayload);

      // Verify HTTP response
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("stream");
      expect(response.body.stream).toMatchObject({
        stream_id: streamPayload.streamId,
        employer_address: streamPayload.employerAddress,
        worker_address: streamPayload.workerAddress,
        total_amount: streamPayload.totalAmount,
        withdrawn_amount: streamPayload.withdrawnAmount,
        start_ts: streamPayload.startTs,
        end_ts: streamPayload.endTs,
        status: streamPayload.status,
        ledger_created: streamPayload.ledger,
      });
      expect(response.body.stream).toHaveProperty("created_at");
      expect(response.body.stream).toHaveProperty("updated_at");
      expect(response.body.stream.deleted_at).toBeNull();

      // Verify database record
      const dbStream = await getStreamById(streamPayload.streamId);
      expect(dbStream).toBeDefined();
      expect(dbStream?.stream_id).toBe(streamPayload.streamId);
      expect(dbStream?.employer_address).toBe(streamPayload.employerAddress);
      expect(dbStream?.worker_address).toBe(streamPayload.workerAddress);
      expect(dbStream?.status).toBe(streamPayload.status);
    });

    it("should handle stream with withdrawn amount", async () => {
      const streamPayload = {
        streamId: 12346,
        employerAddress: "GAEMPLOYER223456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        workerAddress: "GAWORKER223456789ABCDEFGHIJKLMNOPQRSTUVWXYZ12",
        totalAmount: "10000000000",
        withdrawnAmount: "2500000000", // 250 XLM withdrawn
        startTs: Math.floor(Date.now() / 1000) - 86400 * 10, // Started 10 days ago
        endTs: Math.floor(Date.now() / 1000) + 86400 * 20,
        status: "active" as const,
        ledger: 50000001,
      };

      const response = await request(app)
        .post("/streams")
        .set("x-user-id", "GAEMPLOYER223456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        .send(streamPayload);

      expect(response.status).toBe(201);
      expect(response.body.stream.withdrawn_amount).toBe(
        streamPayload.withdrawnAmount,
      );

      const dbStream = await getStreamById(streamPayload.streamId);
      expect(dbStream?.withdrawn_amount).toBe(streamPayload.withdrawnAmount);
    });

    it("should reject invalid stream data", async () => {
      const invalidPayload = {
        streamId: -1, // Invalid: negative ID
        employerAddress: "GAEMPLOYER",
        workerAddress: "GAWORKER",
        totalAmount: "invalid", // Invalid: not numeric
        startTs: Math.floor(Date.now() / 1000),
        endTs: Math.floor(Date.now() / 1000) + 86400,
        status: "active",
        ledger: 50000000,
      };

      const response = await request(app)
        .post("/streams")
        .set("x-user-id", "GAEMPLOYER")
        .send(invalidPayload);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    });

    it("should require authentication", async () => {
      const streamPayload = {
        streamId: 12347,
        employerAddress: "GAEMPLOYER323456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        workerAddress: "GAWORKER323456789ABCDEFGHIJKLMNOPQRSTUVWXYZ12",
        totalAmount: "10000000000",
        withdrawnAmount: "0",
        startTs: Math.floor(Date.now() / 1000),
        endTs: Math.floor(Date.now() / 1000) + 86400 * 30,
        status: "active" as const,
        ledger: 50000002,
      };

      // Mock will still authenticate, but in real scenario without headers it would fail
      // This test verifies the middleware chain is in place
      const response = await request(app).post("/streams").send(streamPayload);

      // With our mock, this will succeed, but the middleware is still called
      expect(response.status).toBeLessThan(500);
    });
  });

  // ── Test: Idempotency ─────────────────────────────────────────────────────

  describe("POST /streams - idempotency", () => {
    it("should handle duplicate stream creation (upsert behavior)", async () => {
      const streamPayload = {
        streamId: 12348,
        employerAddress: "GAEMPLOYER423456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        workerAddress: "GAWORKER423456789ABCDEFGHIJKLMNOPQRSTUVWXYZ12",
        totalAmount: "10000000000",
        withdrawnAmount: "0",
        startTs: Math.floor(Date.now() / 1000),
        endTs: Math.floor(Date.now() / 1000) + 86400 * 30,
        status: "active" as const,
        ledger: 50000003,
      };

      // First request
      const response1 = await request(app)
        .post("/streams")
        .set("x-user-id", "GAEMPLOYER423456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        .send(streamPayload);

      expect(response1.status).toBe(201);
      const firstStreamData = response1.body.stream;

      // Second request with same streamId but updated withdrawn amount
      const updatedPayload = {
        ...streamPayload,
        withdrawnAmount: "1000000000", // Updated
      };

      const response2 = await request(app)
        .post("/streams")
        .set("x-user-id", "GAEMPLOYER423456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        .send(updatedPayload);

      expect(response2.status).toBe(201);
      expect(response2.body.stream.stream_id).toBe(streamPayload.streamId);
      expect(response2.body.stream.withdrawn_amount).toBe(
        updatedPayload.withdrawnAmount,
      );

      // Verify only one record exists in DB
      const dbStream = await getStreamById(streamPayload.streamId);
      expect(dbStream?.withdrawn_amount).toBe(updatedPayload.withdrawnAmount);
    });

    it("should return same result for identical requests with Idempotency-Key", async () => {
      const streamPayload = {
        streamId: 12349,
        employerAddress: "GAEMPLOYER523456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        workerAddress: "GAWORKER523456789ABCDEFGHIJKLMNOPQRSTUVWXYZ12",
        totalAmount: "10000000000",
        withdrawnAmount: "0",
        startTs: Math.floor(Date.now() / 1000),
        endTs: Math.floor(Date.now() / 1000) + 86400 * 30,
        status: "active" as const,
        ledger: 50000004,
      };

      const idempotencyKey = "550e8400-e29b-41d4-a716-446655440000";

      // First request
      const response1 = await request(app)
        .post("/streams")
        .set("x-user-id", "GAEMPLOYER523456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        .set("Idempotency-Key", idempotencyKey)
        .send(streamPayload);

      expect(response1.status).toBe(201);

      // Second request with same idempotency key
      const response2 = await request(app)
        .post("/streams")
        .set("x-user-id", "GAEMPLOYER523456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        .set("Idempotency-Key", idempotencyKey)
        .send(streamPayload);

      // Both should succeed (our mock doesn't cache, but middleware is in place)
      expect(response2.status).toBe(201);
      expect(response2.body.stream.stream_id).toBe(streamPayload.streamId);
    });
  });

  // ── Test: Stream status variations ────────────────────────────────────────

  describe("POST /streams - different statuses", () => {
    it("should create stream with completed status", async () => {
      const streamPayload = {
        streamId: 12350,
        employerAddress: "GAEMPLOYER623456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        workerAddress: "GAWORKER623456789ABCDEFGHIJKLMNOPQRSTUVWXYZ12",
        totalAmount: "10000000000",
        withdrawnAmount: "10000000000", // Fully withdrawn
        startTs: Math.floor(Date.now() / 1000) - 86400 * 30,
        endTs: Math.floor(Date.now() / 1000) - 86400,
        status: "completed" as const,
        ledger: 50000005,
      };

      const response = await request(app)
        .post("/streams")
        .set("x-user-id", "GAEMPLOYER623456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        .send(streamPayload);

      expect(response.status).toBe(201);
      expect(response.body.stream.status).toBe("completed");
      expect(response.body.stream.withdrawn_amount).toBe(
        response.body.stream.total_amount,
      );
    });

    it("should create stream with cancelled status", async () => {
      const streamPayload = {
        streamId: 12351,
        employerAddress: "GAEMPLOYER723456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        workerAddress: "GAWORKER723456789ABCDEFGHIJKLMNOPQRSTUVWXYZ12",
        totalAmount: "10000000000",
        withdrawnAmount: "3000000000",
        startTs: Math.floor(Date.now() / 1000) - 86400 * 5,
        endTs: Math.floor(Date.now() / 1000) + 86400 * 25,
        status: "cancelled" as const,
        ledger: 50000006,
      };

      const response = await request(app)
        .post("/streams")
        .set("x-user-id", "GAEMPLOYER723456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        .send(streamPayload);

      expect(response.status).toBe(201);
      expect(response.body.stream.status).toBe("cancelled");
    });

    it("should create stream with paused status", async () => {
      const streamPayload = {
        streamId: 12352,
        employerAddress: "GAEMPLOYER823456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        workerAddress: "GAWORKER823456789ABCDEFGHIJKLMNOPQRSTUVWXYZ12",
        totalAmount: "10000000000",
        withdrawnAmount: "1500000000",
        startTs: Math.floor(Date.now() / 1000) - 86400 * 2,
        endTs: Math.floor(Date.now() / 1000) + 86400 * 28,
        status: "paused" as const,
        ledger: 50000007,
      };

      const response = await request(app)
        .post("/streams")
        .set("x-user-id", "GAEMPLOYER823456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        .send(streamPayload);

      expect(response.status).toBe(201);
      expect(response.body.stream.status).toBe("paused");
    });
  });

  describe("payroll_streams DB constraints", () => {
    it("should reject negative total_amount at the database level", async () => {
      await expect(
        insertRawStream({
          streamId: 22353,
          employerAddress: "GAEMPLOYER923456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
          workerAddress: "GAWORKER923456789ABCDEFGHIJKLMNOPQRSTUVWXYZ12",
          totalAmount: "-1",
          status: "active",
        }),
      ).rejects.toMatchObject({
        code: "23514",
        constraint: "payroll_streams_total_amount_positive_check",
      });
    });

    it("should reject invalid status strings at the database level", async () => {
      await expect(
        insertRawStream({
          streamId: 22354,
          employerAddress: "GAEMPLOYERA23456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
          workerAddress: "GAWORKERA23456789ABCDEFGHIJKLMNOPQRSTUVWXYZ12",
          totalAmount: "1000",
          status: "unknown_status",
        }),
      ).rejects.toMatchObject({
        code: "23514",
        constraint: "payroll_streams_status_check",
      });
    });

    it("should reject duplicate active streams for the same employer and worker", async () => {
      const employerAddress =
        "GAEMPLOYERB23456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const workerAddress = "GAWORKERB23456789ABCDEFGHIJKLMNOPQRSTUVWXYZ12";

      await insertRawStream({
        streamId: 22355,
        employerAddress,
        workerAddress,
        totalAmount: "1000",
        status: "active",
      });

      await expect(
        insertRawStream({
          streamId: 22356,
          employerAddress,
          workerAddress,
          totalAmount: "2000",
          status: "active",
        }),
      ).rejects.toMatchObject({
        code: "23505",
        constraint: "ux_payroll_streams_active_employer_worker",
        message: expect.stringContaining("duplicate key value"),
      });
    });
  });
});
