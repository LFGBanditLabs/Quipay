import { useState, useEffect, useCallback } from "react";
import {
  getStreamsByWorker,
  getStreamById,
  getTokenSymbol,
  getWorkerWithdrawalEvents,
  ContractStream,
} from "../contracts/payroll_stream";

/**
 * Normalised view of a single on-chain payroll stream for a worker.
 * All monetary values are in token units (not stroops).
 */
export interface WorkerStream {
  /** On-chain stream ID (stringified `u64`). */
  id: string;
  /** Display name for the employer (currently mirrors `employerAddress`). */
  employerName: string;
  /** Stellar account ID of the employer who created this stream. */
  employerAddress: string;
  /** Accrual rate in token units per second (= on-chain `rate` / 10^7). */
  flowRate: number;
  /** Token symbol, e.g. `"USDC"` or `"XLM"`. */
  tokenSymbol: string;
  /** Stream start time as a Unix timestamp in seconds. */
  startTime: number;
  /** Cliff unlock time as a Unix timestamp in seconds. No withdrawals before this point. */
  cliffTime: number;
  /** Total allocated amount in token units (= on-chain `total_amount` / 10^7). */
  totalAmount: number;
  /** Amount already withdrawn in token units (= on-chain `withdrawn_amount` / 10^7). */
  claimedAmount: number;
  /** `0` = Active, `1` = Canceled, `2` = Completed (mirrors on-chain `StreamStatus` enum). */
  status: number;
  /** IPFS CID of the payroll proof — only present for completed streams. */
  proofCid?: string;
  /** Public HTTPS gateway URL for the proof — only present for completed streams. */
  proofGatewayUrl?: string;
}

/** A single historical withdrawal event emitted by the payroll stream contract. */
export interface WithdrawalRecord {
  /** Transaction hash (used as a unique record identifier). */
  id: string;
  /** ID of the stream this withdrawal belongs to. */
  streamId: string;
  /** Withdrawn amount formatted to 7 decimal places (token units). */
  amount: string;
  /** Token symbol, e.g. `"USDC"`. */
  tokenSymbol: string;
  /** Human-readable date string via `Date.toLocaleString()`. */
  date: string;
  /** Stellar transaction hash for the withdrawal. */
  txHash: string;
}

/** Stellar uses 7 decimal places (10^7 stroops = 1 token unit). */
const STROOPS_PER_UNIT = 1e7;

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

const fetchProof = async (
  streamId: string,
): Promise<{ cid: string; gatewayUrl: string } | null> => {
  try {
    const res = await fetch(`${BACKEND_URL}/proofs/${streamId}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { cid: string; gatewayUrl: string };
    return data;
  } catch {
    return null;
  }
};

/**
 * Fetches and subscribes to all payroll streams for a given worker.
 *
 * On mount (and whenever `workerAddress` changes or `refetch` is called) the
 * hook queries the on-chain payroll stream contract for every stream ID
 * associated with the worker, resolves each stream's token symbol, and for
 * completed streams also fetches the IPFS proof from the backend.
 *
 * @param workerAddress - Stellar account ID of the worker, or `undefined` while
 *   the wallet is not yet connected. Passing `undefined` resets all state and
 *   skips the fetch.
 * @returns An object containing the resolved streams, withdrawal history,
 *   loading/error state, and a `refetch` callback to trigger a manual reload.
 *
 * @throws Never — errors are caught internally and exposed via the `error` field.
 *
 * @example
 * ```tsx
 * const { streams, isLoading, error, refetch } = useStreams(walletAddress);
 * ```
 */
export const useStreams = (workerAddress: string | undefined) => {
  const [streams, setStreams] = useState<WorkerStream[]>([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState<
    WithdrawalRecord[]
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);

  const refetch = useCallback(() => {
    setFetchTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!workerAddress) {
      setStreams([]);
      setWithdrawalHistory([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const streamIds = await getStreamsByWorker(workerAddress);

        const streamResults = await Promise.all(
          streamIds.map((id) => getStreamById(workerAddress, id)),
        );

        const workerStreams: WorkerStream[] = await Promise.all(
          streamIds
            .map((id, i) => ({
              id,
              stream: streamResults[i],
            }))
            .filter(
              (x): x is { id: bigint; stream: ContractStream } =>
                x.stream !== null,
            )
            .map(async ({ id, stream: s }) => {
              const streamId = id.toString();
              const tokenSymbol = await getTokenSymbol(workerAddress, s.token);
              const isCompleted = s.status === 2;
              const proof = isCompleted ? await fetchProof(streamId) : null;
              return {
                id: streamId,
                employerName: s.employer,
                employerAddress: s.employer,
                flowRate: Number(s.rate) / STROOPS_PER_UNIT,
                tokenSymbol,
                startTime: Number(s.start_ts),
                cliffTime: Number(s.cliff_ts),
                totalAmount: Number(s.total_amount) / STROOPS_PER_UNIT,
                claimedAmount: Number(s.withdrawn_amount) / STROOPS_PER_UNIT,
                status: s.status,
                proofCid: proof?.cid,
                proofGatewayUrl: proof?.gatewayUrl,
              };
            }),
        );

        setStreams(workerStreams);

        const events = await getWorkerWithdrawalEvents(workerAddress);

        const history: WithdrawalRecord[] = await Promise.all(
          events.map(async (ev) => {
            const tokenSymbol = await getTokenSymbol(workerAddress, ev.token);
            return {
              id: ev.txHash,
              streamId: ev.streamId.toString(),
              amount: (Number(ev.amount) / STROOPS_PER_UNIT).toFixed(7),
              tokenSymbol,
              date: new Date(ev.ledgerClosedAt).toLocaleString(),
              txHash: ev.txHash,
            };
          }),
        );

        setWithdrawalHistory(history);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load stream data";
        setError(message);
        setStreams([]);
        setWithdrawalHistory([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [workerAddress, fetchTick]);

  return {
    streams,
    withdrawalHistory,
    isLoading,
    error,
    refetch,
  };
};
