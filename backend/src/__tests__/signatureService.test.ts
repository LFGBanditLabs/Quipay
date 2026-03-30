import {
  signPayslip,
  verifySignature,
  generateQRCode,
  generateQRCodeDataURL,
  generatePayslipId,
  validateSigningKeysConfigured,
} from "../services/signatureService";
import crypto from "crypto";

// Mock QRCode module
jest.mock("qrcode");
jest.mock("../audit/serviceLogger");

import QRCode from "qrcode";

// Create properly typed mocks
const mockToBuffer = jest.fn();
const mockToDataURL = jest.fn();

(QRCode as any).toBuffer = mockToBuffer;
(QRCode as any).toDataURL = mockToDataURL;

describe("SignatureService", () => {
  // Generate test keys for consistent testing
  const testKeys = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  beforeAll(() => {
    // Set test keys in environment
    process.env.PAYSLIP_SIGNING_KEY_PRIVATE = testKeys.privateKey;
    process.env.PAYSLIP_SIGNING_KEY_PUBLIC = testKeys.publicKey;
  });

  afterAll(() => {
    delete process.env.PAYSLIP_SIGNING_KEY_PRIVATE;
    delete process.env.PAYSLIP_SIGNING_KEY_PUBLIC;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("signPayslip", () => {
    const mockPayslipData = {
      payslipId: "payslip-123",
      workerAddress: "GABC123",
      period: "2025-01",
      totalGrossAmount: "1000.00",
      streamIds: [1, 2, 3],
      generatedAt: new Date("2025-01-15T10:00:00Z"),
    };

    it("should generate a valid signature", async () => {
      const signature = await signPayslip(mockPayslipData);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe("string");
      expect(signature.length).toBeGreaterThan(0);
      // Base64 encoded signature
      expect(signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it("should generate different signatures for different data", async () => {
      const signature1 = await signPayslip(mockPayslipData);
      const signature2 = await signPayslip({
        ...mockPayslipData,
        totalGrossAmount: "2000.00",
      });

      expect(signature1).not.toBe(signature2);
    });

    it("should generate same signature for same data", async () => {
      const signature1 = await signPayslip(mockPayslipData);
      const signature2 = await signPayslip(mockPayslipData);

      expect(signature1).toBe(signature2);
    });

    it("should handle stream IDs in any order", async () => {
      const data1 = { ...mockPayslipData, streamIds: [3, 1, 2] };
      const data2 = { ...mockPayslipData, streamIds: [1, 2, 3] };

      const signature1 = await signPayslip(data1);
      const signature2 = await signPayslip(data2);

      // Should be same because stream IDs are sorted before signing
      expect(signature1).toBe(signature2);
    });
  });

  describe("verifySignature", () => {
    const mockPayslipData = {
      payslipId: "payslip-123",
      workerAddress: "GABC123",
      period: "2025-01",
      totalGrossAmount: "1000.00",
      streamIds: [1, 2, 3],
      generatedAt: new Date("2025-01-15T10:00:00Z"),
    };

    it("should verify a valid signature", async () => {
      const signature = await signPayslip(mockPayslipData);
      const isValid = await verifySignature({
        signature,
        payslipData: mockPayslipData,
      });

      expect(isValid).toBe(true);
    });

    it("should reject an invalid signature", async () => {
      const signature = await signPayslip(mockPayslipData);
      const tamperedData = {
        ...mockPayslipData,
        totalGrossAmount: "2000.00",
      };

      const isValid = await verifySignature({
        signature,
        payslipData: tamperedData,
      });

      expect(isValid).toBe(false);
    });

    it("should reject a malformed signature", async () => {
      const isValid = await verifySignature({
        signature: "invalid-signature",
        payslipData: mockPayslipData,
      });

      expect(isValid).toBe(false);
    });

    it("should reject an empty signature", async () => {
      const isValid = await verifySignature({
        signature: "",
        payslipData: mockPayslipData,
      });

      expect(isValid).toBe(false);
    });

    it("should verify signature with stream IDs in different order", async () => {
      const data1 = { ...mockPayslipData, streamIds: [3, 1, 2] };
      const signature = await signPayslip(data1);

      const data2 = { ...mockPayslipData, streamIds: [1, 2, 3] };
      const isValid = await verifySignature({
        signature,
        payslipData: data2,
      });

      expect(isValid).toBe(true);
    });
  });

  describe("generateQRCode", () => {
    it("should generate QR code buffer", async () => {
      const mockBuffer = Buffer.from("fake-qr-code");
      mockToBuffer.mockResolvedValue(mockBuffer);

      const signature = "test-signature-123";
      const qrCode = await generateQRCode(signature);

      expect(qrCode).toBe(mockBuffer);
      expect(mockToBuffer).toHaveBeenCalledWith(
        signature,
        expect.objectContaining({
          errorCorrectionLevel: "M",
          type: "png",
          width: 200,
        }),
      );
    });

    it("should throw error if QR code generation fails", async () => {
      mockToBuffer.mockRejectedValue(new Error("QR generation failed"));

      await expect(generateQRCode("test-signature")).rejects.toThrow(
        "Failed to generate QR code",
      );
    });
  });

  describe("generateQRCodeDataURL", () => {
    it("should generate QR code data URL", async () => {
      const mockDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...";
      mockToDataURL.mockResolvedValue(mockDataUrl);

      const signature = "test-signature-123";
      const dataUrl = await generateQRCodeDataURL(signature);

      expect(dataUrl).toBe(mockDataUrl);
      expect(mockToDataURL).toHaveBeenCalledWith(
        signature,
        expect.objectContaining({
          errorCorrectionLevel: "M",
          type: "image/png",
          width: 200,
        }),
      );
    });

    it("should throw error if data URL generation fails", async () => {
      mockToDataURL.mockRejectedValue(new Error("Data URL generation failed"));

      await expect(generateQRCodeDataURL("test-signature")).rejects.toThrow(
        "Failed to generate QR code data URL",
      );
    });
  });

  describe("generatePayslipId", () => {
    it("should generate unique payslip IDs", () => {
      const id1 = generatePayslipId();
      const id2 = generatePayslipId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^payslip-\d+-[a-f0-9]{8}$/);
      expect(id2).toMatch(/^payslip-\d+-[a-f0-9]{8}$/);
    });

    it("should generate IDs with correct format", () => {
      const id = generatePayslipId();

      expect(id).toMatch(/^payslip-\d+-[a-f0-9]{8}$/);
      expect(id.startsWith("payslip-")).toBe(true);
    });
  });

  describe("validateSigningKeysConfigured", () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it("should not throw in development without keys", () => {
      process.env.NODE_ENV = "development";
      delete process.env.PAYSLIP_SIGNING_KEY_PRIVATE;
      delete process.env.PAYSLIP_SIGNING_KEY_PUBLIC;

      expect(() => validateSigningKeysConfigured()).not.toThrow();
    });

    it("should throw in production without keys", () => {
      process.env.NODE_ENV = "production";
      delete process.env.PAYSLIP_SIGNING_KEY_PRIVATE;
      delete process.env.PAYSLIP_SIGNING_KEY_PUBLIC;

      expect(() => validateSigningKeysConfigured()).toThrow(
        "Signing keys not configured",
      );
    });

    it("should not throw in production with keys", () => {
      process.env.NODE_ENV = "production";
      process.env.PAYSLIP_SIGNING_KEY_PRIVATE = testKeys.privateKey;
      process.env.PAYSLIP_SIGNING_KEY_PUBLIC = testKeys.publicKey;

      expect(() => validateSigningKeysConfigured()).not.toThrow();
    });
  });

  describe("signature round-trip", () => {
    it("should sign and verify multiple payslips", async () => {
      const payslips = [
        {
          payslipId: "payslip-1",
          workerAddress: "GABC123",
          period: "2025-01",
          totalGrossAmount: "1000.00",
          streamIds: [1],
          generatedAt: new Date("2025-01-15T10:00:00Z"),
        },
        {
          payslipId: "payslip-2",
          workerAddress: "GDEF456",
          period: "2025-02",
          totalGrossAmount: "2000.00",
          streamIds: [2, 3],
          generatedAt: new Date("2025-02-15T10:00:00Z"),
        },
        {
          payslipId: "payslip-3",
          workerAddress: "GHIJ789",
          period: "2025-03",
          totalGrossAmount: "3000.00",
          streamIds: [4, 5, 6],
          generatedAt: new Date("2025-03-15T10:00:00Z"),
        },
      ];

      for (const payslip of payslips) {
        const signature = await signPayslip(payslip);
        const isValid = await verifySignature({
          signature,
          payslipData: payslip,
        });

        expect(isValid).toBe(true);
      }
    });

    it("should detect tampering with any field", async () => {
      const original = {
        payslipId: "payslip-123",
        workerAddress: "GABC123",
        period: "2025-01",
        totalGrossAmount: "1000.00",
        streamIds: [1, 2, 3],
        generatedAt: new Date("2025-01-15T10:00:00Z"),
      };

      const signature = await signPayslip(original);

      // Test tampering with each field
      const tamperedVersions = [
        { ...original, payslipId: "payslip-456" },
        { ...original, workerAddress: "GDEF456" },
        { ...original, period: "2025-02" },
        { ...original, totalGrossAmount: "2000.00" },
        { ...original, streamIds: [1, 2, 3, 4] },
        { ...original, generatedAt: new Date("2025-01-16T10:00:00Z") },
      ];

      for (const tampered of tamperedVersions) {
        const isValid = await verifySignature({
          signature,
          payslipData: tampered,
        });

        expect(isValid).toBe(false);
      }
    });
  });
});
