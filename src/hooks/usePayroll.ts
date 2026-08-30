import { useState, useEffect, useCallback, useMemo } from "react";
import { io } from "socket.io-client";
import { Asset } from "@stellar/stellar-sdk";
import { useAuth } from "./useAuth";
import { networkPassphrase } from "../contracts/util";
import {
  getAllVaultData,
  type TokenVaultData,
} from "../contracts/payroll_vault";
import {
  getStreamsByWorker,
  getStreamById,
  getTokenSymbol,
  ContractStream,
} from "../contracts/payroll_stream";
import { getWorkersByEmployer } from "../contracts/workforce_registry";
import { rawToUnitNumber } from "../util/stroops";
import type { SupportedEvmChain } from "../lib/evmAddresses";
import { useNotification } from "./useNotification";
import { type StreamEvent, isVaultBalanceLow } from "../lib/notificationRules";

/** ---------------- REQUEST DEDUP ---------------- */

type CacheEntry<T> = {
  promise: Promise<T>;
  timestamp: number;
};

const requestCache = new Map<string, CacheEntry<unknown>>();
const TTL = 2000; // 2 seconds

async function dedupRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = requestCache.get(key);

  if (existing && now - existing.timestamp < TTL) {
    return existing.promise as Promise<T>;
  }

  const promise = fn();
  requestCache.set(key, { promise, timestamp: now });

  try {
    const result = await promise;
    return result;
  } catch (err) {
    requestCache.delete(key);
    throw err;
  }
}

export interface Stream {
  id: string;
  employeeName: string;
  employeeAddress: string;
  flowRate: string;
  tokenSymbol: string;
  startDate: string;
  endDate: string;
  totalAmount: string;
  totalStreamed: string;
  status: "active" | "paused" | "completed" | "cancelled";
  pendingAction?: "pause" | "resume" | "cancel";
}

export interface TokenBalance {
  tokenSymbol: string;
  balance: string;
}

export interface PayrollSummary {
  total_disbursed: string;
  avg_payment: string;
  cost_by_department: Array<{
    dept: string;
    total: string;
  }>;
  headcount: number;
  streams_active: number;
}

// Use the actual SAC (contract) addresses so vault balance queries match the
// keys deposits are stored under. USDC's SAC is derived from its classic asset
// — the raw issuer G-address is NOT the token contract and returns 0.
const XLM_SAC =
  import.meta.env.PUBLIC_XLM_SAC ??
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const USDC_ISSUER =
  import.meta.env.PUBLIC_USDC_ISSUER ??
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC_SAC = new Asset("USDC", USDC_ISSUER).contractId(networkPassphrase);

const DEFAULT_TOKENS = [
  { token: XLM_SAC, tokenSymbol: "XLM", monthlyBurnRate: BigInt(0) },
  { token: USDC_SAC, tokenSymbol: "USDC", monthlyBurnRate: BigInt(0) },
];

