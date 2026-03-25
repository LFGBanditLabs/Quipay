import { useState, useEffect, useCallback } from "react";
import {
  getStreamsByWorker,
  getStreamById,
  getTokenSymbol,
  getWorkerWithdrawalEvents,
  ContractStream,
} from "../contracts/payroll_stream";

export interface WorkerStream {
  id: string;
  employerName: string;
  employerAddress: string;
  flowRate: number; // amount per second (in token units, not stroops)
  tokenSymbol: string;
  startTime: number; // unix timestamp in seconds
  cliffTime: number; // unix timestamp in seconds (cliff unlock time)
  totalAmount: number; // total allocated (in token units)
  claimedAmount: number;
}

export interface WithdrawalRecord {
  id: string;
  amount: string;
  tokenSymbol: string;
  date: string;
  txHash: string;
}

/** Stellar uses 7 decimal places (10^7 stroops = 1 token unit). */
const STROOPS_PER_UNIT = 1e7;

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
              const tokenSymbol = await getTokenSymbol(workerAddress, s.token);
              return {
                id: id.toString(),
                employerName: s.employer,
                employerAddress: s.employer,
                flowRate: Number(s.rate) / STROOPS_PER_UNIT,
                tokenSymbol,
                startTime: Number(s.start_ts),
                cliffTime: Number(s.cliff_ts),
                totalAmount: Number(s.total_amount) / STROOPS_PER_UNIT,
                claimedAmount: Number(s.withdrawn_amount) / STROOPS_PER_UNIT,
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
