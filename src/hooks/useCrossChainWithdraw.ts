/**
 * useCrossChainWithdraw.ts
 * ─────────────────────────
 * Orchestrates cross-chain USDC withdrawals via CCTP.
 *
 * Flow: burn USDC on Stellar → poll attestation → mint on destination chain
 */

import { useState, useCallback, useRef } from "react";
import {
  Server,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { useStellarSign } from "./useStellarSign";
import { useNotification } from "./useNotification";
import {
  buildBurnTx,
  getAttestation,
  getMessageHash,
} from "../contracts/cctp_message_transmitter";
import {
  getEvmChainConfig,
  getExplorerTxUrl,
  type SupportedEvmChain,
} from "../lib/evmAddresses";
import { rpcUrl, networkPassphrase } from "../contracts/util";
import { STROOPS } from "../util/format";
import { recordWithdrawalEvent } from "../util/recordWithdrawal";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CrossChainStep =
  | "idle"
  | "burning"
  | "attesting"
  | "minting"
  | "complete"
  | "error";

export interface CrossChainProgress {
  step: CrossChainStep;
  /** Human-readable status message */
  message: string;
  /** Stellar tx hash (available after burning) */
  stellarTxHash?: string;
  /** Destination chain tx hash (available after minting) */
  destTxHash?: string;
  /** Error message if step failed */
  error?: string;
}

export interface UseCrossChainWithdrawReturn {
  progress: CrossChainProgress;
  /** Start the cross-chain withdrawal */
  withdraw: (params: {
    amount: number;
    destinationChain: SupportedEvmChain;
    destinationAddress: string;
  }) => Promise<void>;
  /** Reset to idle state */
  reset: () => void;
  /** Whether a withdrawal is in progress */
  isBusy: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const IDLE_PROGRESS: CrossChainProgress = {
  step: "idle",
  message: "",
};

function getRpcServer(): Server {
  return new Server(rpcUrl, { allowHttp: true });
}

export function useCrossChainWithdraw(
  workerAddress: string,
): UseCrossChainWithdrawReturn {
  const { signXdr } = useStellarSign();
  const { addNotification } = useNotification();
  const [progress, setProgress] = useState<CrossChainProgress>(IDLE_PROGRESS);
  const isBusyRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);

  const reset = useCallback(() => {
    setProgress(IDLE_PROGRESS);
    isBusyRef.current = false;
    setIsBusy(false);
  }, []);

  const withdraw = useCallback(
    async ({
      amount,
      destinationChain,
      destinationAddress,
    }: {
      amount: number;
      destinationChain: SupportedEvmChain;
      destinationAddress: string;
    }) => {
      if (isBusyRef.current) return;
      isBusyRef.current = true;
      setIsBusy(true);

      const chainConfig = getEvmChainConfig(destinationChain);

      try {
        // ── Step 1: Burn USDC on Stellar ──────────────────────────────
        setProgress({
          step: "burning",
          message: "Burning USDC on Stellar...",
        });

        // Convert human-readable amount to stroops (6 decimals)
        const amountStroops = BigInt(Math.round(amount * STROOPS));

        const { preparedXdr } = await buildBurnTx(
          workerAddress,
          amountStroops,
          destinationChain,
          destinationAddress,
        );

        const signed = await signXdr(preparedXdr, workerAddress);

        // Submit and wait for confirmation
        const txHash = await submitBurnTx(signed);

        setProgress({
          step: "burning",
          message: "USDC burned on Stellar",
          stellarTxHash: txHash,
        });

        // ── Step 2: Poll for attestation ───────────────────────────
        setProgress({
          step: "attesting",
          message: "Waiting for Circle attestation...",
          stellarTxHash: txHash,
        });

        const messageHash = await getMessageHash(txHash);
        if (!messageHash) {
          throw new Error("Failed to retrieve CCTP message hash");
        }

        const attestation = await getAttestation(messageHash);
        if (attestation.status === "error") {
          throw new Error(attestation.error ?? "Attestation failed");
        }

        // ── Step 3: Mint on destination chain ──────────────────────
        setProgress({
          step: "minting",
          message: `Minting USDC on ${chainConfig.name}...`,
          stellarTxHash: txHash,
        });

        // Circle's relayer handles the mint automatically once attestation
        // is complete. Show the destination chain explorer for the user to
        // monitor the mint.
        setProgress({
          step: "complete",
          message: `Successfully withdrew ${amount} USDC to ${chainConfig.name}`,
          stellarTxHash: txHash,
        });

        // Record the cross-chain withdrawal event
        void recordWithdrawalEvent({
          workerAddress,
          employerAddress: workerAddress,
          streamId: "cross-chain",
          amount,
          tokenSymbol: "USDC",
          txHash,
          destChain: chainConfig.name,
          destAddress: destinationAddress,
        });

        addNotification(
          `Withdrew ${amount.toLocaleString()} USDC to ${chainConfig.name}`,
          "success",
        );
      } catch (err) {
        const rawMsg =
          err instanceof Error ? err.message : "Cross-chain withdrawal failed";
        // Surface helpful errors for common failure modes
        const msg = rawMsg.includes("insufficient")
          ? "Insufficient XLM for transaction fees. Please add XLM to your wallet and try again."
          : rawMsg.includes("rejected") || rawMsg.includes("declined")
            ? "Transaction rejected in your wallet."
            : rawMsg;
        setProgress({
          step: "error",
          message: msg,
          error: msg,
        });
        addNotification(msg, "error");
      } finally {
        isBusyRef.current = false;
        setIsBusy(false);
      }
    },
    [workerAddress, signXdr, addNotification],
  );

  return { progress, withdraw, reset, isBusy };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Submits a signed burn transaction to the Stellar network and waits for
 * confirmation.
 */
async function submitBurnTx(signedXdr: string): Promise<string> {
  const server = getRpcServer();
  const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);

  const result = await server.sendTransaction(tx);

  if (
    result.status === "ERROR" ||
    result.status === "DUPLICATE" ||
    result.status === "TRY_AGAIN_LATER"
  ) {
    throw new Error(
      `Burn transaction failed: ${JSON.stringify(result.errorResult ?? result.status)}`,
    );
  }

  // Poll for confirmation
  let attempts = 0;
  while (attempts < 30) {
    const txResult = await server.getTransaction(result.hash);
    if (txResult.status === "SUCCESS") {
      return result.hash;
    }
    if (txResult.status === "FAILED") {
      throw new Error("Burn transaction failed on-chain");
    }
    await new Promise((r) => setTimeout(r, 2000));
    attempts++;
  }

  throw new Error("Burn transaction confirmation timed out");
}

// ─── Helper exports ──────────────────────────────────────────────────────────

export function getExplorerUrl(
  chain: SupportedEvmChain,
  txHash: string,
): string {
  return getExplorerTxUrl(chain, txHash);
}
