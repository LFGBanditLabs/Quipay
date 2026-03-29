import crypto from "crypto";
import QRCode from "qrcode";
import {
  logServiceInfo,
  logServiceWarn,
  logServiceError,
} from "../audit/serviceLogger";

const SERVICE_NAME = "SignatureService";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PayslipData {
  payslipId: string;
  workerAddress: string;
  period: string;
  totalGrossAmount: string;
  streamIds: number[];
  generatedAt: Date;
}

export interface SignPayslipParams {
  payslipId: string;
  workerAddress: string;
  period: string;
  totalGrossAmount: string;
  streamIds: number[];
  generatedAt: Date;
}

export interface VerifySignatureParams {
  signature: string;
  payslipData: PayslipData;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// In production, these should be stored in a secure key management system (Vault, AWS Secrets Manager)
// Lazy load keys to allow tests to set them
const getEnvKeys = () => ({
  private: process.env.PAYSLIP_SIGNING_KEY_PRIVATE || "",
  public: process.env.PAYSLIP_SIGNING_KEY_PUBLIC || "",
});

// QR code generation options
const QR_CODE_BUFFER_OPTIONS = {
  errorCorrectionLevel: "M" as const,
  type: "png" as const,
  width: 200,
  margin: 1,
};

const QR_CODE_DATA_URL_OPTIONS = {
  errorCorrectionLevel: "M" as const,
  type: "image/png" as const,
  width: 200,
  margin: 1,
};

// ─── Key Management ───────────────────────────────────────────────────────────

/**
 * Gets the signing key pair from environment or generates a temporary one for development
 */
const getSigningKeys = (): {
  privateKey: string;
  publicKey: string;
} => {
  const envKeys = getEnvKeys();
  // In production, keys should be loaded from secure storage
  if (envKeys.private && envKeys.public) {
    return {
      privateKey: envKeys.private,
      publicKey: envKeys.public,
    };
  }

  // Development fallback: generate temporary keys
  // WARNING: These keys are not persisted and will change on restart
  logServiceWarn(
    SERVICE_NAME,
    "No signing keys configured. Generating temporary keys for development.",
    {},
  ).catch(() => {
    // Ignore logging errors
  });

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  return { privateKey, publicKey };
};

// ─── Signature Generation ─────────────────────────────────────────────────────

/**
 * Creates a canonical string representation of payslip data for signing
 */
const createPayslipDataString = (data: PayslipData): string => {
  // Create a deterministic string representation
  // Order matters for signature verification
  const parts = [
    `payslipId:${data.payslipId}`,
    `workerAddress:${data.workerAddress}`,
    `period:${data.period}`,
    `totalGrossAmount:${data.totalGrossAmount}`,
    `streamIds:${data.streamIds.sort((a, b) => a - b).join(",")}`,
    `generatedAt:${data.generatedAt.toISOString()}`,
  ];

  return parts.join("|");
};

/**
 * Generates a cryptographic signature for payslip data using Ed25519
 * Returns a base64-encoded signature string
 */
export const signPayslip = async (
  params: SignPayslipParams,
): Promise<string> => {
  try {
    const { privateKey } = getSigningKeys();

    // Create canonical data string
    const dataString = createPayslipDataString(params);

    // Create signature using Ed25519
    const signature = crypto.sign(null, Buffer.from(dataString), {
      key: privateKey,
      format: "pem",
    });

    // Encode as base64 for easy transmission
    const signatureBase64 = signature.toString("base64");

    await logServiceInfo(SERVICE_NAME, "Payslip signed successfully", {
      payslipId: params.payslipId,
      workerAddress: params.workerAddress,
      period: params.period,
    });

    return signatureBase64;
  } catch (error) {
    await logServiceError(SERVICE_NAME, "Failed to sign payslip", {
      payslipId: params.payslipId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Failed to generate signature");
  }
};

// ─── Signature Verification ───────────────────────────────────────────────────

/**
 * Verifies a payslip signature against the provided data
 * Returns true if signature is valid, false otherwise
 */
export const verifySignature = async (
  params: VerifySignatureParams,
): Promise<boolean> => {
  try {
    const { signature, payslipData } = params;
    const { publicKey } = getSigningKeys();

    // Create canonical data string
    const dataString = createPayslipDataString(payslipData);

    // Decode signature from base64
    const signatureBuffer = Buffer.from(signature, "base64");

    // Verify signature using Ed25519
    const isValid = crypto.verify(
      null,
      Buffer.from(dataString),
      {
        key: publicKey,
        format: "pem",
      },
      signatureBuffer,
    );

    await logServiceInfo(SERVICE_NAME, "Signature verification completed", {
      payslipId: payslipData.payslipId,
      isValid: isValid.toString(),
    });

    return isValid;
  } catch (error) {
    await logServiceError(SERVICE_NAME, "Signature verification failed", {
      payslipId: params.payslipData.payslipId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

// ─── QR Code Generation ───────────────────────────────────────────────────────

/**
 * Generates a QR code image from a signature string
 * Returns a Buffer containing the PNG image data
 */
export const generateQRCode = async (signature: string): Promise<Buffer> => {
  try {
    // Generate QR code as PNG buffer
    const qrCodeBuffer = await QRCode.toBuffer(
      signature,
      QR_CODE_BUFFER_OPTIONS,
    );

    await logServiceInfo(SERVICE_NAME, "QR code generated successfully", {
      signatureLength: signature.length.toString(),
      bufferSize: qrCodeBuffer.length.toString(),
    });

    return qrCodeBuffer;
  } catch (error) {
    await logServiceError(SERVICE_NAME, "Failed to generate QR code", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Failed to generate QR code");
  }
};

/**
 * Generates a QR code as a data URL (base64-encoded PNG)
 * Useful for embedding directly in HTML/PDF
 */
export const generateQRCodeDataURL = async (
  signature: string,
): Promise<string> => {
  try {
    const dataUrl = await QRCode.toDataURL(signature, QR_CODE_DATA_URL_OPTIONS);

    await logServiceInfo(
      SERVICE_NAME,
      "QR code data URL generated successfully",
      {},
    );

    return dataUrl;
  } catch (error) {
    await logServiceError(SERVICE_NAME, "Failed to generate QR code data URL", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Failed to generate QR code data URL");
  }
};

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Generates a unique payslip ID
 * Format: payslip-{timestamp}-{random}
 */
export const generatePayslipId = (): string => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString("hex");
  return `payslip-${timestamp}-${random}`;
};

/**
 * Validates that signing keys are properly configured
 * Throws an error if keys are missing in production
 */
export const validateSigningKeysConfigured = (): void => {
  const envKeys = getEnvKeys();
  if (
    process.env.NODE_ENV === "production" &&
    (!envKeys.private || !envKeys.public)
  ) {
    throw new Error(
      "Signing keys not configured. Set PAYSLIP_SIGNING_KEY_PRIVATE and PAYSLIP_SIGNING_KEY_PUBLIC environment variables.",
    );
  }
};
