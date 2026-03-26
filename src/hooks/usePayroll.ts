import { useState, useEffect, useCallback } from "react";
import {
  getAllVaultData,
  type TokenVaultData,
} from "../contracts/payroll_vault";

export interface Stream {
  id: string;
  employeeName: string;
  employeeAddress: string;
  flowRate: string; // amount per second/block
  tokenSymbol: string;
  startDate: string;
  endDate: string;
  totalAmount: string;
  totalStreamed: string;
  status: "active" | "completed" | "cancelled";
}

export interface TokenBalance {
  tokenSymbol: string;
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

export const usePayroll = () => {
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

  const refreshData = useCallback(async () => {
    await fetchVaultData();
  }, [fetchVaultData]);

  useEffect(() => {
    // Simulate fetching data
    const fetchData = async () => {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Try to fetch real vault data
      await fetchVaultData();

      // Mock stream portfolio data (would come from contract in production)
      setStreams([
        {
          id: "1",
          employeeName: "Alice Smith",
          employeeAddress: "GBSH...234",
          flowRate: "0.0001",
          tokenSymbol: "USDC",
          startDate: "2023-10-01",
          endDate: "2024-10-01",
          totalAmount: "900.00",
          totalStreamed: "450.00",
          status: "active",
        },
        {
          id: "2",
          employeeName: "Bob Jones",
          employeeAddress: "GBYZ...789",
          flowRate: "0.0002",
          tokenSymbol: "XLM",
          startDate: "2023-10-15",
          endDate: "2024-09-15",
          totalAmount: "1200.00",
          totalStreamed: "900.00",
          status: "active",
        },
        {
          id: "3",
          employeeName: "Carol Diaz",
          employeeAddress: "GCRT...998",
          flowRate: "0.00005",
          tokenSymbol: "USDC",
          startDate: "2023-08-01",
          endDate: "2024-02-01",
          totalAmount: "650.00",
          totalStreamed: "650.00",
          status: "completed",
        },
        {
          id: "4",
          employeeName: "David Obi",
          employeeAddress: "GDVO...551",
          flowRate: "0.00008",
          tokenSymbol: "USDC",
          startDate: "2023-11-05",
          endDate: "2024-06-05",
          totalAmount: "700.00",
          totalStreamed: "280.00",
          status: "cancelled",
        },
      ]);

      setIsLoading(false);
    };

    void fetchData();
  }, [fetchVaultData]);

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
    refreshData,
    refreshVaultData: fetchVaultData,
  };
};
