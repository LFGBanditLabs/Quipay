/**
 * useWorkforceRegistry
 * ────────────────────
 * Fetches the employer's active worker roster from the WorkforceRegistry
 * Soroban contract and enriches each worker with their stream history from
 * the backend analytics API.
 *
 * Also exposes `addWorker` and `removeWorker` mutations that build, sign,
 * and submit `set_stream_active` transactions through the connected wallet.
 */

import { useState, useEffect, useCallback } from "react";
import {
  getWorkersByEmployer,
  getWorkerProfile,
  buildSetStreamActiveTx,
  WorkerProfile,
} from "../contracts/workforce_registry";
import {
  getStreamsByEmployer,
  submitAndAwaitTx,
  ContractStream,
} from "../contracts/payroll_stream";
import { wallet } from "../util/wallet";
import { networkPassphrase } from "../contracts/util";

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const STROOPS_PER_UNIT = 1e7;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkerStreamRecord {
  stream_id: number;
  worker: string;
  total_amount: string;
  withdrawn_amount: string;
  start_ts: number;
  end_ts: number;
  status: "active" | "completed" | "cancelled";
}

export interface WorkerEntry extends WorkerProfile {
  activeStreams: number;
  totalStreams: number;
  /** Total withdrawn across completed streams, in token units (not stroops). */
  totalPaid: number;
  streams: WorkerStreamRecord[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWorkforceRegistry(employerAddress: string | undefined) {
  const [workers, setWorkers] = useState<WorkerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);

  const refetch = useCallback(() => setFetchTick((t) => t + 1), []);

  useEffect(() => {
    if (!employerAddress) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWorkers([]);
      setIsLoading(false);
      return;
    }

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Fetch profiles from the on-chain registry
        const profiles = await getWorkersByEmployer(
          employerAddress!,
          employerAddress!,
        );

        // 2. Fetch streams directly from the payroll_stream contract (no backend needed)
        let contractStreams: ContractStream[] = [];
        try {
          const page = await getStreamsByEmployer(employerAddress!, 0, 200);
          contractStreams = page.streams;
        } catch {
          // Contract unavailable — stream counts will be 0
        }

        // Also try backend if configured (enriches with withdrawn amounts)
        let backendStreams: WorkerStreamRecord[] = [];
        if (API_BASE)
          try {
            const res = await fetch(
              `${API_BASE}/analytics/streams?employer=${encodeURIComponent(employerAddress!)}&limit=200`,
            );
            if (res.ok) {
              const json = (await res.json()) as {
                ok: boolean;
                data?: WorkerStreamRecord[];
              };
              if (json.ok && Array.isArray(json.data))
                backendStreams = json.data;
            }
          } catch {
            /* backend unavailable */
          }

        // 3. Merge: prefer backend data if available, otherwise use contract data
        const entries: WorkerEntry[] = profiles.map((p) => {
          // Try backend first
          const backendWorkerStreams = backendStreams.filter(
            (s) => s.worker === p.wallet,
          );

          // Fall back to contract streams
          const contractWorkerStreams = contractStreams.filter(
            (s) => s.worker === p.wallet,
          );

          if (backendWorkerStreams.length > 0) {
            const activeStreams = backendWorkerStreams.filter(
              (s) => s.status === "active",
            ).length;
            const totalPaid = backendWorkerStreams
              .filter((s) => s.status === "completed")
              .reduce(
                (sum, s) =>
                  sum + parseFloat(s.withdrawn_amount) / STROOPS_PER_UNIT,
                0,
              );
            return {
              ...p,
              activeStreams,
              totalStreams: backendWorkerStreams.length,
              totalPaid,
              streams: backendWorkerStreams,
            };
          }

          // Use on-chain data — status: 0=active, 1=cancelled, 2=completed, 3=paused
          const activeStreams = contractWorkerStreams.filter(
            (s) => s.status === 0 || s.status === 3,
          ).length;
          const onchainStreams: WorkerStreamRecord[] =
            contractWorkerStreams.map((s, idx) => ({
              stream_id: idx,
              worker: p.wallet,
              total_amount: String(s.total_amount ?? 0),
              withdrawn_amount: String(s.withdrawn_amount ?? 0),
              start_ts: Number(s.start_ts ?? 0),
              end_ts: Number(s.end_ts ?? 0),
              status:
                s.status === 2
                  ? "completed"
                  : s.status === 1
                    ? "cancelled"
                    : "active",
            }));

          return {
            ...p,
            activeStreams,
            totalStreams: contractWorkerStreams.length,
            totalPaid: 0,
            streams: onchainStreams,
          };
        });

        setWorkers(entries);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load workforce data",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [employerAddress, fetchTick]);

  // ─── addWorker ──────────────────────────────────────────────────────────────

  const addWorker = useCallback(
    async (workerAddress: string): Promise<void> => {
      if (!employerAddress) throw new Error("Wallet not connected");

      // Verify the worker is registered before calling set_stream_active
      const profile = await getWorkerProfile(employerAddress, workerAddress);
      if (!profile) {
        throw new Error(
          "Worker is not registered in the Workforce Registry. " +
            "They must register themselves before you can add them.",
        );
      }

      const { preparedXdr } = await buildSetStreamActiveTx(
        employerAddress,
        workerAddress,
        true,
      );

      const { signedTxXdr } = await wallet.signTransaction(preparedXdr, {
        networkPassphrase,
      });

      await submitAndAwaitTx(signedTxXdr);
      refetch();
    },
    [employerAddress, refetch],
  );

  // ─── removeWorker ────────────────────────────────────────────────────────────

  const removeWorker = useCallback(
    async (workerAddress: string): Promise<void> => {
      if (!employerAddress) throw new Error("Wallet not connected");

      const { preparedXdr } = await buildSetStreamActiveTx(
        employerAddress,
        workerAddress,
        false,
      );

      const { signedTxXdr } = await wallet.signTransaction(preparedXdr, {
        networkPassphrase,
      });

      await submitAndAwaitTx(signedTxXdr);
      refetch();
    },
    [employerAddress, refetch],
  );

  return {
    workers,
    isLoading,
    error,
    refetch,
    addWorker,
    removeWorker,
  };
}
