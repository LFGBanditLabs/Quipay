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
import { submitAndAwaitTx } from "../contracts/payroll_stream";
import { wallet } from "../util/wallet";
import { networkPassphrase } from "../contracts/util";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
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

        // 2. Fetch all streams for this employer from the backend
        let allStreams: WorkerStreamRecord[] = [];
        try {
          const res = await fetch(
            `${API_BASE}/analytics/streams?employer=${encodeURIComponent(employerAddress!)}&limit=200`,
          );
          if (res.ok) {
            const json = (await res.json()) as {
              ok: boolean;
              data?: WorkerStreamRecord[];
            };
            if (json.ok && Array.isArray(json.data)) {
              allStreams = json.data;
            }
          }
        } catch {
          // Backend unavailable — stream counts will be zero
        }

        // 3. Merge stream data into worker entries
        const entries: WorkerEntry[] = profiles.map((p) => {
          const workerStreams = allStreams.filter((s) => s.worker === p.wallet);
          const activeStreams = workerStreams.filter(
            (s) => s.status === "active",
          ).length;
          const totalPaid = workerStreams
            .filter((s) => s.status === "completed")
            .reduce(
              (sum, s) =>
                sum + parseFloat(s.withdrawn_amount) / STROOPS_PER_UNIT,
              0,
            );

          return {
            ...p,
            activeStreams,
            totalStreams: workerStreams.length,
            totalPaid,
            streams: workerStreams,
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
