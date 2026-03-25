import axios from "axios";

const PINATA_JWT = process.env.PINATA_JWT || "";
const PINATA_GATEWAY_URL =
  process.env.PINATA_GATEWAY_URL || "https://gateway.pinata.cloud";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The JSON document pinned to IPFS for every completed payroll stream.
 * Provides a portable, verifiable record of employment payment.
 */
export interface PayrollProof {
  schemaVersion: "1.0";
  streamId: number;
  employer: string;
  worker: string;
  tokenAddress: string;
  tokenSymbol: string;
  /** Human-readable token units (stroops / 10^7) */
  totalAmount: string;
  withdrawnAmount: string;
  /** Unix seconds */
  startTs: number;
  /** Unix seconds */
  endTs: number;
  /** Unix seconds, null when stream was force-cancelled */
  closedAt: number | null;
  /** Final settlement transaction hash, if available */
  txHash: string | null;
  /** ISO-8601 timestamp of proof generation */
  generatedAt: string;
  network: string;
  contractId: string;
}

export interface PinResult {
  cid: string;
  /** ipfs:// URI */
  ipfsUrl: string;
  /** Public HTTPS gateway URL via the configured Pinata gateway */
  gatewayUrl: string;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Pins a PayrollProof JSON document to IPFS via the Pinata pinning service.
 * Throws if PINATA_JWT is not configured or the upload fails.
 */
export const pinProofToIPFS = async (
  proof: PayrollProof,
): Promise<PinResult> => {
  if (!PINATA_JWT) {
    throw new Error(
      "[IPFSService] PINATA_JWT is not configured. Set it in your environment.",
    );
  }

  const response = await axios.post<{ IpfsHash: string }>(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    {
      pinataContent: proof,
      pinataMetadata: {
        name: `quipay-proof-stream-${proof.streamId}.json`,
        keyvalues: {
          streamId: String(proof.streamId),
          worker: proof.worker,
          employer: proof.employer,
          network: proof.network,
        },
      },
      pinataOptions: { cidVersion: 1 },
    },
    {
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    },
  );

  const cid = response.data.IpfsHash;
  return {
    cid,
    ipfsUrl: `ipfs://${cid}`,
    gatewayUrl: `${PINATA_GATEWAY_URL}/ipfs/${cid}`,
  };
};
