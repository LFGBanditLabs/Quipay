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

/** Stellar uses 7 decimal places (10^7 stroops = 1 token unit). */
const STROOPS_PER_UNIT = 1e7;

/** Normalised view of a payroll stream as seen by the employer dashboard. */
export interface Stream {
  /** On-chain stream ID (stringified `u64`). */
  id: string;
  /** Placeholder display name for the employee (derived from the stream ID). */
  employeeName: string;
  /** Stellar account ID of the worker receiving this stream. */
  employeeAddress: string;
  /** Accrual rate formatted to 7 decimal places in token units per second. */
  flowRate: string;
  /** Token symbol, e.g. `"USDC"` or `"XLM"`. */
  tokenSymbol: string;
  /** ISO 8601 date string (date portion only) for the stream start. */
  startDate: string;
  /** ISO 8601 date string (date portion only) for the stream end. */
  endDate: string;
  /** Total allocated amount formatted to 2 decimal places in token units. */
  totalAmount: string;
  /** Amount already streamed (withdrawn) formatted to 2 decimal places in token units. */
  totalStreamed: string;
  /** Lifecycle status of the stream. */
  status: "active" | "paused" | "completed" | "cancelled";
  /** Client-side action currently waiting for confirmation. */
  pendingAction?: "pause" | "resume" | "cancel";
}

/** Token balance as reported by the PayrollVault contract. */
export interface TokenBalance {
  /** Token symbol, e.g. `"USDC"` or `"XLM"`. */
  tokenSymbol: string;
  /** Available balance as a plain string (raw bigint value from the contract). */
  balance: string;
}

// Default tokens to monitor (XLM and USDC)
const USDC_ISSUER = import.meta.env.PUBLIC_USDC_ISSUER || "";

const DEFAULT_TOKENS: Array<{
  token: string;
  tokenSymbol: string;
  monthlyBurnRate: bigint;
}> = [
  { token: "", tokenSymbol: "XLM", monthlyBurnRate: BigInt(0) },
  {
    token: USDC_ISSUER,
    tokenSymbol: "USDC",
    monthlyBurnRate: BigInt(0),
  },
];

