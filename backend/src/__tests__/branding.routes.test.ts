import request from "supertest";
import express from "express";
import { brandingRouter } from "../routes/branding";
import * as brandingService from "../services/brandingService";

// Mock dependencies
jest.mock("../services/brandingService");
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

const app = express();
app.use(express.json());
app.use("/api/employers", brandingRouter);

describe("Branding Router", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/employers/:address/branding/logo", () => {
    it("should return 403 when user tries to upload logo for another employer", async () => {
      const response = await request(app)
        .post("/api/employers/GAXXX222/branding/logo")
        .set("x-user-id", "GAXXX111")
        .attach("logo", Buffer.from("fake image"), "logo.png");

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Forbidden");
    });

    it("should return 400 when no file is provided", async () => {
      const response = await request(app)
        .post("/api/employers/GAXXX111/branding/logo")
        .set("x-user-id", "GAXXX111");

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Logo file is required");
    });

    it("should upload logo successfully", async () => {
      const mockResult = {
        logoUrl: "https://example.com/logo.png",
        metadata: {
          size: 1024,
          format: "png",
          uploadedAt: new Date(),
        },
      };

      (brandingService.uploadLogo as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post("/api/employers/GAXXX111/branding/logo")
        .set("x-user-id", "GAXXX111")
        .attach("logo", Buffer.from("fake image"), "logo.png");

      expect(response.status).toBe(200);
      expect(response.body.logoUrl).toBe(mockResult.logoUrl);
      expect(response.body.metadata).toBeDefined();
    });

    it("should return 400 for invalid file", async () => {
      (brandingService.uploadLogo as jest.Mock).mockRejectedValue(
        new Error("Invalid file format"),
      );

      const response = await request(app)
        .post("/api/employers/GAXXX111/branding/logo")
        .set("x-user-id", "GAXXX111")
        .attach("logo", Buffer.from("fake image"), "logo.txt");

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/employers/:address/branding/colors", () => {
    it("should return 403 when user tries to update colors for another employer", async () => {
      const response = await request(app)
        .put("/api/employers/GAXXX222/branding/colors")
        .set("x-user-id", "GAXXX111")
        .send({ primaryColor: "#FF5733" });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Forbidden");
    });

    it("should update colors successfully", async () => {
      const mockResult = {
        primaryColor: "#FF5733",
        secondaryColor: "#33FF57",
        updatedAt: new Date(),
      };

      (brandingService.updateColors as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .put("/api/employers/GAXXX111/branding/colors")
        .set("x-user-id", "GAXXX111")
        .send({ primaryColor: "#FF5733", secondaryColor: "#33FF57" });

      expect(response.status).toBe(200);
      expect(response.body.primaryColor).toBe("#FF5733");
      expect(response.body.secondaryColor).toBe("#33FF57");
    });

    it("should return 400 when no colors provided", async () => {
      const response = await request(app)
        .put("/api/employers/GAXXX111/branding/colors")
        .set("x-user-id", "GAXXX111")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("At least one color");
    });
  });

  describe("GET /api/employers/:address/branding", () => {
    it("should return 403 when user tries to view another employers branding", async () => {
      const response = await request(app)
        .get("/api/employers/GAXXX222/branding")
        .set("x-user-id", "GAXXX111");

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Forbidden");
    });

    it("should return branding settings", async () => {
      const mockBranding = {
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#2563eb",
        secondaryColor: "#64748b",
        updatedAt: new Date(),
      };

      (brandingService.getBranding as jest.Mock).mockResolvedValue(
        mockBranding,
      );

      const response = await request(app)
        .get("/api/employers/GAXXX111/branding")
        .set("x-user-id", "GAXXX111");

      expect(response.status).toBe(200);
      expect(response.body.employerAddress).toBe("GAXXX111");
      expect(response.body.logoUrl).toBe(mockBranding.logoUrl);
      expect(response.body.primaryColor).toBe(mockBranding.primaryColor);
    });
  });

  describe("DELETE /api/employers/:address/branding/logo", () => {
    it("should return 403 when user tries to delete logo for another employer", async () => {
      const response = await request(app)
        .delete("/api/employers/GAXXX222/branding/logo")
        .set("x-user-id", "GAXXX111");

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Forbidden");
    });

    it("should delete logo successfully", async () => {
      (brandingService.deleteLogo as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .delete("/api/employers/GAXXX111/branding/logo")
        .set("x-user-id", "GAXXX111");

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("deleted successfully");
    });
  });
});
