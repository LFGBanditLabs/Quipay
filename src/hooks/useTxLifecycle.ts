import { useState, useCallback, useRef } from "react";
import type { TransactionStage } from "../components/TransactionProgressOverlay";

export interface TxLifecycleState {
  isActive: boolean;
  stage: TransactionStage;
  error?: string;
}

export interface TxLifecycleControls {
  startTransaction: () => void;
  setStage: (stage: TransactionStage) => void;
  completeTransaction: () => void;
  failTransaction: (error: string) => void;
  resetTransaction: () => void;
}

/**
 * Hook to manage the transaction lifecycle state machine.
 * Tracks transaction progress through Building → Signing → Submitting → Confirmed stages.
 *
 * Usage:
 * ```tsx
 * const { state, controls } = useTxLifecycle();
 *
 * const handleDisbursement = async () => {
 *   controls.startTransaction();
 *   try {
 *     controls.setStage("building");
 *     // ... build transaction
 *     controls.setStage("signing");
 *     // ... sign transaction
 *     controls.setStage("submitting");
 *     // ... submit transaction
 *     controls.completeTransaction();
 *   } catch (error) {
 *     controls.failTransaction(error.message);
 *   }
 * };
 * ```
 */
export function useTxLifecycle() {
  const [state, setState] = useState<TxLifecycleState>({
    isActive: false,
    stage: "building",
  });

  const stageSequenceRef = useRef<TransactionStage[]>([
    "building",
    "signing",
    "submitting",
    "confirmed",
  ]);

  const startTransaction = useCallback(() => {
    setState({
      isActive: true,
      stage: "building",
    });
  }, []);

  const setStage = useCallback((stage: TransactionStage) => {
    setState((prev) => ({
      ...prev,
      stage,
    }));
  }, []);

  const completeTransaction = useCallback(() => {
    setState((prev) => ({
      ...prev,
      stage: "confirmed",
    }));
  }, []);

  const failTransaction = useCallback((error: string) => {
    setState((prev) => ({
      ...prev,
      error,
    }));
  }, []);

  const resetTransaction = useCallback(() => {
    setState({
      isActive: false,
      stage: "building",
    });
  }, []);

  return {
    state,
    controls: {
      startTransaction,
      setStage,
      completeTransaction,
      failTransaction,
      resetTransaction,
    },
  };
}
