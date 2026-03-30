/**
 * Streams Router
 *
 * Handles payroll stream management:
 *   POST   /streams              – create a new stream (idempotent via Idempotency-Key)
 *   DELETE /streams/:id          – soft-delete / cancel a stream
 *   GET    /streams/:id/audit    – return full audit trail for a stream
 *
 * Satisfies acceptance criteria for issues #612 and #614.
 */

import { Router, Response } from "express";
import { z } from "zod";
import { validateRequest } from "../middleware/validation";
import {
  authenticateRequest,
  requireUser,
  AuthenticatedRequest,
} from "../middleware/rbac";
import { idempotencyMiddleware } from "../middleware/idempotency";
import {
  upsertStream,
  softDeleteStream,
  getStreamAuditLog,
  getStreamById,
} from "../db/queries";

export const streamsRouter = Router();

streamsRouter.use(authenticateRequest, requireUser);

// ── Schemas ───────────────────────────────────────────────────────────────────

const createStreamSchema = z.object({
  streamId: z.number().int().positive(),
  employer: z.string().min(1),
  worker: z.string().min(1),
  totalAmount: z
    .string()
    .regex(/^\d+$/, "Must be a numeric string (stroops)")
    .transform((v) => BigInt(v)),
  withdrawnAmount: z
    .string()
    .regex(/^\d+$/)
    .default("0")
    .transform((v) => BigInt(v)),
  startTs: z.number().int().positive(),
  endTs: z.number().int().positive(),
  status: z.enum(["active", "completed", "cancelled"]).default("active"),
  ledger: z.number().int().positive(),
  metadata: z.record(z.string(), z.string()).optional(),
});

const cancelStreamSchema = z.object({
  cancelReason: z.string().max(500).optional(),
});

// ── POST /streams ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /streams:
 *   post:
 *     summary: Create a new payroll stream
 *     description: >
 *       Idempotent. Supply an `Idempotency-Key` header (UUID) to safely retry
 *       on network failure without creating duplicate streams.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateStream'
 *     responses:
 *       201:
 *         description: Stream created
 *       200:
 *         description: Duplicate key – returning cached response
 */
streamsRouter.post(
  "/",
  idempotencyMiddleware("POST /streams"),
  validateRequest({ body: createStreamSchema }),
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body as z.infer<typeof createStreamSchema>;

    await upsertStream({
      streamId: body.streamId,
      employer: body.employer,
      worker: body.worker,
      totalAmount: body.totalAmount,
      withdrawnAmount: body.withdrawnAmount,
      startTs: body.startTs,
      endTs: body.endTs,
      status: body.status,
      ledger: body.ledger,
    });

    const stream = await getStreamById(body.streamId);

    return res.status(201).json({ stream });
  },
);

// ── DELETE /streams/:id  (soft-delete) ───────────────────────────────────────

/**
 * @swagger
 * /streams/{id}:
 *   delete:
 *     summary: Cancel (soft-delete) a payroll stream
 *     description: >
 *       Marks the stream as deleted without removing the database row.
 *       The cancellation is recorded in the stream audit log.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cancelReason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Stream cancelled
 *       404:
 *         description: Stream not found or already cancelled
 */
streamsRouter.delete(
  "/:id",
  validateRequest({ body: cancelStreamSchema }),
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const streamId = Number(req.params.id);
    if (!Number.isFinite(streamId) || streamId <= 0) {
      return res.status(400).json({ error: "Invalid stream ID" });
    }

    const deleted = await softDeleteStream({
      streamId,
      deletedBy: req.user.id,
      cancelReason: req.body.cancelReason,
    });

    if (!deleted) {
      return res
        .status(404)
        .json({ error: "Stream not found or already cancelled" });
    }

    return res.status(200).json({
      streamId,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      cancelledBy: req.user.id,
    });
  },
);

// ── GET /streams/:id/audit ────────────────────────────────────────────────────

/**
 * @swagger
 * /streams/{id}/audit:
 *   get:
 *     summary: Retrieve the full audit trail for a stream
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Audit log entries
 *       404:
 *         description: Stream not found
 */
streamsRouter.get(
  "/:id/audit",
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const streamId = Number(req.params.id);
    if (!Number.isFinite(streamId) || streamId <= 0) {
      return res.status(400).json({ error: "Invalid stream ID" });
    }

    // Confirm the stream exists (including soft-deleted)
    const stream = await getStreamById(streamId, true);
    if (!stream) {
      return res.status(404).json({ error: "Stream not found" });
    }

    const auditLog = await getStreamAuditLog(streamId);
    return res.status(200).json({ streamId, auditLog });
  },
);