/**
 * Fetches vault balances and payroll streams for an employer.
 *
 * Combines data from two on-chain sources: the PayrollVault contract
 * (treasury balances and liabilities) and the PayrollStream contract
 * (per-stream metadata and status). Falls back gracefully if the vault is
 * not yet configured.
 *
 * @param employerAddress - Stellar account ID of the employer, or `undefined`
 *   while the wallet is disconnected. Passing `undefined` resets all state.
 * @param options.offset - Index offset for paginating stream results.
 * @param options.limit - Maximum number of streams to return per fetch.
 * @returns Treasury balances, liabilities, stream list, loading state, error
 *   message, and callbacks to refresh data.
 *
 * @example
 * ```tsx
 * const { streams, treasuryBalances, isLoading, refreshData } = usePayroll(address);
 * ```
 */
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVaultLoading, setIsVaultLoading] = useState<boolean>(false);

  const fetchVaultData = useCallback(async () => {
    setIsVaultLoading(true);
    try {
      const data = await getAllVaultData(DEFAULT_TOKENS);
      setVaultData(data);

      // Update treasury balances from vault data
      setTreasuryBalances(
        data.map((v: TokenVaultData) => ({
          tokenSymbol: v.tokenSymbol,
          balance: v.balance.toString(),
        })),
      );

      // Calculate total liabilities (simplified - sum across all tokens)
      const totalLiability = data.reduce(
        (sum: bigint, v: TokenVaultData) => sum + v.liability,
        BigInt(0),
      );
      setTotalLiabilities(totalLiability.toString());
    } catch (error) {
      console.error("Failed to fetch vault data:", error);
      // Fall back to mock data if vault is not configured
      setVaultData([]);
    } finally {
      setIsVaultLoading(false);
    }
  }, []);

  const [error, setError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);

  const refetch = useCallback(() => {
    setFetchTick((t) => t + 1);
  }, []);

  const fetchStreams = useCallback(
    async (address: string) => {
      try {
        const streamPage = await getStreamsByEmployer(
          address,
          options?.offset,
          options?.limit,
        );

        const employerStreams: Stream[] = await Promise.all(
          streamPage.streams.map(async (s: ContractStream, index: number) => {
            const streamId = String((options?.offset ?? 0) + index + 1);
            const tokenSymbol = await getTokenSymbol(address, s.token);

            const flowRate = (Number(s.rate) / STROOPS_PER_UNIT).toFixed(7);
            const totalAmount = (
              Number(s.total_amount) / STROOPS_PER_UNIT
            ).toFixed(2);
            const totalStreamed = (
              Number(s.withdrawn_amount) / STROOPS_PER_UNIT
            ).toFixed(2);

            const startDate = new Date(Number(s.start_ts) * 1000)
              .toISOString()
              .split("T")[0];
            const endDate = new Date(Number(s.end_ts) * 1000)
              .toISOString()
              .split("T")[0];

            let status: Stream["status"];
            switch (s.status) {
              case 0:
                status = "active";
                break;
              case 1:
                status = "cancelled";
                break;
              case 2:
                status = "completed";
                break;
              case 3:
                status = "paused";
                break;
              default:
                status = "active";
            }

            return {
              id: streamId,
              employeeName: `Worker ${streamId.slice(0, 8)}`,
              employeeAddress: s.worker,
              flowRate,
              tokenSymbol,
              startDate,
              endDate,
              totalAmount,
              totalStreamed,
              status,
            };
          }),
        );

        setStreams(employerStreams);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load stream data";
        setError(message);
        setStreams([]);
      }
    },
    [options?.offset, options?.limit],
  );

  const refreshData = useCallback(async () => {
    await fetchVaultData();
    if (employerAddress) {
      await fetchStreams(employerAddress);
    }
  }, [fetchVaultData, fetchStreams, employerAddress]);

  useEffect(() => {
    if (!employerAddress) return;

    const WS_URL =
      import.meta.env.PUBLIC_BACKEND_URL || "http://localhost:3001";
    // Connect to WebSocket server using a dummy token or from localStorage if available
    const token = localStorage.getItem("auth_token") || "dummy";
    const socket = io(WS_URL, {
      path: "/socket.io",
      query: { token },
    });

    socket.on("connect", () => {
      console.log("[Payroll WS] Connected for real-time updates");
      if (employerAddress) socket.emit("subscribe:stream", employerAddress);
    });

    socket.on("stream:event", (event: unknown) => {
      console.log("[Payroll WS] Received real-time event:", event);
      refetch(); // Automatically update all streams
    });

    return () => {
      socket.disconnect();
    };
  }, [employerAddress, refetch]);

  useEffect(() => {
    if (!employerAddress) {
      setStreams([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Try to fetch real vault data
        await fetchVaultData();

        // Fetch real stream data from contract
        await fetchStreams(employerAddress);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load payroll data";
        setError(message);
        setStreams([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [employerAddress, fetchTick, fetchVaultData, fetchStreams]);

  const activeStreams = useMemo(
    () =>
      streams.filter(
        (stream) =>
          stream.status === "active" ||
          stream.status === "paused" ||
          stream.pendingAction !== undefined,
      ),
    [streams],
  );

  const activeStreamsCount = useMemo(
    () => streams.filter((stream) => stream.status === "active").length,
    [streams],
  );

  const applyOptimisticStreamStatus = useCallback(
    (
      streamId: string,
      status: Stream["status"],
      pendingAction: NonNullable<Stream["pendingAction"]>,
    ) => {
      setStreams((current) =>
        current.map((stream) =>
          stream.id === streamId
            ? { ...stream, status, pendingAction }
            : stream,
        ),
      );
    },
    [],
  );

  const restoreStream = useCallback((previous: Stream) => {
    setStreams((current) =>
      current.map((stream) => (stream.id === previous.id ? previous : stream)),
    );
  }, []);

  const clearStreamPending = useCallback((streamId: string) => {
    setStreams((current) =>
      current.map((stream) =>
        stream.id === streamId
          ? { ...stream, pendingAction: undefined }
          : stream,
      ),
    );
  }, []);

  return {
    treasuryBalances,
    totalLiabilities,
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
    applyOptimisticStreamStatus,
    restoreStream,
    clearStreamPending,
  };
};
