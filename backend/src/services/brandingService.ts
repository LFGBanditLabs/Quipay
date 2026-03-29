import { query } from "../db/pool";
import { globalCache } from "../utils/cache";
import {
  logServiceInfo,
  logServiceWarn,
  logServiceError,
} from "../audit/serviceLogger";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const SERVICE_NAME = "BrandingService";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrandingSettings {
  employerAddress: string;
  logoUrl: string | null;
  logoMetadata: LogoMetadata | null;
  primaryColor: string;
  secondaryColor: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LogoMetadata {
  size: number;
  format: string;
  uploadedAt: Date;
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface UploadLogoParams {
  employerAddress: string;
  file: Buffer;
  filename: string;
  mimeType: string;
}

export interface UpdateColorsParams {
  employerAddress: string;
  primaryColor: string;
  secondaryColor: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_PRIMARY_COLOR = "#2563eb";
const DEFAULT_SECONDARY_COLOR = "#64748b";
const CACHE_TTL_SECONDS = 3600; // 1 hour
const LOGO_STORAGE_PATH = process.env.LOGO_STORAGE_PATH || "./uploads/logos";

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates an image file for logo upload
 */
export const validateImageFile = async (
  file: Buffer,
  mimeType: string,
): Promise<{ valid: boolean; error?: string }> => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `Invalid file format. Allowed formats: PNG, JPG, SVG`,
    };
  }

  // Check file size
  if (file.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 2MB limit (${(file.length / 1024 / 1024).toFixed(2)}MB)`,
    };
  }

  return { valid: true };
};

/**
 * Validates a hex color code
 */
export const validateHexColor = (color: string): boolean => {
  return HEX_COLOR_REGEX.test(color);
};

// ─── Storage ──────────────────────────────────────────────────────────────────

/**
 * Stores a logo file to local filesystem (or S3 in production)
 * Returns the URL to access the logo
 */
const storeLogoFile = async (
  employerAddress: string,
  file: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> => {
  // Ensure storage directory exists
  await fs.mkdir(LOGO_STORAGE_PATH, { recursive: true });

  // Generate unique filename
  const ext = path.extname(filename);
  const hash = crypto.createHash("md5").update(file).digest("hex").slice(0, 8);
  const storedFilename = `${employerAddress}-${hash}${ext}`;
  const filePath = path.join(LOGO_STORAGE_PATH, storedFilename);

  // Write file
  await fs.writeFile(filePath, file);

  // Return URL (in production, this would be an S3 URL)
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3001";
  return `${baseUrl}/logos/${storedFilename}`;
};

/**
 * Deletes a logo file from storage
 */
const deleteLogoFile = async (logoUrl: string): Promise<void> => {
  try {
    // Extract filename from URL
    const filename = logoUrl.split("/").pop();
    if (!filename) return;

    const filePath = path.join(LOGO_STORAGE_PATH, filename);
    await fs.unlink(filePath);
  } catch (error) {
    // Log but don't throw - file might already be deleted
    await logServiceWarn(SERVICE_NAME, "Failed to delete logo file", {
      logoUrl,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// ─── Database Queries ─────────────────────────────────────────────────────────

/**
 * Upserts employer branding settings in the database
 */
const upsertEmployerBranding = async (
  employerAddress: string,
  logoUrl: string | null,
  logoMetadata: LogoMetadata | null,
  primaryColor: string,
  secondaryColor: string,
): Promise<void> => {
  await query(
    `
    INSERT INTO employer_branding (
      employer_address,
      logo_url,
      logo_metadata,
      primary_color,
      secondary_color,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (employer_address)
    DO UPDATE SET
      logo_url = EXCLUDED.logo_url,
      logo_metadata = EXCLUDED.logo_metadata,
      primary_color = EXCLUDED.primary_color,
      secondary_color = EXCLUDED.secondary_color,
      updated_at = NOW()
  `,
    [
      employerAddress,
      logoUrl,
      logoMetadata ? JSON.stringify(logoMetadata) : null,
      primaryColor,
      secondaryColor,
    ],
  );
};

/**
 * Gets employer branding settings from the database
 */
const getEmployerBrandingFromDb = async (
  employerAddress: string,
): Promise<BrandingSettings | null> => {
  const result = await query<{
    employer_address: string;
    logo_url: string | null;
    logo_metadata: string | null;
    primary_color: string;
    secondary_color: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `
    SELECT
      employer_address,
      logo_url,
      logo_metadata,
      primary_color,
      secondary_color,
      created_at,
      updated_at
    FROM employer_branding
    WHERE employer_address = $1
  `,
    [employerAddress],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    employerAddress: row.employer_address,
    logoUrl: row.logo_url,
    logoMetadata: row.logo_metadata ? JSON.parse(row.logo_metadata) : null,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

/**
 * Deletes employer logo from the database (sets to null)
 */
const deleteEmployerLogoFromDb = async (
  employerAddress: string,
): Promise<void> => {
  await query(
    `
    UPDATE employer_branding
    SET logo_url = NULL,
        logo_metadata = NULL,
        updated_at = NOW()
    WHERE employer_address = $1
  `,
    [employerAddress],
  );
};

// ─── Cache Helpers ────────────────────────────────────────────────────────────

const getCacheKey = (employerAddress: string): string =>
  `branding:${employerAddress}`;

const invalidateBrandingCache = (employerAddress: string): void => {
  globalCache.del(getCacheKey(employerAddress));
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Uploads and stores an employer logo
 * Validates file type and size, stores the file, and updates the database
 */
export const uploadLogo = async (
  params: UploadLogoParams,
): Promise<{ logoUrl: string; metadata: LogoMetadata }> => {
  const { employerAddress, file, filename, mimeType } = params;

  // Validate file
  const validation = await validateImageFile(file, mimeType);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Get current branding to check if logo exists
  const currentBranding = await getEmployerBrandingFromDb(employerAddress);

  // Delete old logo file if exists
  if (currentBranding?.logoUrl) {
    await deleteLogoFile(currentBranding.logoUrl);
  }

  // Store new logo file
  const logoUrl = await storeLogoFile(
    employerAddress,
    file,
    filename,
    mimeType,
  );

  // Create metadata
  const metadata: LogoMetadata = {
    size: file.length,
    format: mimeType.split("/")[1],
    uploadedAt: new Date(),
  };

  // Update database
  await upsertEmployerBranding(
    employerAddress,
    logoUrl,
    metadata,
    currentBranding?.primaryColor || DEFAULT_PRIMARY_COLOR,
    currentBranding?.secondaryColor || DEFAULT_SECONDARY_COLOR,
  );

  // Invalidate cache
  invalidateBrandingCache(employerAddress);

  await logServiceInfo(SERVICE_NAME, "Logo uploaded successfully", {
    employerAddress,
    logoUrl,
    size: metadata.size.toString(),
  });

  return { logoUrl, metadata };
};

/**
 * Updates employer brand colors
 * Validates hex color format and updates the database
 */
export const updateColors = async (
  params: UpdateColorsParams,
): Promise<BrandingSettings> => {
  const { employerAddress, primaryColor, secondaryColor } = params;

  // Validate colors
  if (!validateHexColor(primaryColor)) {
    throw new Error(
      `Invalid primary color format: ${primaryColor}. Must be hex format (#RRGGBB)`,
    );
  }
  if (!validateHexColor(secondaryColor)) {
    throw new Error(
      `Invalid secondary color format: ${secondaryColor}. Must be hex format (#RRGGBB)`,
    );
  }

  // Get current branding
  const currentBranding = await getEmployerBrandingFromDb(employerAddress);

  // Update database
  await upsertEmployerBranding(
    employerAddress,
    currentBranding?.logoUrl || null,
    currentBranding?.logoMetadata || null,
    primaryColor,
    secondaryColor,
  );

  // Invalidate cache
  invalidateBrandingCache(employerAddress);

  await logServiceInfo(SERVICE_NAME, "Brand colors updated", {
    employerAddress,
    primaryColor,
    secondaryColor,
  });

  // Return updated branding
  return getBranding(employerAddress);
};

/**
 * Gets employer branding settings with caching
 * Returns default colors if no branding is set
 */
export const getBranding = async (
  employerAddress: string,
): Promise<BrandingSettings> => {
  const cacheKey = getCacheKey(employerAddress);

  // Check cache
  const cached = globalCache.get<BrandingSettings>(cacheKey);
  if (cached) {
    return cached;
  }

  // Query database
  const branding = await getEmployerBrandingFromDb(employerAddress);

  // If no branding exists, return defaults
  if (!branding) {
    const defaultBranding: BrandingSettings = {
      employerAddress,
      logoUrl: null,
      logoMetadata: null,
      primaryColor: DEFAULT_PRIMARY_COLOR,
      secondaryColor: DEFAULT_SECONDARY_COLOR,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return defaultBranding;
  }

  // Cache and return
  globalCache.set(cacheKey, branding, CACHE_TTL_SECONDS);
  return branding;
};

/**
 * Deletes employer logo
 * Removes the logo file and updates the database
 */
export const deleteLogo = async (employerAddress: string): Promise<void> => {
  // Get current branding
  const branding = await getEmployerBrandingFromDb(employerAddress);

  if (!branding?.logoUrl) {
    return; // No logo to delete
  }

  // Delete file
  await deleteLogoFile(branding.logoUrl);

  // Update database
  await deleteEmployerLogoFromDb(employerAddress);

  // Invalidate cache
  invalidateBrandingCache(employerAddress);

  await logServiceInfo(SERVICE_NAME, "Logo deleted", { employerAddress });
};
