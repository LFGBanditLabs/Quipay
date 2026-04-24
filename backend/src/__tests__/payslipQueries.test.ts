import {
  insertPayslipRecord,
  getPayslipByWorkerAndPeriod,
  getPayslipBySignature,
  queryPayslipRecords,
  getPayslipsByWorker,
  upsertEmployerBranding,
  getEmployerBranding,
  deleteEmployerLogo,
} from "../db/queries";
import * as pool from "../db/pool";

// Mock the database pool
jest.mock("../db/pool", () => ({
  getPool: jest.fn(),
  query: jest.fn(),
}));

const mockQuery = pool.query as jest.Mock;
const mockGetPool = pool.getPool as jest.Mock;

describe("Payslip Queries", () => {
  beforeEach(() => {
    mockGetPool.mockReturnValue({});
    mockQuery.mockClear();
  });

  describe("insertPayslipRecord", () => {
    it("should insert a new payslip record", async () => {
      const mockPayslip = {
        id: 1,
        payslip_id: "payslip-123",
        worker_address: "GAXXX111",
        period: "2025-01",
        signature: "sig-abc",
        branding_snapshot: { primaryColor: "#2563eb" },
        pdf_url: null,
        total_gross_amount: "1000000",
        stream_ids: [1, 2, 3],
        generated_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockPayslip] });

      const result = await insertPayslipRecord({
        payslipId: "payslip-123",
        workerAddress: "GAXXX111",
        period: "2025-01",
        signature: "sig-abc",
        brandingSnapshot: { primaryColor: "#2563eb" },
        totalGrossAmount: "1000000",
        streamIds: [1, 2, 3],
      });

      expect(result).toEqual(mockPayslip);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO payslip_records"),
        expect.arrayContaining(["payslip-123", "GAXXX111", "2025-01"]),
      );
    });

    it("should throw error when pool not initialized", async () => {
      mockGetPool.mockReturnValue(null);

      await expect(
        insertPayslipRecord({
          payslipId: "payslip-123",
          workerAddress: "GAXXX111",
          period: "2025-01",
          signature: "sig-abc",
          brandingSnapshot: {},
          totalGrossAmount: "1000000",
          streamIds: [1],
        }),
      ).rejects.toThrow("Database pool not initialized");
    });
  });

  describe("getPayslipByWorkerAndPeriod", () => {
    it("should return payslip when found", async () => {
      const mockPayslip = {
        id: 1,
        payslip_id: "payslip-123",
        worker_address: "GAXXX111",
        period: "2025-01",
        signature: "sig-abc",
        branding_snapshot: {},
        pdf_url: null,
        total_gross_amount: "1000000",
        stream_ids: [1],
        generated_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockPayslip] });

      const result = await getPayslipByWorkerAndPeriod("GAXXX111", "2025-01");

      expect(result).toEqual(mockPayslip);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE worker_address = $1 AND period = $2"),
        ["GAXXX111", "2025-01"],
      );
    });

    it("should return null when not found", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getPayslipByWorkerAndPeriod("GAXXX111", "2025-01");

      expect(result).toBeNull();
    });

    it("should return null when pool not initialized", async () => {
      mockGetPool.mockReturnValue(null);

      const result = await getPayslipByWorkerAndPeriod("GAXXX111", "2025-01");

      expect(result).toBeNull();
    });
  });

  describe("getPayslipBySignature", () => {
    it("should return payslip when signature found", async () => {
      const mockPayslip = {
        id: 1,
        payslip_id: "payslip-123",
        worker_address: "GAXXX111",
        period: "2025-01",
        signature: "sig-abc",
        branding_snapshot: {},
        pdf_url: null,
        total_gross_amount: "1000000",
        stream_ids: [1],
        generated_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockPayslip] });

      const result = await getPayslipBySignature("sig-abc");

      expect(result).toEqual(mockPayslip);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE signature = $1"),
        ["sig-abc"],
      );
    });

    it("should return null when signature not found", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getPayslipBySignature("sig-xyz");

      expect(result).toBeNull();
    });
  });

  describe("queryPayslipRecords", () => {
    it("should query with worker address filter", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await queryPayslipRecords({ workerAddress: "GAXXX111" });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE worker_address = $1"),
        expect.arrayContaining(["GAXXX111"]),
      );
    });

    it("should query with period filter", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await queryPayslipRecords({ period: "2025-01" });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE period = $1"),
        expect.arrayContaining(["2025-01"]),
      );
    });

    it("should query with date range filters", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");

      await queryPayslipRecords({ startDate, endDate });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("generated_at >="),
        expect.arrayContaining([startDate, endDate]),
      );
    });

    it("should apply limit and offset", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await queryPayslipRecords({ limit: 10, offset: 20 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT"),
        expect.arrayContaining([10, 20]),
      );
    });

    it("should return empty array when pool not initialized", async () => {
      mockGetPool.mockReturnValue(null);

      const result = await queryPayslipRecords({});

      expect(result).toEqual([]);
    });
  });

  describe("getPayslipsByWorker", () => {
    it("should call queryPayslipRecords with worker address", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await getPayslipsByWorker("GAXXX111", 25, 10);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE worker_address = $1"),
        expect.arrayContaining(["GAXXX111", 25, 10]),
      );
    });
  });
});

describe("Employer Branding Queries", () => {
  beforeEach(() => {
    mockGetPool.mockReturnValue({});
    mockQuery.mockClear();
  });

  describe("upsertEmployerBranding", () => {
    it("should insert new branding record", async () => {
      const mockBranding = {
        id: 1,
        employer_address: "GAXXX111",
        logo_url: "https://example.com/logo.png",
        logo_metadata: { size: 1024 },
        primary_color: "#FF5733",
        secondary_color: "#33FF57",
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockBranding] });

      const result = await upsertEmployerBranding({
        employerAddress: "GAXXX111",
        logoUrl: "https://example.com/logo.png",
        logoMetadata: { size: 1024 },
        primaryColor: "#FF5733",
        secondaryColor: "#33FF57",
      });

      expect(result).toEqual(mockBranding);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO employer_branding"),
        expect.any(Array),
      );
    });

    it("should throw error when pool not initialized", async () => {
      mockGetPool.mockReturnValue(null);

      await expect(
        upsertEmployerBranding({
          employerAddress: "GAXXX111",
        }),
      ).rejects.toThrow("Database pool not initialized");
    });
  });

  describe("getEmployerBranding", () => {
    it("should return branding when found", async () => {
      const mockBranding = {
        id: 1,
        employer_address: "GAXXX111",
        logo_url: "https://example.com/logo.png",
        logo_metadata: {},
        primary_color: "#2563eb",
        secondary_color: "#64748b",
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [mockBranding] });

      const result = await getEmployerBranding("GAXXX111");

      expect(result).toEqual(mockBranding);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE employer_address = $1"),
        ["GAXXX111"],
      );
    });

    it("should return null when not found", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getEmployerBranding("GAXXX111");

      expect(result).toBeNull();
    });

    it("should return null when pool not initialized", async () => {
      mockGetPool.mockReturnValue(null);

      const result = await getEmployerBranding("GAXXX111");

      expect(result).toBeNull();
    });
  });

  describe("deleteEmployerLogo", () => {
    it("should delete logo by setting to null", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await deleteEmployerLogo("GAXXX111");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE employer_branding"),
        ["GAXXX111"],
      );
    });

    it("should throw error when pool not initialized", async () => {
      mockGetPool.mockReturnValue(null);

      await expect(deleteEmployerLogo("GAXXX111")).rejects.toThrow(
        "Database pool not initialized",
      );
    });
  });
});
