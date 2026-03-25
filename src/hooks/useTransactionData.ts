/**
 * useTransactionData — provides payroll transaction data for the reports feature.
 *
 * When a wallet is connected, fetches real stream data from the backend API
 * (GET /analytics/streams?employer={address}). Falls back to deterministic
 * demo data when no address is available (useful for local dev / previews).
 */

import { useMemo, useState, useEffect } from "react";
import { useWallet } from "./useWallet";
import type {
  PayrollTransaction,
  MonthlySummary,
  ReportFilter,
} from "../types/reports";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

/** Stellar amounts are stored in stroops (1 XLM = 10,000,000 stroops). */
const STROOPS_PER_UNIT = 1e7;

/* ------------------------------------------------------------------ */
/*  Backend response shape                                            */
/* ------------------------------------------------------------------ */

interface StreamApiRecord {
  stream_id: number;
  employer: string;
  worker: string;
  total_amount: string;
  start_ts: number;
  end_ts: number;
  status: "active" | "completed" | "cancelled";
  ledger_created: number;
}

/* ------------------------------------------------------------------ */
/*  Mapping helpers                                                   */
/* ------------------------------------------------------------------ */

function mapStreamToTransaction(s: StreamApiRecord): PayrollTransaction {
  const startDate = new Date(s.start_ts * 1000);
  const endDate = new Date(s.end_ts * 1000);

  const statusMap: Record<string, PayrollTransaction["status"]> = {
    active: "pending",
    completed: "completed",
    cancelled: "failed",
  };

  const shortWorker = `${s.worker.slice(0, 6)}…${s.worker.slice(-4)}`;
  const workerId = `WKR-${s.worker.slice(-6).toUpperCase()}`;

  return {
    id: `STRM-${s.stream_id}`,
    date: startDate.toISOString(),
    employeeName: shortWorker,
    employeeId: workerId,
    walletAddress: s.worker,
    amount: parseFloat(s.total_amount) / STROOPS_PER_UNIT,
    currency: "XLM",
    txHash: String(s.ledger_created).padStart(64, "0"),
    status: statusMap[s.status] ?? "pending",
    description: `Stream #${s.stream_id} · ${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
  };
}

function monthLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Monthly summary builder                                           */
/* ------------------------------------------------------------------ */

function buildMonthlySummary(
  transactions: PayrollTransaction[],
  month: string,
): MonthlySummary {
  const completed = transactions.filter((t) => t.status === "completed");
  const amounts = transactions.map((t) => t.amount);

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
    smallestPayment: amounts.length > 0 ? Math.min(...amounts) : 0,
    currency: transactions[0]?.currency ?? "XLM",
    breakdown: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Demo data (used when no wallet is connected)                     */
/* ------------------------------------------------------------------ */

const DEMO_EMPLOYEES = [
  { name: "Alice Johnson", id: "EMP-001", wallet: "GDRQE6KQ...V4QH" },
  { name: "Bob Williams", id: "EMP-002", wallet: "GBUD7I2Z...X9PL" },
  { name: "Carol Martinez", id: "EMP-003", wallet: "GCS6KTP3...K7MN" },
  { name: "Daniel Brown", id: "EMP-004", wallet: "GAHK7EEG...J2WR" },
  { name: "Eve Davis", id: "EMP-005", wallet: "GCEZWKCA...Y6FH" },
];

function generateDemoTransactions(): PayrollTransaction[] {
  const statuses: PayrollTransaction["status"][] = [
    "completed",
    "completed",
    "completed",
    "pending",
    "failed",
  ];
  const baseAmounts = [3500, 4200, 3800, 2900, 3100];
  const txs: PayrollTransaction[] = [];

  for (let month = 0; month < 3; month++) {
    DEMO_EMPLOYEES.forEach((emp, idx) => {
      const d = new Date(2026, month, 25 + (idx % 4));
      txs.push({
        id: `TXN-2026${String(month + 1).padStart(2, "0")}-${String(idx + 1).padStart(3, "0")}`,
        date: d.toISOString(),
        employeeName: emp.name,
        employeeId: emp.id,
        walletAddress: emp.wallet,
        amount: baseAmounts[idx] + month * 50,
        currency: "USDC",
        txHash: Array.from(
          { length: 64 },
          (_, i) => "0123456789abcdef"[(i + idx + month * 7) % 16],
        ).join(""),
        status: statuses[(idx + month) % statuses.length],
        description: `Salary payment – ${d.toLocaleString("en-US", { month: "long", year: "numeric" })}`,
      });
    });
  }

  return txs.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useTransactionData() {
  const { address } = useWallet();

  const [allTransactions, setAllTransactions] = useState<PayrollTransaction[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<ReportFilter>({ status: "all" });
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  useEffect(() => {
    if (!address) {
      setAllTransactions(generateDemoTransactions());
      return;
    }

    async function fetchStreams() {
      setLoading(true);
      try {
        const url = `${API_BASE}/analytics/streams?employer=${encodeURIComponent(address!)}&limit=200`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          ok: boolean;
          data?: StreamApiRecord[];
        };
        if (json.ok && Array.isArray(json.data)) {
          setAllTransactions(json.data.map(mapStreamToTransaction));
        }
      } catch {
        // Backend unavailable — fall through to empty state
        setAllTransactions([]);
      } finally {
        setLoading(false);
      }
    }

    void fetchStreams();
  }, [address]);

  const availableMonths = useMemo(() => {
    const seen = new Set<string>();
    const months: string[] = [];
    for (const tx of allTransactions) {
      const label = monthLabel(tx.date);
      if (!seen.has(label)) {
        seen.add(label);
        months.push(label);
      }
    }
    return months.sort((a, b) =>
      new Date(a) < new Date(b) ? -1 : new Date(a) > new Date(b) ? 1 : 0,
    );
  }, [allTransactions]);

  // Default to most recent available month
  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[availableMonths.length - 1]);
    }
  }, [availableMonths, selectedMonth]);

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
    return allTransactions.filter(
      (tx) => monthLabel(tx.date) === selectedMonth,
    );
  }, [allTransactions, selectedMonth]);

  const monthlySummary = useMemo(
    () => buildMonthlySummary(monthlyTransactions, selectedMonth),
    [monthlyTransactions, selectedMonth],
  );

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
    loading,
  };
}
