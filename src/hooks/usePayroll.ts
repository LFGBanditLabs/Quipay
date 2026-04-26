import { useState, useEffect, useCallback, useMemo } from "react";
import { io } from "socket.io-client";
import {
  getAllVaultData,
  type TokenVaultData,
} from "../contracts/payroll_vault";
import {
  getStreamsByEmployer,
  getTokenSymbol,
  ContractStream,
} from "../contracts/payroll_stream";

/** ---------------- REQUEST DEDUP ---------------- */

type CacheEntry<T> = {
  promise: Promise<T>;
  timestamp: number;
};

const requestCache = new Map<string, CacheEntry<any>>();
const TTL = 2000; // 2 seconds

async function dedupRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = requestCache.get(key);

  if (existing && now - existing.timestamp < TTL) {
    return existing.promise;
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

/** Stellar uses 7 decimal places (10^7 stroops = 1 token unit). */
const STROOPS_PER_UNIT = 1e7;

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

const USDC_ISSUER = import.meta.env.PUBLIC_USDC_ISSUER || "";

const DEFAULT_TOKENS = [
  { token: "", tokenSymbol: "XLM", monthlyBurnRate: BigInt(0) },
  {
    token: USDC_ISSUER,
    tokenSymbol: "USDC",
    monthlyBurnRate: BigInt(0),
  },
];

export const usePayroll = (
  employerAddress: string | undefined,
  options?: {
    offset?: number;
    limit?: number;
  },
) => {
  const [treasuryBalances, setTreasuryBalances] = useState<TokenBalance[]>([]);
  const [totalLiabilities, setTotalLiabilities] = useState<string>("0");
  const [streams, setStreams] = useState<Stream[]>([]);
  const [vaultData, setVaultData] = useState<TokenVaultData[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVaultLoading, setIsVaultLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);

  const fetchVaultData = useCallback(async () => {
    setIsVaultLoading(true);
    try {
      const data = await dedupRequest("vaultData", () =>
        getAllVaultData(DEFAULT_TOKENS),
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
    } catch (error) {
      console.error("Failed to fetch vault data:", error);
      setVaultData([]);
    } finally {
      setIsVaultLoading(false);
    }
  }, []);

  const fetchPayrollSummary = useCallback(async (address: string) => {
    const backendUrl =
      import.meta.env.PUBLIC_BACKEND_URL || "http://localhost:3001";

    await dedupRequest(`summary-${address}`, async () => {
      const response = await fetch(
        `${backendUrl}/api/v1/analytics/payroll-summary?org_id=${encodeURIComponent(address)}&period=ytd`,
      );

      if (!response.ok) throw new Error("Failed to load payroll summary");

      const payload = await response.json();
      setPayrollSummary(payload.data ?? null);
    });
  }, []);

  const fetchStreams = useCallback(
    async (address: string) => {
      try {
        const streamPage = await dedupRequest(
          `streams-${address}-${options?.offset}-${options?.limit}`,
          () => getStreamsByEmployer(address, options?.offset, options?.limit),
        );

        const employerStreams: Stream[] = await Promise.all(
          streamPage.streams.map(async (s: ContractStream, index: number) => {
            const streamId = String((options?.offset ?? 0) + index + 1);
            const tokenSymbol = await getTokenSymbol(address, s.token);

            return {
              id: streamId,
              employeeName: `Worker ${streamId.slice(0, 8)}`,
              employeeAddress: s.worker,
              flowRate: (Number(s.rate) / STROOPS_PER_UNIT).toFixed(7),
              tokenSymbol,
              startDate: new Date(Number(s.start_ts) * 1000)
                .toISOString()
                .split("T")[0],
              endDate: new Date(Number(s.end_ts) * 1000)
                .toISOString()
                .split("T")[0],
              totalAmount: (
                Number(s.total_amount) / STROOPS_PER_UNIT
              ).toFixed(2),
              totalStreamed: (
                Number(s.withdrawn_amount) / STROOPS_PER_UNIT
              ).toFixed(2),
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
        setError(err instanceof Error ? err.message : "Failed to load stream data");
        setStreams([]);
      }
    },
    [options?.offset, options?.limit],
  );

  const refetch = useCallback(() => {
    setFetchTick((t) => t + 1);
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

  useEffect(() => {
    if (!employerAddress) return;

    const WS_URL =
      import.meta.env.PUBLIC_BACKEND_URL || "http://localhost:3001";

    const socket = io(WS_URL, {
      path: "/socket.io",
      query: { token: localStorage.getItem("auth_token") || "dummy" },
    });

    socket.on("stream:event", () => {
      refetch();
    });

    return () => socket.disconnect();
  }, [employerAddress, refetch]);

  useEffect(() => {
    if (!employerAddress) {
      setStreams([]);
      setPayrollSummary(null);
      setIsLoading(false);
      setError(null);
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
        setError(err instanceof Error ? err.message : "Failed to load payroll data");
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
  };
};