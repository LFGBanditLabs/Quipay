import { Router, Response } from "express";
import { validateRequest } from "../middleware/validation";
import {
  authenticateRequest,
  requireUser,
  AuthenticatedRequest,
} from "../middleware/rbac";
import { z } from "zod";
import {
  getPayslipByWorkerAndPeriod,
  insertPayslipRecord,
  getPayslipBySignature,
  getEmployerBranding,
  getWorkerNotificationSettings,
  upsertWorkerNotificationSettings,
} from "../db/queries";
import { generatePayslip } from "../services/pdfGeneratorService";
import { signPayslip, verifySignature } from "../services/signatureService";
import { query } from "../db/pool";
import { logServiceInfo, logServiceError } from "../audit/serviceLogger";

export const payslipsRouter = Router();

// Schema for period parameter validation
const periodSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Period must be in YYYY-MM format (e.g., 2025-01)"),
});

// Schema for signature verification
const verifySignatureSchema = z.object({
  signature: z.string().min(1, "Signature is required"),
});

// Schema for worker notification preferences
const workerNotificationPreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  cliffUnlockAlerts: z.boolean().optional(),
  streamEndingAlerts: z.boolean().optional(),
  lowRunwayAlerts: z.boolean().optional(),
});

/**
 * GET /api/workers/:address/payslip?period=2025-01
 * Generate or retrieve a PDF payslip for a worker for a given period
 */
