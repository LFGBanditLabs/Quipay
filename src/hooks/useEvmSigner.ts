/**
 * useEvmSigner.ts
 * ────────────────
 * Sends EVM transactions via the Privy embedded wallet.
 *
 * Privy auto-creates an EVM embedded wallet on login (see AuthProvider).
 * This hook wraps Privy's useSendTransaction to provide a simple interface
 * for sending raw EVM transactions (approve, depositForBurn, etc.).
 */

import { useCallback, useState } from "react";
import { useSendTransaction, useSwitchChain } from "@privy-io/react-auth";
import type { SupportedEvmChain } from "../lib/evmAddresses";
import { getEvmChainConfig } from "../lib/evmAddresses";
import type { EvmTxRequest } from "../contracts/cctp_deposit";

export interface EvmSignerResult {
  /** Transaction hash on the EVM chain */
  txHash: string;
}

export interface UseEvmSignerReturn {
  /** Send an EVM transaction. Handles chain switching automatically. */
  sendEvmTx: (tx: EvmTxRequest) => Promise<EvmSignerResult>;
  /** Whether a transaction is currently being sent */
  isSending: boolean;
  /** Error from the last transaction, if any */
  error: string | null;
  /** Clear the error */
  clearError: () => void;
}

export function useEvmSigner(): UseEvmSignerReturn {
  const { sendTransaction } = useSendTransaction();
  const { switchChain } = useSwitchChain();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendEvmTx = useCallback(
    async (tx: EvmTxRequest): Promise<EvmSignerResult> => {
      setIsSending(true);
      setError(null);

      try {
        // Switch to the correct chain if needed
        await switchChain(tx.chainId);

        // Send the transaction via Privy embedded wallet
        const result = await sendTransaction({
          to: tx.to,
          data: tx.data,
          value: tx.value,
          chainId: tx.chainId,
        });

        // Privy returns the tx hash directly
        const txHash = typeof result === "string" ? result : result.hash;

        return { txHash };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "EVM transaction failed";
        setError(msg);
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [sendTransaction, switchChain],
  );

  return { sendEvmTx, isSending, error, clearError: () => setError(null) };
}

// ─── Chain name helper ────────────────────────────────────────────────────────

/**
 * Returns the Viem-compatible chain name for wallet switching.
 */
export function getChainName(chain: SupportedEvmChain): string {
  return getEvmChainConfig(chain).name;
}
