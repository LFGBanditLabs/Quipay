import { useState, useEffect, useCallback } from "react";
import {
  getAllVaultData,
  type TokenVaultData,
} from "../contracts/payroll_vault";
import {
  getStreamsByEmployer,
  getStreamById,
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
  status: "active" | "completed" | "cancelled";
}

/** Token balance as reported by the PayrollVault contract. */
export interface TokenBalance {
  /** Token symbol, e.g. `"USDC"` or `"XLM"`. */
  tokenSymbol: string;
  /** Available balance as a plain string (raw bigint value from the contract). */
  balance: string;
}

// Default tokens to monitor (XLM and USDC)
const DEFAULT_TOKENS: Array<{
  token: string;
  tokenSymbol: string;
  monthlyBurnRate: bigint;
}> = [
  { token: "", tokenSymbol: "XLM", monthlyBurnRate: BigInt(0) },
  {
    token: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", // USDC testnet
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
        const streamIds = await getStreamsByEmployer(
          address,
          options?.offset,
          options?.limit,
        );

        const streamResults = await Promise.all(
          streamIds.map((id) => getStreamById(address, id)),
        );

        const employerStreams: Stream[] = await Promise.all(
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
              const tokenSymbol = await getTokenSymbol(address, s.token);

              // Convert bigint values to strings for display
              const flowRate = (Number(s.rate) / STROOPS_PER_UNIT).toFixed(7);
              const totalAmount = (
                Number(s.total_amount) / STROOPS_PER_UNIT
              ).toFixed(2);
              const totalStreamed = (
                Number(s.withdrawn_amount) / STROOPS_PER_UNIT
              ).toFixed(2);

              // Convert timestamps to date strings
              const startDate = new Date(Number(s.start_ts) * 1000)
                .toISOString()
                .split("T")[0];
              const endDate = new Date(Number(s.end_ts) * 1000)
                .toISOString()
                .split("T")[0];

              // Map status numbers to strings
              let status: "active" | "completed" | "cancelled";
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
                default:
                  status = "active";
              }

              return {
                id: streamId,
                employeeName: `Worker ${streamId.slice(0, 8)}`, // Placeholder name
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

  const activeStreams = streams.filter((stream) => stream.status === "active");

  return {
    treasuryBalances,
    totalLiabilities,
    activeStreamsCount: activeStreams.length,
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