payslipsRouter.get(
  "/:address/payslip",
  authenticateRequest,
  requireUser,
  validateRequest({ query: periodSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { address } = req.params;
      const { period } = req.query as { period: string };

      // Authorization: verify authenticated user matches worker address
      if (!req.user || req.user.id !== address) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only access your own payslips",
        });
      }

      logServiceInfo("payslipRouter", "Payslip requested", {
        workerAddress: address,
        period,
      });

      // Check if payslip already exists (idempotency)
      const existingPayslip = await getPayslipByWorkerAndPeriod(
        address,
        period,
      );
      if (existingPayslip) {
        logServiceInfo("payslipRouter", "Returning cached payslip", {
          payslipId: existingPayslip.payslip_id,
          workerAddress: address,
          period,
        });

        // TODO: In production, fetch PDF from S3 if pdf_url exists
        // For now, we'll regenerate it (this is acceptable for MVP)
        // In a real implementation, you'd do:
        // if (existingPayslip.pdf_url) {
        //   const pdfBuffer = await fetchFromS3(existingPayslip.pdf_url);
        //   return res with pdfBuffer
        // }
      }

      // Query all streams for this worker in the given period
      const periodStart = `${period}-01`;
      const periodEnd = new Date(
        new Date(periodStart).getFullYear(),
        new Date(periodStart).getMonth() + 1,
        0,
      )
        .toISOString()
        .split("T")[0];

      const streamsResult = await query<any>(
        `SELECT 
          ps.stream_id,
          ps.employer_address,
          ps.worker_address,
          ps.total_amount,
          ps.withdrawn_amount,
          ps.start_ts,
          ps.end_ts,
          ps.status,
          ps.created_at
        FROM payroll_streams ps
        WHERE ps.worker_address = $1
          AND ps.deleted_at IS NULL
          AND (
            (ps.start_ts >= extract(epoch from $2::timestamp)::bigint 
             AND ps.start_ts < extract(epoch from $3::timestamp)::bigint)
            OR
            (ps.end_ts >= extract(epoch from $2::timestamp)::bigint 
             AND ps.end_ts < extract(epoch from $3::timestamp)::bigint)
            OR
            (ps.start_ts < extract(epoch from $2::timestamp)::bigint 
             AND ps.end_ts >= extract(epoch from $3::timestamp)::bigint)
          )`,
        [address, periodStart, periodEnd + " 23:59:59"],
      );

      if (!streamsResult.rows || streamsResult.rows.length === 0) {
        return res.status(404).json({
          error: "Not Found",
          message: `No payment streams found for period ${period}`,
        });
      }

      const streams = streamsResult.rows;
      const streamIds = streams.map((s: any) => s.stream_id);

      // Get employer address (assuming all streams in a period are from same employer)
      // In a real scenario, you might need to handle multiple employers
      const employerAddress = streams[0].employer_address;

      // Calculate total gross amount across all streams
      const totalGrossAmount = streams.reduce(
        (sum: bigint, stream: any) =>
          sum + BigInt(stream.withdrawn_amount || "0"),
        0n,
      );

      // Query withdrawals for all streams in this period
      const withdrawalsResult = await query<any>(
        `SELECT 
          id,
          stream_id,
          worker,
          amount,
          ledger,
          ledger_ts,
          created_at
        FROM withdrawals
        WHERE stream_id = ANY($1)
          AND ledger_ts >= extract(epoch from $2::timestamp)::bigint
          AND ledger_ts < extract(epoch from $3::timestamp)::bigint
        ORDER BY ledger_ts ASC`,
        [streamIds, periodStart, periodEnd + " 23:59:59"],
      );

      const withdrawals = withdrawalsResult.rows || [];

      // Fetch employer branding
      const brandingRecord = await getEmployerBranding(employerAddress);
      const branding = {
        logoUrl: brandingRecord?.logo_url || null,
        primaryColor: brandingRecord?.primary_color || "#2563eb",
        secondaryColor: brandingRecord?.secondary_color || "#64748b",
      };

      // Generate payslip ID
      const payslipId = `payslip-${address.substring(0, 8)}-${period}-${Date.now()}`;
      const generatedAt = new Date();

      // Generate cryptographic signature
      const signature = await signPayslip({
        payslipId,
        workerAddress: address,
        period,
        totalGrossAmount: totalGrossAmount.toString(),
        streamIds,
        generatedAt,
      });

      // Generate PDF
      const pdfBuffer = await generatePayslip({
        streamId: streamIds[0], // Primary stream ID
        streamData: streams[0], // Use first stream for basic info
        withdrawals,
        branding,
        signature,
        payslipId,
        generatedAt,
      });

      // Store payslip record in database
      if (!existingPayslip) {
        await insertPayslipRecord({
          payslipId,
          workerAddress: address,
          period,
          signature,
          brandingSnapshot: branding,
          totalGrossAmount: totalGrossAmount.toString(),
          streamIds,
        });
      }

      logServiceInfo("payslipRouter", "Payslip generated successfully", {
        payslipId,
        workerAddress: address,
        period,
        streamCount: streams.length,
      });

      // Set response headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="payslip-${period}-${Date.now()}.pdf"`,
      );
      res.setHeader("X-Payslip-ID", payslipId);
      res.setHeader("X-Signature", signature);

      return res.send(pdfBuffer);
    } catch (error) {
      logServiceError("payslipRouter", "Payslip generation failed", {
        error: error instanceof Error ? error.message : String(error),
        workerAddress: req.params.address,
        period: req.query.period as string,
      });

      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to generate payslip",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

/**
 * POST /api/verify-signature
 * Verify the authenticity of a payslip signature
 */
payslipsRouter.post(
  "/verify-signature",
  validateRequest({ body: verifySignatureSchema }),
  async (req, res: Response) => {
    try {
      const { signature } = req.body;

      if (!signature || typeof signature !== "string") {
        return res.status(400).json({
          valid: false,
          message: "Signature is required",
        });
      }

      logServiceInfo("payslipRouter", "Signature verification requested", {
        signature: signature.substring(0, 20) + "...",
      });

      // Look up payslip by signature
      const payslip = await getPayslipBySignature(signature);

      if (!payslip) {
        return res.status(404).json({
          valid: false,
          message:
            "Signature not found in system. This payslip may be from an older system or invalid.",
        });
      }

      const generatedAt = new Date(payslip.generated_at);
      const streamIds = Array.isArray(payslip.stream_ids)
        ? payslip.stream_ids.map((streamId) => Number(streamId))
        : [];

      if (
        Number.isNaN(generatedAt.getTime()) ||
        streamIds.some((streamId) => Number.isNaN(streamId))
      ) {
        return res.status(500).json({
          error: "Internal Server Error",
          message: "Payslip record is malformed and cannot be verified",
        });
      }

      const isValid = await verifySignature({
        signature,
        payslipData: {
          payslipId: payslip.payslip_id,
          workerAddress: payslip.worker_address,
          period: payslip.period,
          totalGrossAmount: payslip.total_gross_amount,
          streamIds,
          generatedAt,
        },
      });

      if (!isValid) {
        return res.status(401).json({
          valid: false,
          message: "Invalid signature: payslip authenticity check failed",
        });
      }

      logServiceInfo("payslipRouter", "Signature verified successfully", {
        payslipId: payslip.payslip_id,
        workerAddress: payslip.worker_address,
        period: payslip.period,
      });

      return res.json({
        valid: true,
        payslip: {
          id: payslip.payslip_id,
          workerAddress: payslip.worker_address,
          period: payslip.period,
          totalGrossAmount: payslip.total_gross_amount,
          streamIds: payslip.stream_ids,
          generatedAt: payslip.generated_at,
        },
      });
    } catch (error) {
      logServiceError("payslipRouter", "Signature verification failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to verify signature",
      });
    }
  },
);


