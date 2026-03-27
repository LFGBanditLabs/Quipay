import { useEffect, useMemo, useState } from "react";
import { useTransactionData } from "./useTransactionData";

const MONTHS = ["January 2026", "February 2026", "March 2026"];
const LABELS = ["Jan", "Feb", "Mar"];

export function useAnalyticsData() {
  const { allTransactions } = useTransactionData();
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLastUpdatedAt(new Date());
    }, 15_000);

    return () => window.clearInterval(interval);
  }, []);

  const payrollTrend = useMemo(
    () =>
      MONTHS.map((_, i) => {
        const txs = allTransactions.filter((tx) => {
          const d = new Date(tx.date);
          return d.getMonth() === i && d.getFullYear() === 2026;
        });
        return {
          month: LABELS[i],
          completed: txs
            .filter((t) => t.status === "completed")
            .reduce((s, t) => s + t.amount, 0),
          failed: txs
            .filter((t) => t.status === "failed")
            .reduce((s, t) => s + t.amount, 0),
        };
      }),
    [allTransactions],
  );

  const topEmployees = useMemo(
    () =>
      Array.from(new Set(allTransactions.map((t) => t.employeeName)))
        .slice(0, 5)
        .map((n) => n.split(" ")[0]),
    [allTransactions],
  );

  const earningsTrend = useMemo(
    () =>
      MONTHS.map((_, i) => {
        const txs = allTransactions.filter((tx) => {
          const d = new Date(tx.date);
          return (
            d.getMonth() === i &&
            d.getFullYear() === 2026 &&
            tx.status === "completed"
          );
        });
        const point: Record<string, string | number> = { month: LABELS[i] };
        topEmployees.forEach((short) => {
          const tx = txs.find((t) => t.employeeName.startsWith(short));
          point[short] = tx?.amount ?? 0;
        });
        return point;
      }),
    [allTransactions, topEmployees],
  );

  const treasuryHistory = useMemo(() => {
    const initialBalance = 200_000;

    return MONTHS.reduce<
      Array<{ month: string; balance: number; payouts: number }>
    >((history, _, i) => {
      const payouts = allTransactions
        .filter((tx) => {
          const d = new Date(tx.date);
          return (
            d.getMonth() === i &&
            d.getFullYear() === 2026 &&
            tx.status === "completed"
          );
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      const previousBalance =
        history[history.length - 1]?.balance ?? initialBalance;
      const nextBalance = Math.max(previousBalance - payouts, 0);

      history.push({
        month: LABELS[i],
        balance: nextBalance,
        payouts,
      });

      return history;
    }, []);
  }, [allTransactions]);

  const streamStatus = useMemo(
    () => [
      {
        name: "Completed",
        value: allTransactions.filter((t) => t.status === "completed").length,
      },
      {
        name: "Pending",
        value: allTransactions.filter((t) => t.status === "pending").length,
      },
      {
        name: "Failed",
        value: allTransactions.filter((t) => t.status === "failed").length,
      },
    ],
    [allTransactions],
  );

  const kpis = useMemo(() => {
    const totalDisbursed = allTransactions
      .filter((t) => t.status === "completed")
      .reduce((s, t) => s + t.amount, 0);
    const workers = new Set(allTransactions.map((t) => t.employeeId)).size;
    const avgMonthly =
      payrollTrend.reduce((s, m) => s + m.completed, 0) / MONTHS.length;
    const treasury = treasuryHistory[treasuryHistory.length - 1]?.balance ?? 0;
    return { totalDisbursed, workers, avgMonthly, treasury };
  }, [allTransactions, payrollTrend, treasuryHistory]);

  return {
    payrollTrend,
    earningsTrend,
    topEmployees,
    treasuryHistory,
    streamStatus,
    kpis,
    lastUpdatedAt,
    refreshIntervalMs: 15_000,
  };
}
