import { useState, useEffect } from "react";
import { useWallet } from "./useWallet";
import {
  getStreamsByEmployer,
  getStream,
  getVaultBalance,
  getVaultLiability,
} from "../contracts/payroll_stream";

const SUPPORTED_TOKENS: {
  label: string;
  value: string;
  decimal: number;
  symbol: string;
}[] = [
  { label: "XLM (Native)", value: "native", decimal: 7, symbol: "XLM" },
  {
    label: "USDC",
    value: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    decimal: 7,
    symbol: "USDC",
  },
];

const PAYROLL_VAULT_CONTRACT_ID: string =
  (import.meta.env.VITE_PAYROLL_VAULT_CONTRACT_ID as string | undefined) ?? "";

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

export const usePayroll = (offset: number = 0, limit: number = 100) => {
  const { address } = useWallet();
  const [treasuryBalances, setTreasuryBalances] = useState<TokenBalance[]>([]);
  const [totalLiabilities, setTotalLiabilities] = useState<string>("0");
  const [activeStreams, setActiveStreams] = useState<Stream[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!address) {
      setTimeout(() => {
        setTreasuryBalances([]);
        setTotalLiabilities("0");
        setActiveStreams([]);
        setIsLoading(false);
      }, 0);
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      setIsLoading(true);

      try {
        // Fetch treasury balances and liabilities
        const newBalances: TokenBalance[] = [];
        const liabilityStrings: string[] = [];

        for (const token of SUPPORTED_TOKENS) {
          try {
            const tokenContractId =
              token.value === "native" ? "" : token.value.split(":")[1] || "";
            const balStroops = await getVaultBalance(
              PAYROLL_VAULT_CONTRACT_ID,
              tokenContractId,
              address,
            );
            const liabStroops = await getVaultLiability(
              PAYROLL_VAULT_CONTRACT_ID,
              tokenContractId,
              address,
            );

            const bal = Number(balStroops) / Math.pow(10, token.decimal);
            const liab = Number(liabStroops) / Math.pow(10, token.decimal);

            newBalances.push({
              tokenSymbol: token.symbol,
              balance: bal.toFixed(2),
            });

            if (liab > 0) {
              liabilityStrings.push(`${liab.toFixed(2)} ${token.symbol}`);
            }
          } catch (err) {
            console.error(
              `Error fetching vault data for ${token.symbol}:`,
              err,
            );
          }
        }

        if (!isMounted) return;

        setTreasuryBalances(newBalances);
        setTotalLiabilities(
          liabilityStrings.length ? liabilityStrings.join(" + ") : "0",
        );

        // Fetch streams
        const streamIds = await getStreamsByEmployer(address, offset, limit);
        const parsedStreams: Stream[] = [];

        for (const id of streamIds) {
          try {
            const scvalObject = await getStream(id, address);
            if (!scvalObject) continue;

            let workerAddr = "Unknown";
            let rateNum = 0;
            let startTs = 0;
            let tokenAddr = "";
            let withdrawn = 0;

            if (Array.isArray(scvalObject)) {
              workerAddr = scvalObject[1] || "Unknown";
              tokenAddr = scvalObject[2] || "";
              rateNum = Number(scvalObject[3] || 0);
              startTs = Number(scvalObject[5] || 0);
              withdrawn = Number(scvalObject[8] || 0);
            } else if (typeof scvalObject === "object") {
              workerAddr = scvalObject.worker || "Unknown";
              tokenAddr = scvalObject.token || "";
              rateNum = Number(scvalObject.rate || 0);
              startTs = Number(scvalObject.start_ts || 0);
              withdrawn = Number(scvalObject.withdrawn_amount || 0);
            }

            const tokenDef =
              SUPPORTED_TOKENS.find((t) => t.value.includes(tokenAddr)) ||
              SUPPORTED_TOKENS[0];
            const flowRateHr = (
              rateNum / Math.pow(10, tokenDef.decimal)
            ).toFixed(6);
            const withdrawnHr = (
              withdrawn / Math.pow(10, tokenDef.decimal)
            ).toFixed(2);

            parsedStreams.push({
              id: id.toString(),
              employeeName: `Worker ${workerAddr.substring(0, 4)}...`,
              employeeAddress: workerAddr,
              flowRate: flowRateHr,
              tokenSymbol: tokenDef.symbol,
              startDate: new Date(startTs * 1000).toISOString().split("T")[0],
              totalStreamed: withdrawnHr,
            });
          } catch (streamErr) {
            console.error(`Error fetching stream ${id}:`, streamErr);
          }
        }

        if (!isMounted) return;
        setActiveStreams(parsedStreams);
      } catch (err) {
        console.error("Error fetching payroll data:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void fetchData();

    return () => {
      isMounted = false;
    };
  }, [address, offset, limit]);

  return {
    treasuryBalances,
    totalLiabilities,
    activeStreamsCount: activeStreams.length,
    activeStreams,
    isLoading,
  };
};
