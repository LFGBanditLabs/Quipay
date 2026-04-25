import request from "supertest";
import express from "express";
import { payslipsRouter } from "../routes/payslips";
import * as queries from "../db/queries";
import * as pdfGenerator from "../services/pdfGeneratorService";
import * as signatureService from "../services/signatureService";
import * as pool from "../db/pool";

// Mock dependencies
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
  validateRequest: () => (req: any, res: any, next: any) => next(),
}));
jest.mock("../middleware/rbac", () => ({
  authenticateRequest: (req: any, res: any, next: any) => {
    req.user = { id: req.headers["x-user-id"] || "GAXXX111" };
    next();
  },
  requireUser: (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  },
}));

const mockQuery = pool.query as jest.Mock;

const app = express();
app.use(express.json());
app.use("/api/workers", payslipsRouter);
app.use("/api", payslipsRouter);

describe("Payslips Router", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  describe("GET /api/workers/:address/payslip", () => {
    it("should return 403 when user tries to access another workers payslip", async () => {
      const response = await request(app)
        .get("/api/workers/GAXXX222/payslip?period=2025-01")
        .set("x-user-id", "GAXXX111");

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Forbidden");
    });

    it("should return 404 when no streams found for period", async () => {
      (queries.getPayslipByWorkerAndPeriod as jest.Mock).mockResolvedValue(
        null,
      );
      mockQuery.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get("/api/workers/GAXXX111/payslip?period=2025-01")
        .set("x-user-id", "GAXXX111");

      expect(response.status).toBe(404);
      expect(response.body.message).toContain("No payment streams found");
    });

    it("should generate and return PDF payslip", async () => {
      const mockStream = {
        stream_id: 1,
        employer: "GAXXX222",
        worker: "GAXXX111",
        total_amount: "10000000",
        withdrawn_amount: "5000000",
        start_ts: 1704067200,
        end_ts: 1706745600,
        status: "active",
        created_at: new Date(),
      };

      const mockWithdrawal = {
        id: 1,
        stream_id: 1,
        worker: "GAXXX111",
        amount: "2500000",
        ledger: 1000,
        ledger_ts: 1704153600,
        created_at: new Date(),
      };

      (queries.getPayslipByWorkerAndPeriod as jest.Mock).mockResolvedValue(
        null,
      );
      mockQuery
        .mockResolvedValueOnce({ rows: [mockStream] }) // streams query
        .mockResolvedValueOnce({ rows: [mockWithdrawal] }); // withdrawals query
      (queries.getEmployerBranding as jest.Mock).mockResolvedValue({
        logo_url: null,
        primary_color: "#2563eb",
        secondary_color: "#64748b",
      });
      (signatureService.signPayslip as jest.Mock).mockResolvedValue(
        "test-signature",
      );
      (pdfGenerator.generatePayslip as jest.Mock).mockResolvedValue(
        Buffer.from("PDF content"),
      );
      (queries.insertPayslipRecord as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .get("/api/workers/GAXXX111/payslip?period=2025-01")
        .set("x-user-id", "GAXXX111");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("application/pdf");
      expect(response.headers["x-payslip-id"]).toBeDefined();
      expect(response.headers["x-signature"]).toBe("test-signature");
      expect(response.body).toEqual(Buffer.from("PDF content"));
    });

    it("should use cached payslip if exists", async () => {
      const mockPayslip = {
        id: 1,
        payslip_id: "payslip-123",
        worker_address: "GAXXX111",
        period: "2025-01",
        signature: "cached-signature",
        branding_snapshot: {},
        pdf_url: null,
        total_gross_amount: "5000000",
        stream_ids: [1],
        generated_at: new Date(),
      };

      const mockStream = {
        stream_id: 1,
        employer: "GAXXX222",
        worker: "GAXXX111",
        total_amount: "10000000",
        withdrawn_amount: "5000000",
        start_ts: 1704067200,
        end_ts: 1706745600,
        status: "active",
        created_at: new Date(),
      };

      (queries.getPayslipByWorkerAndPeriod as jest.Mock).mockResolvedValue(
        mockPayslip,
      );
      mockQuery
        .mockResolvedValueOnce({ rows: [mockStream] })
        .mockResolvedValueOnce({ rows: [] });
      (queries.getEmployerBranding as jest.Mock).mockResolvedValue(null);
      (signatureService.signPayslip as jest.Mock).mockResolvedValue(
        "test-signature",
      );
      (pdfGenerator.generatePayslip as jest.Mock).mockResolvedValue(
        Buffer.from("PDF content"),
      );

      const response = await request(app)
        .get("/api/workers/GAXXX111/payslip?period=2025-01")
        .set("x-user-id", "GAXXX111");

      expect(response.status).toBe(200);
      // Should not insert new record since it exists
      expect(queries.insertPayslipRecord).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/verify-signature", () => {
    it("should return 400 when signature is missing", async () => {
      const response = await request(app).post("/api/verify-signature").send({});

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.message).toContain("Signature is required");
    });

    it("should return 404 when signature not found", async () => {
      (queries.getPayslipBySignature as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post("/api/verify-signature")
        .send({ signature: "unknown-signature" });

      expect(response.status).toBe(404);
      expect(response.body.valid).toBe(false);
      expect(response.body.message).toContain("Signature not found");
    });

    it("should verify valid signature and return payslip details", async () => {
      const mockPayslip = {
        id: 1,
        payslip_id: "payslip-123",
        worker_address: "GAXXX111",
        period: "2025-01",
        signature: "valid-signature",
        branding_snapshot: {},
        pdf_url: null,
        total_gross_amount: "5000000",
        stream_ids: [1, 2],
        generated_at: new Date("2025-01-15"),
      };

      (queries.getPayslipBySignature as jest.Mock).mockResolvedValue(
        mockPayslip,
      );
      (signatureService.verifySignature as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post("/api/verify-signature")
        .send({ signature: "valid-signature" });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(signatureService.verifySignature).toHaveBeenCalledWith({
        signature: "valid-signature",
        payslipData: expect.objectContaining({
          payslipId: "payslip-123",
          workerAddress: "GAXXX111",
          period: "2025-01",
          totalGrossAmount: "5000000",
          streamIds: [1, 2],
        }),
      });
      expect(response.body.payslip).toMatchObject({
        id: "payslip-123",
        workerAddress: "GAXXX111",
        period: "2025-01",
        totalGrossAmount: "5000000",
        streamIds: [1, 2],
      });
      expect(response.body.payslip.generatedAt).toBeDefined();
    });

    it("should return 401 when cryptographic verification fails", async () => {
      const tamperedPayslip = {
        id: 1,
        payslip_id: "payslip-123",
        worker_address: "GAXXX111",
        period: "2025-01",
        signature: "valid-signature",
        branding_snapshot: {},
        pdf_url: null,
        total_gross_amount: "9999999",
        stream_ids: [1, 2],
        generated_at: new Date("2025-01-15"),
      };

      (queries.getPayslipBySignature as jest.Mock).mockResolvedValue(
        tamperedPayslip,
      );
      (signatureService.verifySignature as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .post("/api/verify-signature")
        .send({ signature: "valid-signature" });

      expect(response.status).toBe(401);
      expect(response.body.valid).toBe(false);
      expect(response.body.message).toContain("Invalid signature");
    });
  });
});
