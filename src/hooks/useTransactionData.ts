/**
 * useTransactionData — provides realistic demo transaction data
 * for the reports feature. In production this would fetch from
 * on-chain Stellar events / a backend API.
 */

import { useMemo, useState } from "react";
import type {
  PayrollTransaction,
  MonthlySummary,
  ReportFilter,
} from "../types/reports";

/* ---------- Deterministic demo data ---------- */

const EMPLOYEES = [
  {
    name: "Alice Johnson",
    id: "EMP-001",
    wallet: "GDRQE6KQ...V4QH",
    dept: "Engineering",
  },
  {
    name: "Bob Williams",
    id: "EMP-002",
    wallet: "GBUD7I2Z...X9PL",
    dept: "Engineering",
  },
  {
    name: "Carol Martinez",
    id: "EMP-003",
    wallet: "GCS6KTP3...K7MN",
    dept: "Design",
  },
  {
    name: "Daniel Brown",
    id: "EMP-004",
    wallet: "GAHK7EEG...J2WR",
    dept: "Marketing",
  },
  {
    name: "Eve Davis",
    id: "EMP-005",
    wallet: "GCEZWKCA...Y6FH",
    dept: "Marketing",
  },
  {
    name: "Frank Wilson",
    id: "EMP-006",
    wallet: "GDVDKQFP...M3BT",
    dept: "Operations",
  },
  {
    name: "Grace Lee",
    id: "EMP-007",
    wallet: "GBTCBCWL...N8QS",
    dept: "Engineering",
  },
  {
    name: "Henry Taylor",
    id: "EMP-008",
    wallet: "GAIH3ULR...P5VD",
    dept: "Design",
  },
  {
    name: "Iris Anderson",
    id: "EMP-009",
    wallet: "GBH7WM56...R2KJ",
    dept: "Operations",
  },
  {
    name: "Jack Thomas",
    id: "EMP-010",
    wallet: "GCKFBEQ4...T7YA",
    dept: "Engineering",
  },
];

function generateTransactions(): PayrollTransaction[] {
  const txs: PayrollTransaction[] = [];
  const statuses: PayrollTransaction["status"][] = [
    "completed",
    "completed",
    "completed",
    "completed",
    "completed",
    "completed",
    "completed",
    "pending",
    "pending",
    "failed",
  ];

  const baseAmounts = [
    3500, 4200, 3800, 2900, 3100, 3600, 4500, 3300, 2800, 4000,
  ];

  for (let month = 0; month < 3; month++) {
    EMPLOYEES.forEach((emp, idx) => {
      const d = new Date(2026, month, 25 + (idx % 4));
      const status = statuses[(idx + month) % statuses.length];
      const amount = baseAmounts[idx] + month * 50;

      txs.push({
        id: `TXN-${String(2026)}${String(month + 1).padStart(2, "0")}-${String(idx + 1).padStart(3, "0")}`,
        date: d.toISOString(),
        employeeName: emp.name,
        employeeId: emp.id,
        walletAddress: emp.wallet,
        amount,
        currency: "USDC",
        txHash: `${Array.from({ length: 64 }, (_, i) => "0123456789abcdef"[(i + idx + month * 7) % 16]).join("")}`,
        status,
        description: `Salary payment – ${d.toLocaleString("en-US", { month: "long", year: "numeric" })}`,
      });
    });
  }

  return txs.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

function buildMonthlySummary(
  transactions: PayrollTransaction[],
  month: string,
): MonthlySummary {
  const completed = transactions.filter((t) => t.status === "completed");
  const amounts = transactions.map((t) => t.amount);

  // Group by department
  const deptMap = new Map<
    string,
    { totalAmount: number; employees: Set<string>; count: number }
  >();

  transactions.forEach((tx) => {
    const emp = EMPLOYEES.find((e) => e.id === tx.employeeId);
    const dept = emp?.dept ?? "Other";
    const existing = deptMap.get(dept) ?? {
      totalAmount: 0,
      employees: new Set<string>(),
      count: 0,
    };
    existing.totalAmount += tx.amount;
    existing.employees.add(tx.employeeId);
    existing.count += 1;
    deptMap.set(dept, existing);
  });

  return {
    month,
    totalPayroll: completed.reduce((s, t) => s + t.amount, 0),
    totalTransactions: transactions.length,
    completedTransactions: completed.length,
    pendingTransactions: transactions.filter((t) => t.status === "pending")
      .length,
    failedTransactions: transactions.filter((t) => t.status === "failed")
      .length,
    averagePayment:
      amounts.length > 0
        ? amounts.reduce((a, b) => a + b, 0) / amounts.length
        : 0,
    largestPayment: Math.max(...amounts, 0),
    smallestPayment: Math.min(...amounts, Infinity),
    currency: "USDC",
    breakdown: Array.from(deptMap.entries()).map(([department, data]) => ({
      department,
      totalAmount: data.totalAmount,
      employeeCount: data.employees.size,
      transactionCount: data.count,
    })),
  };
}

/* ---------- Hook ---------- */

export function useTransactionData() {
  const allTransactions = useMemo(() => generateTransactions(), []);

  const [filter, setFilter] = useState<ReportFilter>({
    status: "all",
  });

  const [selectedMonth, setSelectedMonth] = useState<string>("January 2026");

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      if (
        filter.status &&
        filter.status !== "all" &&
        tx.status !== filter.status
      )
        return false;
      if (filter.startDate && tx.date < filter.startDate) return false;
      if (filter.endDate && tx.date > filter.endDate) return false;
      if (filter.employeeId && tx.employeeId !== filter.employeeId)
        return false;
      return true;
    });
  }, [allTransactions, filter]);

  const monthlyTransactions = useMemo(() => {
    const monthMap: Record<string, number> = {
      "January 2026": 0,
      "February 2026": 1,
      "March 2026": 2,
    };
    const monthIdx = monthMap[selectedMonth] ?? 0;

    return allTransactions.filter((tx) => {
      const d = new Date(tx.date);
      return d.getMonth() === monthIdx && d.getFullYear() === 2026;
    });
  }, [allTransactions, selectedMonth]);

  const monthlySummary = useMemo(
    () => buildMonthlySummary(monthlyTransactions, selectedMonth),
    [monthlyTransactions, selectedMonth],
  );

  const availableMonths = ["January 2026", "February 2026", "March 2026"];

  return {
    allTransactions,
    filteredTransactions,
    monthlyTransactions,
    monthlySummary,
    filter,
    setFilter,
    selectedMonth,
    setSelectedMonth,
    availableMonths,
  };
}
