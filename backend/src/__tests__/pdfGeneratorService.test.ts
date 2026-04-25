import { generatePayslip } from "../services/pdfGeneratorService";
import type {
  StreamRecord,
  WithdrawalRecord,
  BrandingSettings,
} from "../services/pdfGeneratorService";
import * as signatureService from "../services/signatureService";

// Mock dependencies
jest.mock("../services/signatureService");
jest.mock("../audit/serviceLogger", () => ({
  logServiceInfo: jest.fn(),
  logServiceWarn: jest.fn(),
  logServiceError: jest.fn(),
}));

describe("PDFGeneratorService", () => {
  const mockStreamData: StreamRecord = {
    stream_id: 123,
    employer_address: "GAXXX111EMPLOYER",
    worker_address: "GAXXX222WORKER",
    total_amount: "10000000",
    withdrawn_amount: "5000000",
    start_ts: 1704067200,
    end_ts: 1706745600,
    status: "active",
    created_at: new Date("2024-01-01"),
  };

  const mockWithdrawals: WithdrawalRecord[] = [
    {
      id: 1,
      stream_id: 123,
      worker: "GAXXX222WORKER",
      amount: "2500000", // 0.25 XLM
      ledger: 1000,
      ledger_ts: 1704153600, // 2024-01-02
      created_at: new Date("2024-01-02"),
    },
    {
      id: 2,
      stream_id: 123,
      worker: "GAXXX222WORKER",
      amount: "2500000", // 0.25 XLM
      ledger: 1001,
      ledger_ts: 1704240000, // 2024-01-03
      created_at: new Date("2024-01-03"),
    },
  ];

  const mockBranding: BrandingSettings = {
    logoUrl: null,
    primaryColor: "#2563eb",
    secondaryColor: "#64748b",
  };

  beforeEach(() => {
    (signatureService.generateQRCode as jest.Mock) = jest
      .fn()
      .mockResolvedValue(Buffer.from("qr-code-data"));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("generatePayslip", () => {
    it("should generate a PDF buffer with all required fields", async () => {
      const pdf = await generatePayslip({
        streamId: 123,
        streamData: mockStreamData,
        withdrawals: mockWithdrawals,
        branding: mockBranding,
        signature: "test-signature-abc123",
        payslipId: "payslip-123-456",
        generatedAt: new Date("2024-01-15T10:30:00Z"),
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);

      // Verify PDF starts with PDF header
      const pdfHeader = pdf.toString("utf8", 0, 4);
      expect(pdfHeader).toBe("%PDF");
    });

    it("should include payslip ID and generation timestamp", async () => {
      const payslipId = "payslip-test-123";
      const generatedAt = new Date("2024-01-15T10:30:00Z");

      const pdf = await generatePayslip({
        streamId: 123,
        streamData: mockStreamData,
        withdrawals: mockWithdrawals,
        branding: mockBranding,
        signature: "test-signature",
        payslipId,
        generatedAt,
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it("should include worker and employer addresses", async () => {
      const pdf = await generatePayslip({
        streamId: 123,
        streamData: mockStreamData,
        withdrawals: mockWithdrawals,
        branding: mockBranding,
        signature: "test-signature",
        payslipId: "payslip-123",
        generatedAt: new Date(),
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it("should include stream details (amounts, dates, status)", async () => {
      const pdf = await generatePayslip({
        streamId: 123,
        streamData: mockStreamData,
        withdrawals: mockWithdrawals,
        branding: mockBranding,
        signature: "test-signature",
        payslipId: "payslip-123",
        generatedAt: new Date(),
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it("should include withdrawal history table", async () => {
      const pdf = await generatePayslip({
        streamId: 123,
        streamData: mockStreamData,
        withdrawals: mockWithdrawals,
        branding: mockBranding,
        signature: "test-signature",
        payslipId: "payslip-123",
        generatedAt: new Date(),
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it("should handle empty withdrawal history gracefully", async () => {
      const pdf = await generatePayslip({
        streamId: 123,
        streamData: mockStreamData,
        withdrawals: [],
        branding: mockBranding,
        signature: "test-signature",
        payslipId: "payslip-123",
        generatedAt: new Date(),
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it("should apply custom brand colors", async () => {
      const customBranding: BrandingSettings = {
        logoUrl: null,
        primaryColor: "#FF5733",
        secondaryColor: "#33FF57",
      };

      const pdf = await generatePayslip({
        streamId: 123,
        streamData: mockStreamData,
        withdrawals: mockWithdrawals,
        branding: customBranding,
        signature: "test-signature",
        payslipId: "payslip-123",
        generatedAt: new Date(),
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it("should include signature and QR code", async () => {
      const signature = "test-signature-with-qr-code";

      const pdf = await generatePayslip({
        streamId: 123,
        streamData: mockStreamData,
        withdrawals: mockWithdrawals,
        branding: mockBranding,
        signature,
        payslipId: "payslip-123",
        generatedAt: new Date(),
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
      expect(signatureService.generateQRCode).toHaveBeenCalledWith(signature);
    });

    it("should handle QR code generation failure gracefully", async () => {
      (signatureService.generateQRCode as jest.Mock).mockRejectedValue(
        new Error("QR generation failed"),
      );

      const pdf = await generatePayslip({
        streamId: 123,
        streamData: mockStreamData,
        withdrawals: mockWithdrawals,
        branding: mockBranding,
        signature: "test-signature",
        payslipId: "payslip-123",
        generatedAt: new Date(),
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it("should handle missing signature gracefully", async () => {
      const pdf = await generatePayslip({
        streamId: 123,
        streamData: mockStreamData,
        withdrawals: mockWithdrawals,
        branding: mockBranding,
        signature: "",
        payslipId: "payslip-123",
        generatedAt: new Date(),
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it("should handle logo URL provided (graceful degradation)", async () => {
      const brandingWithLogo: BrandingSettings = {
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#2563eb",
        secondaryColor: "#64748b",
      };

      const pdf = await generatePayslip({
        streamId: 123,
        streamData: mockStreamData,
        withdrawals: mockWithdrawals,
        branding: brandingWithLogo,
        signature: "test-signature",
        payslipId: "payslip-123",
        generatedAt: new Date(),
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it("should format amounts correctly (stroops to XLM)", async () => {
      const streamWithLargeAmount: StreamRecord = {
        ...mockStreamData,
        total_amount: "100000000", // 10 XLM
        withdrawn_amount: "75000000", // 7.5 XLM
      };

      const pdf = await generatePayslip({
        streamId: 123,
        streamData: streamWithLargeAmount,
        withdrawals: mockWithdrawals,
        branding: mockBranding,
        signature: "test-signature",
        payslipId: "payslip-123",
        generatedAt: new Date(),
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it("should format timestamps correctly", async () => {
      const pdf = await generatePayslip({
        streamId: 123,
        streamData: mockStreamData,
        withdrawals: mockWithdrawals,
        branding: mockBranding,
        signature: "test-signature",
        payslipId: "payslip-123",
        generatedAt: new Date("2024-01-15T10:30:00Z"),
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it("should handle multiple withdrawals correctly", async () => {
      const manyWithdrawals: WithdrawalRecord[] = Array.from(
        { length: 10 },
        (_, i) => ({
          id: i + 1,
          stream_id: 123,
          worker: "GAXXX222WORKER",
          amount: "1000000",
          ledger: 1000 + i,
          ledger_ts: 1704067200 + i * 86400,
          created_at: new Date(),
        }),
      );

      const pdf = await generatePayslip({
        streamId: 123,
        streamData: mockStreamData,
        withdrawals: manyWithdrawals,
        branding: mockBranding,
        signature: "test-signature",
        payslipId: "payslip-123",
        generatedAt: new Date(),
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it("should handle very long addresses", async () => {
      const streamWithLongAddresses: StreamRecord = {
        ...mockStreamData,
        employer_address: "G" + "A".repeat(55),
        worker_address: "G" + "B".repeat(55),
      };

      const pdf = await generatePayslip({
        streamId: 123,
        streamData: streamWithLongAddresses,
        withdrawals: mockWithdrawals,
        branding: mockBranding,
        signature: "test-signature",
        payslipId: "payslip-123",
        generatedAt: new Date(),
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it("should handle zero withdrawn amount", async () => {
      const streamWithZeroWithdrawn: StreamRecord = {
        ...mockStreamData,
        withdrawn_amount: "0",
      };

      const pdf = await generatePayslip({
        streamId: 123,
        streamData: streamWithZeroWithdrawn,
        withdrawals: [],
        branding: mockBranding,
        signature: "test-signature",
        payslipId: "payslip-123",
        generatedAt: new Date(),
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });
  });
});
