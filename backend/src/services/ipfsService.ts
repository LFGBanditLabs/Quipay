import axios from "axios";
import { ConfigError } from "../errors/AppError";
import { createCircuitBreaker } from "../utils/circuitBreaker";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The JSON document pinned to IPFS for every completed payroll stream.
 * Provides a portable, verifiable record of employment payment.
 */
export interface PayrollProof {
  schemaVersion: "1.0";
  streamId: number;
  employer_address: string;
  worker_address: string;
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
 * Internal function to pin to IPFS without circuit breaker wrapper.
 */
const pinToIPFSInternal = async (proof: PayrollProof): Promise<PinResult> => {
  const jwt = process.env.PINATA_JWT?.trim();
  const gatewayUrl =
    process.env.PINATA_GATEWAY_URL || "https://gateway.pinata.cloud";

  if (!jwt) {
    throw new ConfigError(
      "PINATA_JWT is not configured. Set it in your environment.",
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
          worker: proof.worker_address,
          employer: proof.employer_address,
          network: proof.network,
        },
      },
      pinataOptions: { cidVersion: 1 },
    },
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    },
  );

  const cid = response.data.IpfsHash;
  return {
    cid,
    ipfsUrl: `ipfs://${cid}`,
    gatewayUrl: `${gatewayUrl}/ipfs/${cid}`,
  };
};

// Circuit breaker for Pinata API calls with retry logic
const pinataCircuitBreaker = createCircuitBreaker(pinToIPFSInternal, {
  name: "pinata-ipfs",
  timeout: 35_000, // Slightly longer than axios timeout
  errorThresholdPercentage: 50,
  resetTimeout: 60_000, // 1 minute before trying again
});

/**
 * Pins a PayrollProof JSON document to IPFS via the Pinata pinning service.
 * Uses circuit breaker for resilience against Pinata API failures.
 * Throws if PINATA_JWT is not configured or the upload fails after retries.
 */
export const pinProofToIPFS = async (
  proof: PayrollProof,
): Promise<PinResult> => {
  return await pinataCircuitBreaker.fire(proof);
};
