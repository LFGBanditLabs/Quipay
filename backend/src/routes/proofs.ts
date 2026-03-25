import { Router } from "express";
import { getProofByStreamId } from "../db/queries";
import { generateAndStoreProof } from "../services/proofService";
import { standardRateLimiter } from "../middleware/rateLimiter";

export const proofsRouter = Router();

proofsRouter.use(standardRateLimiter);

/**
 * GET /proofs/:streamId
 *
 * Returns the IPFS payroll proof for a completed stream.
 * Responds with 404 if no proof exists yet.
 */
proofsRouter.get("/:streamId", async (req, res, next) => {
  try {
    const streamId = parseInt(req.params.streamId, 10);
    if (isNaN(streamId) || streamId <= 0) {
      res.status(400).json({ error: "streamId must be a positive integer" });
      return;
    }

    const proof = await getProofByStreamId(streamId);
    if (!proof) {
      res.status(404).json({
        error:
          "No payroll proof found for this stream. The stream may not be completed yet.",
      });
      return;
    }

    res.json({
      streamId: proof.stream_id,
      cid: proof.cid,
      ipfsUrl: proof.ipfs_url,
      gatewayUrl: proof.gateway_url,
      proof: proof.proof_json,
      createdAt: proof.created_at,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /proofs/:streamId/regenerate
 *
 * Triggers proof (re-)generation for a completed stream that may have been
 * missed by the listener. Idempotent — returns the existing CID if already
 * pinned.
 */
proofsRouter.post("/:streamId/regenerate", async (req, res, next) => {
  try {
    const streamId = parseInt(req.params.streamId, 10);
    if (isNaN(streamId) || streamId <= 0) {
      res.status(400).json({ error: "streamId must be a positive integer" });
      return;
    }

    const cid = await generateAndStoreProof(streamId);
    if (!cid) {
      res.status(422).json({
        error:
          "Could not generate proof. The stream may not be completed, or the IPFS service is unavailable.",
      });
      return;
    }

    const proof = await getProofByStreamId(streamId);
    res.json({
      streamId,
      cid,
      ipfsUrl: proof?.ipfs_url,
      gatewayUrl: proof?.gateway_url,
    });
  } catch (err) {
    next(err);
  }
});
