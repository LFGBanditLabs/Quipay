import axios from "axios";

export type EmployerVerificationStatus = "pending" | "verified" | "rejected";

export interface KybVerificationResult {
  status: EmployerVerificationStatus;
  reason?: string;
  metadata?: Record<string, unknown>;
}

const KYB_API_URL = process.env.KYB_API_URL;
const KYB_API_KEY = process.env.KYB_API_KEY;
const KYB_API_TIMEOUT_MS = Number.parseInt(
  process.env.KYB_API_TIMEOUT_MS || "5000",
  10,
);

const buildMockVerification = (
  registrationNumber: string,
): KybVerificationResult => {
  const normalized = registrationNumber.trim().toUpperCase();

  if (normalized.startsWith("REJECT")) {
    return {
      status: "rejected",
      reason: "Registration number rejected by mock KYB verifier",
      metadata: { provider: "mock", registrationNumber: normalized },
    };
  }

  if (normalized.startsWith("PENDING")) {
    return {
      status: "pending",
      reason: "Registration submitted for manual review",
      metadata: { provider: "mock", registrationNumber: normalized },
    };
  }

  return {
    status: "verified",
    metadata: { provider: "mock", registrationNumber: normalized },
  };
};

export const verifyBusinessRegistration = async (params: {
  businessName: string;
  registrationNumber: string;
  countryCode: string;
}): Promise<KybVerificationResult> => {
  if (!KYB_API_URL) {
    return buildMockVerification(params.registrationNumber);
  }

  const response = await axios.post(
    KYB_API_URL,
    {
      businessName: params.businessName,
      registrationNumber: params.registrationNumber,
      countryCode: params.countryCode,
    },
    {
      timeout: KYB_API_TIMEOUT_MS,
      headers: KYB_API_KEY ? { Authorization: `Bearer ${KYB_API_KEY}` } : {},
    },
  );

  const status =
    typeof response.data?.status === "string"
      ? response.data.status.toLowerCase()
      : "pending";

  if (status !== "pending" && status !== "verified" && status !== "rejected") {
    return {
      status: "pending",
      reason: "Unknown verification status from KYB provider",
      metadata: { providerResponse: response.data },
    };
  }

  return {
    status,
    reason:
      typeof response.data?.reason === "string"
        ? response.data.reason
        : undefined,
    metadata:
      response.data && typeof response.data === "object"
        ? {
            provider: "external",
            ...(response.data as Record<string, unknown>),
          }
        : { provider: "external" },
  };
};
