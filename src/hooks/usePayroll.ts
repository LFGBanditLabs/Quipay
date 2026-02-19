import { useState, useEffect } from "react";

export interface Stream {
  id: string;
  employeeName: string;
  employeeAddress: string;
  flowRate: string; // amount per second/block
  tokenSymbol: string;
  startDate: string;
  totalStreamed: string;
}

export interface TokenBalance {
  tokenSymbol: string;
  balance: string;
}

export const usePayroll = () => {
  const [treasuryBalances, setTreasuryBalances] = useState<TokenBalance[]>([]);
  const [totalLiabilities, setTotalLiabilities] = useState<string>("0");
  const [activeStreams, setActiveStreams] = useState<Stream[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Simulate fetching data
    const fetchData = async () => {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock data
      setTreasuryBalances([
        { tokenSymbol: "XLM", balance: "10000.00" },
        { tokenSymbol: "USDC", balance: "5000.00" },
      ]);

      setTotalLiabilities("1200.00 USDC"); // Simplified for now

      setActiveStreams([
        {
          id: "1",
          employeeName: "Alice Smith",
          employeeAddress: "GBSH...234",
          flowRate: "0.0001",
          tokenSymbol: "USDC",
          startDate: "2023-10-01",
          totalStreamed: "450.00",
        },
        {
          id: "2",
          employeeName: "Bob Jones",
          employeeAddress: "GBYZ...789",
          flowRate: "0.0002",
          tokenSymbol: "XLM",
          startDate: "2023-10-15",
          totalStreamed: "900.00",
        },
      ]);

      setIsLoading(false);
    };

    fetchData();
  }, []);

  return {
    treasuryBalances,
    totalLiabilities,
    activeStreamsCount: activeStreams.length,
    activeStreams,
    isLoading,
  };
};
