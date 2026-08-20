/**
 * useCrossChainDeposit.ts
 * ───────────────────────
 * Orchestrates cross-chain USDC deposits via CCTP.
 *
 * Flow: approve USDC on EVM → burn via depositForBurn → poll attestation →
 *       USDC minted on Stellar (via Circle relayer) → deposit into vault
 */

import { useState, useCallback, useRef } from "react";
import { createPublicClient, http, type Hex } from "viem";
import { mainnet, base, arbitrum, optimism } from "viem/chains";
import { useStellarSign } from "./useStellarSign";
import { useEvmSigner } from "./useEvmSigner";
import { useNotification } from "./useNotification";
import { buildApproveTx, buildDepositForBurnTx } from "../contracts/cctp_deposit";
import { buildDepositTx } from "../contracts/payroll_vault";
import { extractAndAttest } from "../lib/cctp";
import {
  getEvmChainConfig,
  getExplorerTxUrl,
  type SupportedEvmChain,
} from "../lib/evmAddresses";
import { submitAndAwaitTx } from "../contracts/payroll_stream";
import { rpcUrl, networkPassphrase } from "../contracts/util";
import { Asset } from "@stellar/stellar-sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DepositStep =
  | "idle"
  | "approving"
  | "burning"
  | "attesting"
  | "minting"
  | "depositing"
  | "complete"
  | "error";

export interface DepositProgress {
  step: DepositStep;
  message: string;
  /** EVM burn tx hash */
  evmTxHash?: string;
  /** Stellar deposit tx hash */
  stellarTxHash?: string;
  /** Error message if step failed */
  error?: string;
}

export interface UseCrossChainDepositReturn {
  progress: DepositProgress;
  /** Start the cross-chain deposit */
  deposit: (params: {
    amount: number;
    sourceChain: SupportedEvmChain;
    stellarAddress: string;
  }) => Promise<void>;
  /** Reset to idle state */
  reset: () => void;
  /** Whether a deposit is in progress */
  isBusy: boolean;
}

// ─── Viem chain map ───────────────────────────────────────────────────────────

const VIEM_CHAINS = {
  ethereum: mainnet,
  base,
  arbitrum,
  optimism,
} as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

const IDLE_PROGRESS: DepositProgress = { step: "idle", message: "" };

const USDC_ISSUER = import.meta.env.PUBLIC_USDC_ISSUER ?? "";

export function useCrossChainDeposit(
  stellarAddress: string,
): UseCrossChainDepositReturn {
  const { signXdr } = useStellarSign();
  const { sendEvmTx } = useEvmSigner();
  const { addNotification } = useNotification();
  const [progress, setProgress] = useState<DepositProgress>(IDLE_PROGRESS);
  const isBusyRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);

  const reset = useCallback(() => {
    setProgress(IDLE_PROGRESS);
    isBusyRef.current = false;
    setIsBusy(false);
  }, []);

  const deposit = useCallback(
    async ({
      amount,
      sourceChain,
      stellarAddress: recipient,
    }: {
      amount: number;
      sourceChain: SupportedEvmChain;
      stellarAddress: string;
    }) => {
      if (isBusyRef.current) return;
      isBusyRef.current = true;
      setIsBusy(true);

      const chainConfig = getEvmChainConfig(sourceChain);

      try {
        // USDC has 6 decimals on EVM chains
        const amountSmallest = BigInt(Math.round(amount * 1_000_000));

        // ── Step 1: Approve USDC spending ─────────────────────────────
        setProgress({
          step: "approving",
          message: `Approving USDC on ${chainConfig.name}...`,
        });

        const approveTx = buildApproveTx(sourceChain, amountSmallest);
        await sendEvmTx(approveTx);

        // ── Step 2: Burn USDC via depositForBurn ─────────────────────
        setProgress({
          step: "burning",
          message: `Burning USDC on ${chainConfig.name}...`,
        });

        const burnTx = buildDepositForBurnTx(
          sourceChain,
          amountSmallest,
          recipient,
        );
        const { txHash: evmTxHash } = await sendEvmTx(burnTx);

        setProgress({
          step: "burning",
          message: `USDC burned on ${chainConfig.name}`,
          evmTxHash,
        });

        // ── Step 3: Poll for attestation ─────────────────────────────
        setProgress({
          step: "attesting",
          message: "Waiting for Circle attestation...",
          evmTxHash,
        });

        // Create a viem public client for the source chain
        const publicClient = createPublicClient({
          chain: VIEM_CHAINS[sourceChain],
          transport: http(),
        });

        const { message, attestation } = await extractAndAttest(
          evmTxHash,
          sourceChain,
          publicClient,
          (step) =>
            setProgress({ step: "attesting", message: step, evmTxHash }),
        );

        // ── Step 4: Mint USDC on Stellar ─────────────────────────────
        setProgress({
          step: "minting",
          message: "Minting USDC on Stellar...",
          evmTxHash,
        });

        // Circle's relayer handles the mint automatically once attestation
        // is complete. We wait a moment for the Stellar tx to confirm.
        // In a production implementation, we'd poll Stellar for the mint tx.
        await new Promise((r) => setTimeout(r, 10_000));

        // ── Step 5: Deposit into payroll vault ───────────────────────
        setProgress({
          step: "depositing",
          message: "Depositing into payroll vault...",
          evmTxHash,
        });

        if (!USDC_ISSUER) {
          throw new Error("USDC issuer not configured");
        }

        const usdcSac = new Asset("USDC", USDC_ISSUER).contractId(
          networkPassphrase,
        );
        // USDC on Stellar uses 7 decimals (stroops)
        const amountStroops = BigInt(Math.round(amount * 1e7));

        const { preparedXdr } = await buildDepositTx(
          recipient,
          usdcSac,
          amountStroops,
        );
        const signedXdr = await signXdr(preparedXdr, recipient);
        await submitAndAwaitTx(signedXdr);

        // ── Complete ─────────────────────────────────────────────────
        setProgress({
          step: "complete",
          message: `Successfully deposited ${amount.toLocaleString()} USDC from ${chainConfig.name}`,
          evmTxHash,
        });

        addNotification(
          `Deposited ${amount.toLocaleString()} USDC from ${chainConfig.name} into vault`,
          "success",
        );
      } catch (err) {
        const rawMsg =
          err instanceof Error
            ? err.message
            : "Cross-chain deposit failed";
        const msg = rawMsg.includes("insufficient")
          ? "Insufficient balance or gas on the source chain."
          : rawMsg.includes("rejected") || rawMsg.includes("declined")
            ? "Transaction rejected in your wallet."
            : rawMsg;
        setProgress({ step: "error", message: msg, error: msg });
        addNotification(msg, "error");
      } finally {
        isBusyRef.current = false;
        setIsBusy(false);
      }
    },
    [stellarAddress, signXdr, sendEvmTx, addNotification],
  );

  return { progress, deposit, reset, isBusy };
}

// ─── Helper exports ──────────────────────────────────────────────────────────

export function getExplorerUrl(
  chain: SupportedEvmChain,
  txHash: string,
): string {
  return getExplorerTxUrl(chain, txHash);
}
