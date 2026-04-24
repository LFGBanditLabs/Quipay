import { Router, Response, Request } from "express";
import multer from "multer";
import { validateRequest } from "../middleware/validation";
import {
  authenticateRequest,
  requireUser,
  AuthenticatedRequest,
} from "../middleware/rbac";
import { z } from "zod";
import {
  uploadLogo,
  updateColors,
  getBranding,
  deleteLogo,
} from "../services/brandingService";
import { logServiceInfo, logServiceError } from "../audit/serviceLogger";

// Extend AuthenticatedRequest to include file from multer
interface AuthenticatedRequestWithFile extends AuthenticatedRequest {
  file?: Express.Multer.File;
}

export const brandingRouter = Router();

// Configure multer for file uploads (memory storage for now)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
});

// Schema for color update
const updateColorsSchema = z.object({
  primaryColor: z
    .string()
    .regex(
      /^#[0-9A-Fa-f]{6}$/,
      "Primary color must be valid hex format (#RRGGBB)",
    )
    .optional(),
  secondaryColor: z
    .string()
    .regex(
      /^#[0-9A-Fa-f]{6}$/,
      "Secondary color must be valid hex format (#RRGGBB)",
    )
    .optional(),
});

/**
 * POST /api/employers/:address/branding/logo
 * Upload employer logo
 */
brandingRouter.post(
  "/:address/branding/logo",
  authenticateRequest,
  requireUser,
  upload.single("logo"),
  async (req: AuthenticatedRequestWithFile, res: Response) => {
    try {
      const { address } = req.params;

      // Authorization: verify authenticated user matches employer address
      if (!req.user || req.user.id !== address) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only manage your own branding",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Logo file is required",
        });
      }

      logServiceInfo("brandingRouter", "Logo upload requested", {
        employerAddress: address,
        filename: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
      });

      const result = await uploadLogo({
        employerAddress: address,
        file: req.file.buffer,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
      });

      logServiceInfo("brandingRouter", "Logo uploaded successfully", {
        employerAddress: address,
        logoUrl: result.logoUrl,
      });

      return res.status(200).json({
        logoUrl: result.logoUrl,
        metadata: result.metadata,
      });
    } catch (error) {
      logServiceError("brandingRouter", "Logo upload failed", {
        error: error instanceof Error ? error.message : String(error),
        employerAddress: req.params.address,
      });

      if (error instanceof Error && error.message.includes("Invalid file")) {
        return res.status(400).json({
          error: "Bad Request",
          message: error.message,
        });
      }

      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to upload logo",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

/**
 * PUT /api/employers/:address/branding/colors
 * Update employer brand colors
 */
brandingRouter.put(
  "/:address/branding/colors",
  authenticateRequest,
  requireUser,
  validateRequest({ body: updateColorsSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { address } = req.params;
      const { primaryColor, secondaryColor } = req.body;

      // Authorization: verify authenticated user matches employer address
      if (!req.user || req.user.id !== address) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only manage your own branding",
        });
      }

      if (!primaryColor && !secondaryColor) {
        return res.status(400).json({
          error: "Bad Request",
          message:
            "At least one color (primaryColor or secondaryColor) is required",
        });
      }

      logServiceInfo("brandingRouter", "Color update requested", {
        employerAddress: address,
        primaryColor,
        secondaryColor,
      });

      const result = await updateColors({
        employerAddress: address,
        primaryColor,
        secondaryColor,
      });

      logServiceInfo("brandingRouter", "Colors updated successfully", {
        employerAddress: address,
      });

      return res.status(200).json({
        primaryColor: result.primaryColor,
        secondaryColor: result.secondaryColor,
        updatedAt: result.updatedAt,
      });
    } catch (error) {
      logServiceError("brandingRouter", "Color update failed", {
        error: error instanceof Error ? error.message : String(error),
        employerAddress: req.params.address,
      });

      if (error instanceof Error && error.message.includes("Invalid hex")) {
        return res.status(400).json({
          error: "Bad Request",
          message: error.message,
        });
      }

      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to update colors",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

/**
 * GET /api/employers/:address/branding
 * Get employer branding settings
 */
brandingRouter.get(
  "/:address/branding",
  authenticateRequest,
  requireUser,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { address } = req.params;

      // Authorization: verify authenticated user matches employer address
      if (!req.user || req.user.id !== address) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only view your own branding",
        });
      }

      logServiceInfo("brandingRouter", "Branding settings requested", {
        employerAddress: address,
      });

      const branding = await getBranding(address);

      return res.status(200).json({
        employerAddress: address,
        logoUrl: branding.logoUrl,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        updatedAt: branding.updatedAt,
      });
    } catch (error) {
      logServiceError("brandingRouter", "Failed to get branding settings", {
        error: error instanceof Error ? error.message : String(error),
        employerAddress: req.params.address,
      });

      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to retrieve branding settings",
      });
    }
  },
);

/**
 * DELETE /api/employers/:address/branding/logo
 * Delete employer logo
 */
brandingRouter.delete(
  "/:address/branding/logo",
  authenticateRequest,
  requireUser,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { address } = req.params;

      // Authorization: verify authenticated user matches employer address
      if (!req.user || req.user.id !== address) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only manage your own branding",
        });
      }

      logServiceInfo("brandingRouter", "Logo deletion requested", {
        employerAddress: address,
      });

      await deleteLogo(address);

      logServiceInfo("brandingRouter", "Logo deleted successfully", {
        employerAddress: address,
      });

      return res.status(200).json({
        message: "Logo deleted successfully",
      });
    } catch (error) {
      logServiceError("brandingRouter", "Logo deletion failed", {
        error: error instanceof Error ? error.message : String(error),
        employerAddress: req.params.address,
      });

      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to delete logo",
      });
    }
  },
);
