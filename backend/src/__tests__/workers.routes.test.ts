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
  validateRequest: () => (_req: any, _res: any, next: any) => next(),
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
    mockQuery.mockResolvedValue({
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
  });

  it("allows admin callers to request fields=full", async () => {
    mockQuery.mockResolvedValue({
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
});
