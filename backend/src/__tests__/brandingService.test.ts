import {
  validateImageFile,
  validateHexColor,
  uploadLogo,
  updateColors,
  getBranding,
  deleteLogo,
} from "../services/brandingService";
import { query } from "../db/pool";
import { globalCache } from "../utils/cache";
import fs from "fs/promises";

// Mock dependencies
jest.mock("../db/pool");
jest.mock("../utils/cache");
jest.mock("../audit/serviceLogger");
jest.mock("fs/promises");

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockCache = globalCache as jest.Mocked<typeof globalCache>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe("BrandingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.get.mockReturnValue(undefined);
  });

  describe("validateImageFile", () => {
    it("should accept valid PNG file under 2MB", async () => {
      const file = Buffer.alloc(1024 * 1024); // 1MB
      const result = await validateImageFile(file, "image/png");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept valid JPEG file", async () => {
      const file = Buffer.alloc(500 * 1024); // 500KB
      const result = await validateImageFile(file, "image/jpeg");

      expect(result.valid).toBe(true);
    });

    it("should accept valid SVG file", async () => {
      const file = Buffer.alloc(100 * 1024); // 100KB
      const result = await validateImageFile(file, "image/svg+xml");

      expect(result.valid).toBe(true);
    });

    it("should reject file over 2MB", async () => {
      const file = Buffer.alloc(3 * 1024 * 1024); // 3MB
      const result = await validateImageFile(file, "image/png");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds 2MB limit");
    });

    it("should reject invalid MIME type", async () => {
      const file = Buffer.alloc(1024);
      const result = await validateImageFile(file, "image/gif");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid file format");
    });

    it("should reject non-image MIME type", async () => {
      const file = Buffer.alloc(1024);
      const result = await validateImageFile(file, "application/pdf");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid file format");
    });
  });

  describe("validateHexColor", () => {
    it("should accept valid hex colors", () => {
      expect(validateHexColor("#000000")).toBe(true);
      expect(validateHexColor("#FFFFFF")).toBe(true);
      expect(validateHexColor("#2563eb")).toBe(true);
      expect(validateHexColor("#64748b")).toBe(true);
      expect(validateHexColor("#AbCdEf")).toBe(true);
    });

    it("should reject invalid hex colors", () => {
      expect(validateHexColor("000000")).toBe(false); // Missing #
      expect(validateHexColor("#00000")).toBe(false); // Too short
      expect(validateHexColor("#0000000")).toBe(false); // Too long
      expect(validateHexColor("#GGGGGG")).toBe(false); // Invalid characters
      expect(validateHexColor("red")).toBe(false); // Color name
      expect(validateHexColor("#12-34-56")).toBe(false); // Dashes
    });
  });

  describe("uploadLogo", () => {
    const mockEmployerAddress = "GABC123";
    const mockFile = Buffer.from("fake-image-data");
    const mockFilename = "logo.png";
    const mockMimeType = "image/png";

    beforeEach(() => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    });

    it("should upload logo successfully", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // No existing branding

      const result = await uploadLogo({
        employerAddress: mockEmployerAddress,
        file: mockFile,
        filename: mockFilename,
        mimeType: mockMimeType,
      });

      expect(result.logoUrl).toContain(mockEmployerAddress);
      expect(result.metadata.size).toBe(mockFile.length);
      expect(result.metadata.format).toBe("png");
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO employer_branding"),
        expect.any(Array),
      );
    });

    it("should reject file that is too large", async () => {
      const largeFile = Buffer.alloc(3 * 1024 * 1024); // 3MB

      await expect(
        uploadLogo({
          employerAddress: mockEmployerAddress,
          file: largeFile,
          filename: mockFilename,
          mimeType: mockMimeType,
        }),
      ).rejects.toThrow("exceeds 2MB limit");
    });

    it("should reject invalid file type", async () => {
      await expect(
        uploadLogo({
          employerAddress: mockEmployerAddress,
          file: mockFile,
          filename: "document.pdf",
          mimeType: "application/pdf",
        }),
      ).rejects.toThrow("Invalid file format");
    });

    it("should delete old logo when uploading new one", async () => {
      const oldLogoUrl = "http://localhost:3001/logos/old-logo.png";
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            employer_address: mockEmployerAddress,
            logo_url: oldLogoUrl,
            logo_metadata: JSON.stringify({ size: 1000, format: "png" }),
            primary_color: "#2563eb",
            secondary_color: "#64748b",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      } as any);

      mockFs.unlink.mockResolvedValue(undefined);

      await uploadLogo({
        employerAddress: mockEmployerAddress,
        file: mockFile,
        filename: mockFilename,
        mimeType: mockMimeType,
      });

      expect(mockFs.unlink).toHaveBeenCalled();
    });
  });

  describe("updateColors", () => {
    const mockEmployerAddress = "GABC123";

    beforeEach(() => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    });

    it("should update colors successfully", async () => {
      const primaryColor = "#FF0000";
      const secondaryColor = "#00FF00";

      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // Get current branding
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // Update
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // Get updated branding

      const result = await updateColors({
        employerAddress: mockEmployerAddress,
        primaryColor,
        secondaryColor,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO employer_branding"),
        expect.arrayContaining([primaryColor, secondaryColor]),
      );
    });

    it("should reject invalid primary color", async () => {
      await expect(
        updateColors({
          employerAddress: mockEmployerAddress,
          primaryColor: "invalid",
          secondaryColor: "#00FF00",
        }),
      ).rejects.toThrow("Invalid primary color format");
    });

    it("should reject invalid secondary color", async () => {
      await expect(
        updateColors({
          employerAddress: mockEmployerAddress,
          primaryColor: "#FF0000",
          secondaryColor: "blue",
        }),
      ).rejects.toThrow("Invalid secondary color format");
    });

    it("should preserve logo when updating colors", async () => {
      const logoUrl = "http://localhost:3001/logos/logo.png";
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            employer_address: mockEmployerAddress,
            logo_url: logoUrl,
            logo_metadata: JSON.stringify({ size: 1000, format: "png" }),
            primary_color: "#2563eb",
            secondary_color: "#64748b",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      } as any);

      await updateColors({
        employerAddress: mockEmployerAddress,
        primaryColor: "#FF0000",
        secondaryColor: "#00FF00",
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO employer_branding"),
        expect.arrayContaining([logoUrl]),
      );
    });
  });

  describe("getBranding", () => {
    const mockEmployerAddress = "GABC123";

    it("should return cached branding if available", async () => {
      const cachedBranding = {
        employerAddress: mockEmployerAddress,
        logoUrl: "http://localhost:3001/logos/logo.png",
        logoMetadata: { size: 1000, format: "png", uploadedAt: new Date() },
        primaryColor: "#2563eb",
        secondaryColor: "#64748b",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCache.get.mockReturnValue(cachedBranding);

      const result = await getBranding(mockEmployerAddress);

      expect(result).toEqual(cachedBranding);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("should query database and cache result", async () => {
      const dbBranding = {
        employer_address: mockEmployerAddress,
        logo_url: "http://localhost:3001/logos/logo.png",
        logo_metadata: JSON.stringify({
          size: 1000,
          format: "png",
          uploadedAt: new Date().toISOString(),
        }),
        primary_color: "#2563eb",
        secondary_color: "#64748b",
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValue({
        rows: [dbBranding],
        rowCount: 1,
      } as any);

      const result = await getBranding(mockEmployerAddress);

      expect(result.employerAddress).toBe(mockEmployerAddress);
      expect(result.logoUrl).toBe(dbBranding.logo_url);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it("should return default branding if none exists", async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await getBranding(mockEmployerAddress);

      expect(result.employerAddress).toBe(mockEmployerAddress);
      expect(result.logoUrl).toBeNull();
      expect(result.primaryColor).toBe("#2563eb");
      expect(result.secondaryColor).toBe("#64748b");
    });
  });

  describe("deleteLogo", () => {
    const mockEmployerAddress = "GABC123";

    it("should delete logo successfully", async () => {
      const logoUrl = "http://localhost:3001/logos/logo.png";
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              employer_address: mockEmployerAddress,
              logo_url: logoUrl,
              logo_metadata: JSON.stringify({ size: 1000, format: "png" }),
              primary_color: "#2563eb",
              secondary_color: "#64748b",
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          rowCount: 1,
        } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      mockFs.unlink.mockResolvedValue(undefined);

      await deleteLogo(mockEmployerAddress);

      expect(mockFs.unlink).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE employer_branding"),
        expect.arrayContaining([mockEmployerAddress]),
      );
    });

    it("should handle case when no logo exists", async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await deleteLogo(mockEmployerAddress);

      expect(mockFs.unlink).not.toHaveBeenCalled();
    });

    it("should not throw if file deletion fails", async () => {
      const logoUrl = "http://localhost:3001/logos/logo.png";
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            employer_address: mockEmployerAddress,
            logo_url: logoUrl,
            logo_metadata: null,
            primary_color: "#2563eb",
            secondary_color: "#64748b",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      } as any);

      mockFs.unlink.mockRejectedValue(new Error("File not found"));

      // Should not throw
      await expect(deleteLogo(mockEmployerAddress)).resolves.not.toThrow();
    });
  });
});
