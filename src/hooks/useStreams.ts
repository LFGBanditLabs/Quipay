import { useState, useEffect } from "react";

export interface WorkerStream {
  id: string;
  employerName: string;
  employerAddress: string;
  flowRate: number; // amount per second
  tokenSymbol: string;
  startTime: number; // unix timestamp in seconds
  totalAmount: number; // total allocated
  claimedAmount: number;
}

export interface WithdrawalRecord {
  id: string;
  amount: string;
  tokenSymbol: string;
  date: string;
  txHash: string;
}

export const useStreams = (workerAddress: string | undefined) => {
  const [streams, setStreams] = useState<WorkerStream[]>([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState<
    WithdrawalRecord[]
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!workerAddress) {
      setTimeout(() => {
        setStreams([]);
        setWithdrawalHistory([]);
        setIsLoading(false);
      }, 0);
      return;
    }

    // Simulate fetching data
    const fetchData = async () => {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock data for worker streams
      setStreams([
        {
          id: "1",
          employerName: "Tech Corp",
          employerAddress: "GAT...123",
          flowRate: 0.00005, // 0.00005 USDC per sec ~ 4.32 USDC/day
          tokenSymbol: "USDC",
          startTime: Math.floor(Date.now() / 1000) - 86400 * 5, // 5 days ago
          totalAmount: 1000,
          claimedAmount: 15,
        },
        {
          id: "2",
          employerName: "Web3 Solutions",
          employerAddress: "GBS...456",
          flowRate: 0.0002, // 0.0002 XLM per sec ~ 17.28 XLM/day
          tokenSymbol: "XLM",
          startTime: Math.floor(Date.now() / 1000) - 86400 * 2, // 2 days ago
          totalAmount: 5000,
          claimedAmount: 20,
        },
      ]);

      setWithdrawalHistory([
        {
          id: "w1",
          amount: "15.00",
          tokenSymbol: "USDC",
          date: "2023-10-25 14:30",
          txHash: "0x123...abc",
        },
        {
          id: "w2",
          amount: "20.00",
          tokenSymbol: "XLM",
          date: "2023-10-26 09:15",
          txHash: "0x456...def",
        },
      ]);

      setIsLoading(false);
    };

    void fetchData();
  }, [workerAddress]);

  return {
    streams,
    withdrawalHistory,
    isLoading,
  };
};
