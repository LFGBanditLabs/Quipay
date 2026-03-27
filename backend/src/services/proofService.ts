import { getPool } from "../db/pool";
import { pinProofToIPFS, PayrollProof } from "./ipfsService";
import {
  insertPayrollProof,
  getProofByStreamId,
  getStreamById,
} from "../db/queries";
import type { StreamRecord } from "../db/queries";

const NETWORK = process.env.PUBLIC_STELLAR_NETWORK || "LOCAL";
const CONTRACT_ID = process.env.QUIPAY_CONTRACT_ID || "";
const STROOPS_PER_UNIT = 1e7;

const toTokenUnits = (stroops: string): string =>
  (parseFloat(stroops) / STROOPS_PER_UNIT).toFixed(7);

// ─── Proof generation ─────────────────────────────────────────────────────────

/**
 * Builds a PayrollProof document, pins it to IPFS via Pinata, and persists
 * the CID to the `payroll_proofs` table.
 *
 * Safe to call multiple times for the same stream — skips upload if a proof
 * already exists (idempotent).
 *
 * @returns The IPFS CID on success, or `null` if DB / IPFS is unavailable.
 */
export const generateAndStoreProof = async (
  streamOrId: StreamRecord | number,
  tokenSymbol = "USDC",
  txHash: string | null = null,
): Promise<string | null> => {
  if (!getPool()) return null;

  const stream: StreamRecord | null =
    typeof streamOrId === "number"
      ? await getStreamById(streamOrId)
      : streamOrId;

  if (!stream) {
    console.warn(`[ProofService] Stream not found — cannot generate proof`);
    return null;
  }

  if (stream.status !== "completed") {
    // Only completed streams get a proof
    return null;
  }

  // Idempotency guard — skip if a proof already exists for this stream
  const existing = await getProofByStreamId(stream.stream_id);
  if (existing) {
    return existing.cid;
  }

  const proof: PayrollProof = {
    schemaVersion: "1.0",
    streamId: stream.stream_id,
    employer: stream.employer,
    worker: stream.worker,
    tokenAddress: "",
    tokenSymbol,
    totalAmount: toTokenUnits(stream.total_amount),
    withdrawnAmount: toTokenUnits(stream.withdrawn_amount),
    startTs: stream.start_ts,
    endTs: stream.end_ts,
    closedAt: stream.closed_at ?? null,
    txHash,
    generatedAt: new Date().toISOString(),
    network: NETWORK,
    contractId: CONTRACT_ID,
  };

  try {
    const { cid, ipfsUrl, gatewayUrl } = await pinProofToIPFS(proof);

    await insertPayrollProof({
      streamId: stream.stream_id,
      cid,
      ipfsUrl,
      gatewayUrl,
      proofJson: proof,
    });

    console.log(
      `[ProofService] ✅ Pinned proof for stream ${stream.stream_id}: ${cid}`,
    );
    return cid;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[ProofService] Failed to generate proof for stream ${stream.stream_id}: ${msg}`,
    );
    return null;
  }
};
