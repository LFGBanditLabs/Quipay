/**
 * useEvmSigner.ts
 * ────────────────
 * Sends EVM transactions via the Privy embedded wallet.
 *
 * Privy auto-creates an EVM embedded wallet on login (see AuthProvider).
 * This hook wraps Privy's useSendTransaction to provide a simple interface
 * for sending raw EVM transactions (approve, depositForBurn, etc.).
 *
 * Privy handles chain switching internally when chainId is specified
 * in the transaction request — no separate switchChain call needed.
 */

import { useCallback, useState } from "react";
import { useSendTransaction } from "@privy-io/react-auth";
import type { EvmTxRequest } from "../contracts/cctp_deposit";

export interface EvmSignerResult {
  /** Transaction hash on the EVM chain */
  txHash: string;
}

export interface UseEvmSignerReturn {
  /** Send an EVM transaction. Privy switches chain automatically. */
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
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendEvmTx = useCallback(
    async (tx: EvmTxRequest): Promise<EvmSignerResult> => {
      setIsSending(true);
      setError(null);

      try {
        // Privy handles chain switching when chainId is provided
        const result = await sendTransaction({
          to: tx.to,
          data: tx.data,
          value: tx.value,
          chainId: tx.chainId,
        });

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
    [sendTransaction],
  );

  return { sendEvmTx, isSending, error, clearError: () => setError(null) };
}
