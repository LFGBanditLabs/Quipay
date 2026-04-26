import express from "express";
import request from "supertest";
import { payslipsRouter } from "../routes/payslips";
import * as pool from "../db/pool";

jest.mock("../db/queries");
jest.mock("../services/pdfGeneratorService");
jest.mock("../services/signatureService");
jest.mock("../db/pool", () => ({
  query: jest.fn(),
  getPool: jest.fn(() => ({})),
}));
jest.mock("../audit/serviceLogger", () => ({
  logServiceInfo: jest.fn(),
  logServiceWarn: jest.fn(),
  logServiceError: jest.fn(),
}));
jest.mock("../middleware/validation", () => ({
  validateRequest:
    (schemas: { query?: any; body?: any; params?: any }) =>
    async (req: any, res: any, next: any) => {
      try {
        if (schemas.query) {
          const parsed = await schemas.query.parseAsync(req.query);
          Object.defineProperty(req, "query", {
            value: parsed,
            writable: true,
            configurable: true,
          });
        }
        if (schemas.body) {
          req.body = await schemas.body.parseAsync(req.body);
        }
        if (schemas.params) {
          req.params = await schemas.params.parseAsync(req.params);
        }
        next();
      } catch (err: any) {
        res.status(400).json({
          error: "Validation error",
          details: err.issues ?? err.message,
        });
      }
    },
}));
jest.mock("../middleware/rbac", () => ({
  Role: {
    User: 1,
    Admin: 2,
    SuperAdmin: 4,
  },
  authenticateRequest: (req: any, _res: any, next: any) => {
    const roleHeader = String(req.headers["x-user-role"] || "user").toLowerCase();
    const role = roleHeader === "admin" ? 2 : roleHeader === "superadmin" ? 4 : 1;
    req.user = { id: req.headers["x-user-id"] || "ORG_1", role };
    next();
  },
  requireUser: (_req: any, _res: any, next: any) => next(),
}));

const mockQuery = pool.query as jest.Mock;

const app = express();
app.use(express.json());
app.use("/api/workers", payslipsRouter);

describe("GET /api/workers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns summary DTO by default without sensitive fields", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "GWORKER1",
            name: "John Doe",
            address: "GWORKER1",
            department: "Engineering",
            status: "active",
            employer_address: "ORG_1",
            bank_account_stub: "****1234",
            personal_identifier: "NIN-123",
            metadata: { department: "Engineering" },
          },
        ],
      });

    const response = await request(app)
      .get("/api/workers")
      .set("x-user-id", "ORG_1")
      .set("x-user-role", "user");

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toEqual({
      id: "GWORKER1",
      name: "John Doe",
      address: "GWORKER1",
      department: "Engineering",
      status: "active",
    });
    expect(response.body.data[0].bankAccountStub).toBeUndefined();
    expect(response.body.data[0].personalIdentifier).toBeUndefined();
    expect(response.body.meta).toMatchObject({
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it("allows admin callers to request fields=full", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "GWORKER2",
            name: "Jane Doe",
            address: "GWORKER2",
            department: "Finance",
            status: "inactive",
            employer_address: "ORG_1",
            bank_account_stub: "****5678",
            personal_identifier: "NIN-567",
            email: "jane@example.com",
            phone: "+2340000000",
            metadata: { department: "Finance" },
          },
        ],
      });

    const response = await request(app)
      .get("/api/workers?fields=full")
      .set("x-user-id", "admin-user")
      .set("x-user-role", "admin");

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      id: "GWORKER2",
      bankAccountStub: "****5678",
      personalIdentifier: "NIN-567",
      employerAddress: "ORG_1",
    });
  });

  it("rejects non-admin callers requesting fields=full", async () => {
    const response = await request(app)
      .get("/api/workers?fields=full")
      .set("x-user-id", "ORG_1")
      .set("x-user-role", "user");

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Forbidden");
  });

  // --- #932: pagination ---

  function makeWorkerRows(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `GWORKER${i}`,
      name: `Worker ${String(i).padStart(3, "0")}`,
      address: `GWORKER${i}`,
      department: "Engineering",
      status: "active",
      employer_address: "ORG_1",
      metadata: {},
    }));
  }

  it("returns pagination meta envelope with default limit 20", async () => {
    const rows = makeWorkerRows(20);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: "55" }] })
      .mockResolvedValueOnce({ rows });

    const response = await request(app)
      .get("/api/workers")
      .set("x-user-id", "ORG_1")
      .set("x-user-role", "user");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(20);
    expect(response.body.meta).toEqual({
      total: 55,
      page: 1,
      limit: 20,
      totalPages: 3,
      nextCursor: "Worker 019",
    });
  });

  it("honours an explicit page and limit", async () => {
    const rows = makeWorkerRows(10);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: "100" }] })
      .mockResolvedValueOnce({ rows });

    const response = await request(app)
      .get("/api/workers?page=3&limit=10")
      .set("x-user-id", "ORG_1")
      .set("x-user-role", "user");

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      total: 100,
      page: 3,
      limit: 10,
      totalPages: 10,
      nextCursor: "Worker 009",
    });
    // Confirm offset was passed to the data query.
    const lastCall = mockQuery.mock.calls[1];
    expect(lastCall[1]).toEqual(["ORG_1", 10, 20]);
  });

  it("returns nextCursor=null on the last page (partial result)", async () => {
    const rows = makeWorkerRows(7);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: "7" }] })
      .mockResolvedValueOnce({ rows });

    const response = await request(app)
      .get("/api/workers?page=1&limit=20")
      .set("x-user-id", "ORG_1")
      .set("x-user-role", "user");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(7);
    expect(response.body.meta).toMatchObject({
      total: 7,
      page: 1,
      limit: 20,
      totalPages: 1,
      nextCursor: null,
    });
  });

  it("returns empty data + meta for an empty result set", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .get("/api/workers")
      .set("x-user-id", "ORG_1")
      .set("x-user-role", "user");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta).toMatchObject({
      total: 0,
      page: 1,
      limit: 20,
      nextCursor: null,
    });
  });

  it("rejects limit > 100", async () => {
    const response = await request(app)
      .get("/api/workers?limit=500")
      .set("x-user-id", "ORG_1")
      .set("x-user-role", "user");

    expect(response.status).toBe(400);
  });

  it("supports cursor-based pagination", async () => {
    const rows = makeWorkerRows(5);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: "30" }] })
      .mockResolvedValueOnce({ rows });

    const response = await request(app)
      .get("/api/workers?cursor=Worker%20015&limit=5")
      .set("x-user-id", "ORG_1")
      .set("x-user-role", "user");

    expect(response.status).toBe(200);
    expect(response.body.meta.page).toBeNull();
    expect(response.body.meta.totalPages).toBeNull();
    expect(response.body.meta.nextCursor).toBe("Worker 004");
    // Cursor is passed to the data query (in the params array).
    const lastCall = mockQuery.mock.calls[1];
    expect(lastCall[1]).toEqual(["ORG_1", "Worker 015", 5]);
  });
});
