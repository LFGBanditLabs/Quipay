/**
 * cctp.ts
 * ───────
 * CCTP attestation polling for EVM-to-Stellar cross-chain deposits.
 *
 * After a USDC burn on an EVM chain (via depositForBurn), Circle's
 * attestation service signs the CCTP message. This module:
 * 1. Extracts the message bytes from the burn transaction logs
 * 2. Polls Circle's attestation API until the signature is ready
 * 3. Returns the attestation for the Stellar-side receiveMessage call
 */

import { decodeEventLog, type Hex } from "viem";
import { getEvmChainConfig, type SupportedEvmChain } from "./evmAddresses";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CctpMessage {
  /** Raw message bytes (hex) to pass to receiveMessage on Stellar */
  message: Hex;
  /** Message hash used for attestation lookup */
  messageHash: Hex;
}

export interface AttestationResult {
  status: "pending" | "complete" | "error";
  /** Attestation signature bytes (hex) — needed for receiveMessage */
  attestation?: string;
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ATTESTATION_BASE_URL =
  import.meta.env.VITE_CCTP_ATTESTATION_URL ?? "https://iris-api.circle.com";

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes
const POLL_INTERVAL_MS = 5_000; // 5 seconds

// ─── MessageSent event ABI ────────────────────────────────────────────────────

/**
 * The Token Messenger emits a MessageSent event with the CCTP message bytes.
 * We decode this to get the message hash for attestation lookup.
 */
const MESSAGE_SENT_EVENT = {
  type: "event" as const,
  name: "MessageSent",
  inputs: [
    { name: "message", type: "bytes", indexed: false },
  ],
} as const;

// ─── Extract message from tx logs ─────────────────────────────────────────────

/**
 * Extracts the CCTP message from a confirmed EVM burn transaction.
 *
 * The Token Messenger's depositForBurn emits a MessageSent(bytes) event.
 * We parse the logs to find it and compute the message hash.
 *
 * @param txHash - The EVM transaction hash from depositForBurn
 * @param chain - The source EVM chain
 * @param publicClient - A viem PublicClient for reading tx receipt
 * @returns The raw message bytes and its keccak256 hash
 */
export async function extractCctpMessage(
  txHash: string,
  chain: SupportedEvmChain,
  publicClient: {
    getTransactionReceipt: (args: { hash: Hex }) => Promise<{
      logs: Array<{ address: string; topics: readonly Hex[]; data: Hex }>;
    }>;
  },
): Promise<CctpMessage> {
  const config = getEvmChainConfig(chain);

  const receipt = await publicClient.getTransactionReceipt({
    hash: txHash as Hex,
  });

  // Find the MessageSent event from the Token Messenger contract
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== config.cctpTokenMessenger.toLowerCase()) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: [MESSAGE_SENT_EVENT],
        data: log.data,
        topics: [...log.topics] as [Hex, ...Hex[]],
      });

      if (decoded.eventName === "MessageSent" && decoded.args) {
        const message = decoded.args.message as Hex;
        // Compute keccak256 hash of the message bytes
        const messageHash = await computeMessageHash(message);
        return { message, messageHash };
      }
    } catch {
      // Not the event we're looking for — continue
    }
  }

  throw new Error(
    "Could not find MessageSent event in burn transaction. " +
      "The transaction may have failed or the contract address may be wrong.",
  );
}

// ─── Message hash computation ─────────────────────────────────────────────────

/**
 * Computes the keccak256 hash of the CCTP message bytes.
 * This hash is used to look up the attestation from Circle.
 */
async function computeMessageHash(message: Hex): Promise<Hex> {
  // Use the Web Crypto API (SubtleCrypto) for keccak256
  // Note: Web Crypto doesn't have keccak256, so we use viem's hashMessage
  // or a manual implementation. For simplicity, we'll use the raw hash.
  const { keccak256 } = await import("viem");
  return keccak256(message);
}

// ─── Poll attestation ─────────────────────────────────────────────────────────

/**
 * Polls Circle's attestation service for the CCTP message signature.
 *
 * After a USDC burn on the source chain, Circle observes the burn and
 * produces an attestation (signature). This function polls until the
 * attestation is ready or the timeout is reached.
 *
 * @param messageHash - The keccak256 hash of the CCTP message
 * @param sourceChain - The chain where USDC was burned
 * @param timeoutMs - Max wait time (default 5 minutes)
 * @returns Attestation result with signature bytes
 */
export async function pollAttestation(
  messageHash: string,
  _sourceChain: SupportedEvmChain,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<AttestationResult> {
  const network = import.meta.env.VITE_CCTP_NETWORK ?? "testnet";

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const url = `${ATTESTATION_BASE_URL}/attestations/${network}/${messageHash}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = (await response.json()) as {
          status: string;
          attestation?: string;
        };

        if (data.status === "complete" && data.attestation) {
          return { status: "complete", attestation: data.attestation };
        }

        if (data.status === "error") {
          return {
            status: "error",
            error: "Circle attestation failed. The burn may still complete later.",
          };
        }
      }

      // 404 or other status — attestation not ready yet, keep polling
    } catch {
      // Transient network error — keep polling
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  return {
    status: "error",
    error: `Attestation timed out after ${Math.round(timeoutMs / 1000)}s. The transaction may still complete later — check the explorer.`,
  };
}

// ─── Combined: extract + poll ─────────────────────────────────────────────────

/**
 * Convenience function: extracts the CCTP message from a burn tx and
 * polls for the attestation. Returns both the message and attestation
 * needed for the Stellar-side receiveMessage call.
 *
 * @param txHash - EVM burn transaction hash
 * @param chain - Source EVM chain
 * @param publicClient - Viem PublicClient for reading tx receipt
 * @param onStep - Optional callback for progress updates
 */
export async function extractAndAttest(
  txHash: string,
  chain: SupportedEvmChain,
  publicClient: {
    getTransactionReceipt: (args: { hash: Hex }) => Promise<{
      logs: Array<{ address: string; topics: readonly Hex[]; data: Hex }>;
    }>;
  },
  onStep?: (step: string) => void,
): Promise<{ message: Hex; attestation: string }> {
  onStep?.("Extracting CCTP message from burn transaction...");
  const { message, messageHash } = await extractCctpMessage(
    txHash,
    chain,
    publicClient,
  );

  onStep?.("Waiting for Circle attestation...");
  const result = await pollAttestation(messageHash, chain);

  if (result.status === "error" || !result.attestation) {
    throw new Error(result.error ?? "Attestation failed");
  }

  return { message, attestation: result.attestation };
}