/**
 * GET /api/workers/:address/notifications
 * Retrieve worker notification preferences
 */
payslipsRouter.get(
  "/:address/notifications",
  authenticateRequest,
  requireUser,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { address } = req.params;

      // Authorization: verify authenticated user matches worker address
      if (!req.user || req.user.id !== address) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only access your own notification preferences",
        });
      }

      logServiceInfo("payslipRouter", "Notification preferences requested", {
        workerAddress: address,
      });

      const preferences = await getWorkerNotificationSettings(address);

      // Return default preferences if not found
      const response = preferences || {
        worker: address,
        emailEnabled: true,
        inAppEnabled: true,
        cliffUnlockAlerts: true,
        streamEndingAlerts: true,
        lowRunwayAlerts: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return res.json(response);
    } catch (error) {
      logServiceError("payslipRouter", "Failed to retrieve notification preferences", {
        error: error instanceof Error ? error.message : String(error),
        workerAddress: req.params.address,
      });

      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to retrieve notification preferences",
      });
    }
  },
);

/**
 * PATCH /api/workers/:address/notifications
 * Update worker notification preferences
 */
payslipsRouter.patch(
  "/:address/notifications",
  authenticateRequest,
  requireUser,
  validateRequest({ body: workerNotificationPreferencesSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { address } = req.params;

      // Authorization: verify authenticated user matches worker address
      if (!req.user || req.user.id !== address) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only update your own notification preferences",
        });
      }

      logServiceInfo("payslipRouter", "Notification preferences update requested", {
        workerAddress: address,
        updates: req.body,
      });

      // Get current preferences to merge with updates
      const current = await getWorkerNotificationSettings(address);
      const defaults = {
        emailEnabled: true,
        inAppEnabled: true,
        cliffUnlockAlerts: true,
        streamEndingAlerts: true,
        lowRunwayAlerts: true,
      };

      const merged = {
        worker: address,
        emailEnabled: req.body.emailEnabled ?? current?.email_enabled ?? defaults.emailEnabled,
        inAppEnabled: req.body.inAppEnabled ?? current?.in_app_enabled ?? defaults.inAppEnabled,
        cliffUnlockAlerts: req.body.cliffUnlockAlerts ?? current?.cliff_unlock_alerts ?? defaults.cliffUnlockAlerts,
        streamEndingAlerts: req.body.streamEndingAlerts ?? current?.stream_ending_alerts ?? defaults.streamEndingAlerts,
        lowRunwayAlerts: req.body.lowRunwayAlerts ?? current?.low_runway_alerts ?? defaults.lowRunwayAlerts,
      };

      await upsertWorkerNotificationSettings(merged);

      logServiceInfo("payslipRouter", "Notification preferences updated successfully", {
        workerAddress: address,
      });

      return res.json({
        message: "Notification preferences updated",
        preferences: merged,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      logServiceError("payslipRouter", "Failed to update notification preferences", {
        error: error instanceof Error ? error.message : String(error),
        workerAddress: req.params.address,
      });

      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to update notification preferences",
      });
    }
  },
);
