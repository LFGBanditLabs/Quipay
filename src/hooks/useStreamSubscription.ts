import { useCallback, useRef } from "react";
import { scValToNative } from "@stellar/stellar-sdk";
import type { Api } from "@stellar/stellar-sdk/rpc";
import { useSubscription } from "./useSubscription";
import { PAYROLL_STREAM_CONTRACT_ID } from "../contracts/payroll_stream";

/** Stellar uses 7 decimal places (10^7 stroops = 1 token unit). */
const STROOPS_PER_UNIT = 1e7;

export interface StreamWithdrawalUpdate {
  streamId: string;
  amount: number;
}

/**
 * Subscribe to `stream.withdrawn` events from the PayrollStream contract.
 *
 * Calls `onWithdrawal` whenever a withdrawal event is detected, and
 * optionally triggers a full refetch of stream data.
 */
export function useStreamSubscription(
  onWithdrawal: (update: StreamWithdrawalUpdate) => void,
  refetch?: () => void,
  pollInterval = 5000,
) {
  const onWithdrawalRef = useRef(onWithdrawal);
  onWithdrawalRef.current = onWithdrawal;

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const handleEvent = useCallback((event: Api.EventResponse) => {
    try {
      if (!event.topic || event.topic.length < 4) return;

      const streamId = String(scValToNative(event.topic[2]) as bigint);
      const [amount] = scValToNative(event.value) as [bigint, string];

      onWithdrawalRef.current({
        streamId,
        amount: Number(amount) / STROOPS_PER_UNIT,
      });

      refetchRef.current?.();
    } catch {
      // Silently skip malformed events
    }
  }, []);

  useSubscription(
    PAYROLL_STREAM_CONTRACT_ID,
    "withdrawn",
    handleEvent,
    pollInterval,
  );
}