export const usePayroll = (employerAddress: string | undefined) => {
  const { addNotification } = useNotification();
  const [treasuryBalances, setTreasuryBalances] = useState<TokenBalance[]>([]);
  const [totalLiabilities, setTotalLiabilities] = useState<string>("0");
  const [streams, setStreams] = useState<Stream[]>([]);
  const [vaultData, setVaultData] = useState<TokenVaultData[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVaultLoading, setIsVaultLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [payrollSummaryError, setPayrollSummaryError] = useState<string | null>(
    null,
  );
  const [fetchTick, setFetchTick] = useState(0);
  const [crossChainWithdrawals, setCrossChainWithdrawals] = useState<
    Array<{
      amount: number;
      destChain: SupportedEvmChain;
      destAddress: string;
      txHash: string;
      timestamp: number;
    }>
  >([]);

  const fetchVaultData = useCallback(async () => {
    setIsVaultLoading(true);
    try {
      const data = await dedupRequest("vaultData", () =>
        getAllVaultData(DEFAULT_TOKENS, employerAddress ?? ""),
      );

      setVaultData(data);
      setTreasuryBalances(
        data.map((v: TokenVaultData) => ({
          tokenSymbol: v.tokenSymbol,
          balance: v.balance.toString(),
        })),
      );

      const totalLiability = data.reduce(
        (sum: bigint, v: TokenVaultData) => sum + v.liability,
        BigInt(0),
      );
      setTotalLiabilities(totalLiability.toString());

      // Trigger low-balance alert if vault balance < 2 weeks burn rate
      data.forEach((v: TokenVaultData) => {
        const balanceNum = Number(v.balance);
        const liabilityNum = Number(v.liability);
        if (
          employerAddress &&
          liabilityNum > 0 &&
          isVaultBalanceLow(balanceNum, liabilityNum)
        ) {
          addNotification({
            type: "vault.low_balance",
            employerAddress,
            amount: String(balanceNum),
            token: v.tokenSymbol,
            timestamp: Date.now(),
            metadata: {
              dedupeKey: `vault_low:${employerAddress}:${v.tokenSymbol}:${new Date().toDateString()}`,
            },
          });
        }
      });
    } catch (error) {
      console.error("Failed to fetch vault data:", error);
      setVaultData([]);
    } finally {
      setIsVaultLoading(false);
    }
  }, [addNotification, employerAddress]);

  const fetchPayrollSummary = useCallback(async (address: string) => {
    // Payroll summary comes from the backend analytics API.
    // Skip silently when no backend URL is configured (testnet / frontend-only mode).
    const backendUrl = import.meta.env.PUBLIC_BACKEND_URL;
    if (!backendUrl) {
      setPayrollSummary(null);
      setPayrollSummaryError(null);
      return;
    }

    try {
      await dedupRequest(`summary-${address}`, async () => {
        const response = await fetch(
          `${backendUrl}/api/v1/analytics/payroll-summary?org_id=${encodeURIComponent(address)}&period=ytd`,
        );

        if (!response.ok) throw new Error("Failed to load payroll summary");

        const payload = await response.json();
        setPayrollSummary(payload.data ?? null);
      });
      setPayrollSummaryError(null);
    } catch (err) {
      console.error("Failed to fetch payroll summary:", err);
      setPayrollSummaryError(
        err instanceof Error
          ? err.message
          : "Failed to load payroll summary. Please retry.",
      );
    }
  }, []);

  const retryPayrollSummary = useCallback(async () => {
    if (!employerAddress) return;
    await fetchPayrollSummary(employerAddress);
  }, [employerAddress, fetchPayrollSummary]);

  const fetchStreams = useCallback(async (address: string) => {
    try {
      // The contract's get_streams_by_employer returns Stream structs with
      // NO ids, so we resolve real ids the way the contract exposes them:
      // per worker via get_streams_by_worker, then get_stream(id). This
      // makes each row's id the true on-chain stream id (so /stream/:id
      // links work) instead of a fabricated index.
      const workers = await dedupRequest(`workers-${address}`, () =>
        getWorkersByEmployer(address, address).catch(() => []),
      );

      const idSet = new Set<string>();
      await Promise.all(
        workers.map(async (w) => {
          const ids = await getStreamsByWorker(w.wallet).catch(() => []);
          ids.forEach((id) => idSet.add(id.toString()));
        }),
      );

      const detailed = await Promise.all(
        [...idSet].map(async (idStr) => {
          const s = await getStreamById(address, BigInt(idStr)).catch(
            () => null,
          );
          return s ? { id: idStr, s } : null;
        }),
      );

      const employerStreams: Stream[] = await Promise.all(
        detailed
          .filter((x): x is { id: string; s: ContractStream } => x !== null)
          .filter(({ s }) => s.employer === address)
          .sort((a, b) => Number(a.id) - Number(b.id))
          .map(async ({ id, s }) => {
            const tokenSymbol = await getTokenSymbol(address, s.token);
            return {
              id,
              employeeName: `${s.worker.slice(0, 6)}…${s.worker.slice(-4)}`,
              employeeAddress: s.worker,
              flowRate: rawToUnitNumber(s.rate).toFixed(7),
              tokenSymbol,
              startDate: new Date(Number(s.start_ts) * 1000)
                .toISOString()
                .split("T")[0],
              endDate: new Date(Number(s.end_ts) * 1000)
                .toISOString()
                .split("T")[0],
              totalAmount: rawToUnitNumber(s.total_amount).toFixed(2),
              totalStreamed: rawToUnitNumber(s.withdrawn_amount).toFixed(2),
              status:
                s.status === 1
                  ? "cancelled"
                  : s.status === 2
                    ? "completed"
                    : s.status === 3
                      ? "paused"
                      : "active",
            };
          }),
      );

      setStreams(employerStreams);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load stream data",
      );
      setStreams([]);
    }
  }, []);

  const refetch = useCallback(() => {
    setFetchTick((t) => t + 1);
  }, []);

  /** Record a cross-chain withdrawal for the current session */
  const recordCrossChainWithdrawal = useCallback(
    (withdrawal: {
      amount: number;
      destChain: SupportedEvmChain;
      destAddress: string;
      txHash: string;
    }) => {
      setCrossChainWithdrawals((prev) => [
        { ...withdrawal, timestamp: Date.now() },
        ...prev,
      ]);
      addNotification({
        type: "withdrawal.completed",
        amount: String(withdrawal.amount),
        token: "USDC",
        timestamp: Date.now(),
        metadata: {
          destChain: withdrawal.destChain,
          destAddress: withdrawal.destAddress,
          txHash: withdrawal.txHash,
        },
      });
    },
    [addNotification],
  );

  const applyOptimisticStreamStatus = useCallback(
    (
      streamId: string,
      status: Stream["status"],
      action: "pause" | "resume" | "cancel",
    ) => {
      setStreams((prev) => {
        const target = prev.find((s) => s.id === streamId);
        const actionTypeMap: Record<string, StreamEvent["type"]> = {
          pause: "stream.paused",
          resume: "stream.resumed",
          cancel: "stream.cancelled",
        };
        const eventType = actionTypeMap[action];
        if (eventType) {
          addNotification({
            type: eventType,
            streamId,
            employerAddress,
            workerAddress: target?.employeeAddress,
            amount: target?.totalAmount,
            token: target?.tokenSymbol || "USDC",
            timestamp: Date.now(),
          });
        }

        return prev.map((stream) =>
          stream.id === streamId
            ? {
                ...stream,
                status,
                pendingAction: action,
              }
            : stream,
        );
      });
    },
    [addNotification, employerAddress],
  );

  const restoreStream = useCallback((snapshot: Stream) => {
    setStreams((prev) =>
      prev.map((stream) =>
        stream.id === snapshot.id
          ? {
              ...snapshot,
              pendingAction: undefined,
            }
          : stream,
      ),
    );
  }, []);

  const clearStreamPending = useCallback((streamId: string) => {
    setStreams((prev) =>
      prev.map((stream) =>
        stream.id === streamId
          ? {
              ...stream,
              pendingAction: undefined,
            }
          : stream,
      ),
    );
  }, []);

  const refreshData = useCallback(async () => {
    await fetchVaultData();
    if (employerAddress) {
      await Promise.all([
        fetchStreams(employerAddress),
        fetchPayrollSummary(employerAddress),
      ]);
    }
  }, [employerAddress, fetchPayrollSummary, fetchStreams, fetchVaultData]);

  const { authenticated, getAccessToken } = useAuth();

  useEffect(() => {
    // Only connect to WebSocket when a backend URL is explicitly configured.
    // Without a backend the socket just floods the console with ERR_CONNECTION_REFUSED.
    const WS_URL = import.meta.env.PUBLIC_BACKEND_URL;
    if (!employerAddress || !WS_URL || !authenticated) return;

    let socket: ReturnType<typeof io> | null = null;
    let isCancelled = false;

    const connectSocket = async () => {
      try {
        const token = await getAccessToken();
        if (!token || isCancelled) return;

        socket = io(WS_URL, {
          path: "/socket.io",
          query: { token },
        });

        socket.on("stream:event", (event?: StreamEvent) => {
          if (event && event.type) {
            addNotification(event);
          }
          refetch();
        });
      } catch (err) {
        // If the token cannot be retrieved, do not connect unauthenticated.
        console.warn(
          "Payroll WebSocket connection skipped due to auth token error:",
          err,
        );
      }
    };

    void connectSocket();

    return () => {
      isCancelled = true;
      socket?.disconnect();
    };
  }, [addNotification, authenticated, employerAddress, getAccessToken, refetch]);

  useEffect(() => {
    if (!employerAddress) {
      // Resetting all state when the wallet disconnects is intentional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStreams([]);
      setPayrollSummary(null);
      setIsLoading(false);
      setError(null);
      setPayrollSummaryError(null);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await fetchVaultData();
        await Promise.all([
          fetchStreams(employerAddress),
          fetchPayrollSummary(employerAddress),
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load payroll data",
        );
        setStreams([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [
    employerAddress,
    fetchPayrollSummary,
    fetchStreams,
    fetchTick,
    fetchVaultData,
  ]);

  const activeStreams = useMemo(
    () =>
      streams.filter(
        (s) =>
          s.status === "active" ||
          s.status === "paused" ||
          s.pendingAction !== undefined,
      ),
    [streams],
  );

  const activeStreamsCount = useMemo(
    () => streams.filter((s) => s.status === "active").length,
    [streams],
  );

  return {
    treasuryBalances,
    totalLiabilities,
    payrollSummary,
    payrollSummaryError,
    activeStreamsCount,
    streams,
    activeStreams,
    vaultData,
    isLoading,
    isVaultLoading,
    error,
    refreshData,
    refreshVaultData: fetchVaultData,
    refetch,
    retryPayrollSummary,
    applyOptimisticStreamStatus,
    restoreStream,
    clearStreamPending,
    crossChainWithdrawals,
    recordCrossChainWithdrawal,
  };
};
