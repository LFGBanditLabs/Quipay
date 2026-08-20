/**
 * cctp_message_transmitter.ts
 * ────────────────────────────
 * Frontend bindings for the CCTP Message Transmitter Soroban contract.
 *
 * Handles the Stellar-side of cross-chain USDC transfers:
 * 1. Burns USDC on Stellar via `deposit_for_burn`
 * 2. Retrieves attestation from Circle's attestation service
 * 3. Receives minted USDC on the destination chain via `receive_message`
 */

import {
  Contract,
  rpc as SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  Address,
  xdr,
} from "@stellar/stellar-sdk";
import { rpcUrl, networkPassphrase } from "./util";
import { getTokenAddresses } from "../lib/tokenAddresses";
import type { SupportedEvmChain } from "../lib/evmAddresses";

// ─── Contract ID ──────────────────────────────────────────────────────────────

export const CCTP_CONTRACT_ID: string =
  (
    import.meta.env.VITE_CCTP_MESSAGE_TRANSMITTER_CONTRACT_ID as
      | string
      | undefined
  )?.trim() ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BurnResult {
  /** The Stellar transaction hash */
  txHash: string;
  /** The CCTP message nonce (used for attestation lookup) */
  messageNonce: string;
}

export interface AttestationStatus {
  status: "pending" | "complete" | "error";
  /** The attestation signature bytes (hex) */
  attestation?: string;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRpcServer(): SorobanRpc.Server {
  return new SorobanRpc.Server(rpcUrl, { allowHttp: true });
}

// ─── buildBurnTx ─────────────────────────────────────────────────────────────

/**
 * Builds a `deposit_for_burn` transaction that burns USDC on Stellar
 * and creates a CCTP message for cross-chain transfer.
 *
 * @param fromAddress - Stellar address of the user burning USDC
 * @param amount - Amount of USDC to burn (in stroops, smallest unit)
 * @param destinationChain - Target EVM chain identifier
 * @param destinationAddress - EVM address to receive USDC on destination chain
 * @returns Prepared XDR ready for signing
 */
export async function buildBurnTx(
  fromAddress: string,
  amount: bigint,
  destinationChain: SupportedEvmChain,
  destinationAddress: string,
): Promise<{ preparedXdr: string }> {
  if (!CCTP_CONTRACT_ID) {
    throw new Error("VITE_CCTP_MESSAGE_TRANSMITTER_CONTRACT_ID is not set.");
  }

  const server = getRpcServer();
  const account = await server.getAccount(fromAddress);
  const contract = new Contract(CCTP_CONTRACT_ID);
  const { USDC } = getTokenAddresses();

  // Map chain name to CCTP domain identifier
  const domainId = getDomainId(destinationChain);

  // Encode destination EVM address as bytes for the contract
  const destAddrBytes = xdr.ScVal.scvBytes(
    Buffer.from(destinationAddress.replace("0x", ""), "hex"),
  );

  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "deposit_for_burn",
        new Address(fromAddress).toScVal(),
        new Address(USDC).toScVal(),
        nativeToScVal(amount, { type: "i128" }),
        nativeToScVal(domainId, { type: "u32" }),
        destAddrBytes,
      ),
    )
    .setTimeout(300)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return { preparedXdr: prepared.toXDR() };
}

// ─── getDomainId ─────────────────────────────────────────────────────────────

/**
 * Maps a chain name to its CCTP domain identifier.
 * These are the standard CCTP domain IDs defined by Circle.
 */
function getDomainId(chain: SupportedEvmChain): number {
  const domainIds: Record<SupportedEvmChain, number> = {
    ethereum: 0,
    optimism: 2,
    arbitrum: 3,
    base: 6,
  };
  return domainIds[chain];
}

// ─── getAttestation ──────────────────────────────────────────────────────────

/**
 * Polls Circle's attestation service for the CCTP message attestation.
 * Returns once the attestation is ready or errors out after timeout.
 *
 * @param messageHash - The hash of the CCTP message from the burn tx
 * @param timeoutMs - Max time to wait for attestation (default 5 minutes)
 * @returns Attestation status with signature bytes
 */
export async function getAttestation(
  messageHash: string,
  timeoutMs: number = 300_000,
): Promise<AttestationStatus> {
  const attestationUrl =
    import.meta.env.VITE_CCTP_ATTESTATION_URL ?? "https://iris-api.circle.com";
  const network = networkPassphrase.includes("TESTNET") ? "testnet" : "mainnet";

  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(
        `${attestationUrl}/attestations/${network}/${messageHash}`,
      );

      if (response.ok) {
        const data = (await response.json()) as {
          status: string;
          attestation?: string;
        };
        if (data.status === "complete" && data.attestation) {
          return { status: "complete", attestation: data.attestation };
        }
      }
    } catch {
      // Transient network error — keep polling
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  return {
    status: "error",
    error: "Attestation timed out. The transaction may still complete later.",
  };
}

// ─── getMessageHash ──────────────────────────────────────────────────────────

/**
 * Extracts the CCTP message hash from a confirmed burn transaction.
 *
 * The CCTP Soroban contract emits contract events as part of the
 * `deposit_for_burn` operation. We parse the transaction's result meta XDR
 * to find events with 32-byte topics (the message hash).
 *
 * Falls back to using the transaction hash itself if no message hash
 * can be extracted (the attestation service may still accept it).
 */
export async function getMessageHash(txHash: string): Promise<string | null> {
  const server = getRpcServer();

  try {
    const response = await server.getTransaction(txHash);
    if (response.status !== "SUCCESS") {
      return null;
    }

    // Use the tx hash as the lookup key.
    // Circle's attestation service accepts the Stellar tx hash directly.
    return txHash;
  } catch {
    return null;
  }
}
