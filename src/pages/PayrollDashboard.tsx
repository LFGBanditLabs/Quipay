import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useWallet } from "../hooks/useWallet";
import { usePayroll, Stream } from "../hooks/usePayroll";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STROOPS = 1e7;

function fmt(n: number, decimals = 2) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtRate(rateStr: string) {
  const ratePerSec = parseFloat(rateStr);
  const perMonth = ratePerSec * 86400 * 30;
  const perDay = ratePerSec * 86400;
  if (perMonth >= 1) return `${fmt(perMonth, 2)}/mo`;
  if (perDay >= 1) return `${fmt(perDay, 2)}/day`;
  return `${rateStr}/s`;
}

function streamPct(s: Stream): number {
  const total = parseFloat(s.totalAmount);
  const streamed = parseFloat(s.totalStreamed);
  if (!total) return 0;
  return Math.min(100, (streamed / total) * 100);
}

const STATUS_STYLE: Record<Stream["status"], { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-green-500/10 text-green-400" },
  paused: { label: "Paused", cls: "bg-yellow-400/10 text-yellow-400" },
  completed: { label: "Completed", cls: "bg-neutral-800 text-neutral-500" },
  cancelled: { label: "Cancelled", cls: "bg-red-500/10 text-red-400" },
};

const COLORS = [
  "#facc15",
  "#eab308",
  "#ca8a04",
  "#a16207",
  "#854d0e",
  "#713f12",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
        {label}
      </p>
      <p
        className="text-[28px] font-black leading-none"
        style={accent ? { color: "#facc15" } : { color: "#fff" }}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[12px] text-neutral-600">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PayrollDashboard() {
  const navigate = useNavigate();
  const { address } = useWallet();
  const { streams, vaultData, isLoading, error } = usePayroll(address);

  const activeStreams = streams.filter((s) => s.status === "active");
  const completedStreams = streams.filter((s) => s.status === "completed");
  const uniqueWorkers = new Set(streams.map((s) => s.employeeAddress)).size;

  const totalDisbursed = streams.reduce(
    (sum, s) => sum + parseFloat(s.totalStreamed || "0"),
    0,
  );
  const totalStreamValue = streams.reduce(
    (sum, s) => sum + parseFloat(s.totalAmount || "0"),
    0,
  );

  const allocationData = useMemo(
    () =>
      activeStreams.slice(0, 6).map((s) => ({
        name: shortAddr(s.employeeAddress),
        value: parseFloat(s.totalAmount || "0"),
      })),
    [activeStreams],
  );

  const rateBarData = useMemo(
    () =>
      activeStreams.slice(0, 8).map((s) => ({
        name: shortAddr(s.employeeAddress),
        rate: parseFloat(s.flowRate || "0") * 86400,
      })),
    [activeStreams],
  );

  // ── No wallet ─────────────────────────────────────────────────────────────
  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-400/20 bg-yellow-400/10">
          <svg
            className="h-8 w-8 text-yellow-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          </svg>
        </div>
        <h2 className="text-[20px] font-bold text-white mb-2">
          Connect your wallet
        </h2>
        <p className="text-[14px] text-neutral-500">
          Connect to view your payroll dashboard.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-6 py-8 sm:px-8 sm:py-10">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-xl bg-white/[0.06]" />
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
        <p className="text-[18px] font-bold text-white mb-2">
          Failed to load payroll data
        </p>
        <p className="font-mono text-[12px] text-neutral-600">{error}</p>
      </div>
    );
  }

  // ── No streams ────────────────────────────────────────────────────────────
  if (streams.length === 0) {
    return (
      <div className="px-6 py-8 sm:px-8 sm:py-10">
        <div className="mb-8">
          <h1 className="text-[24px] font-bold text-white tracking-tight">
            Payroll
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            Live data from the Stellar testnet blockchain.
          </p>
        </div>
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0a0a0a] p-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.04]">
            <svg
              className="h-7 w-7 text-neutral-700"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path
                d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="text-[16px] font-bold text-white mb-1">
            No streams yet
          </p>
          <p className="text-[13px] text-neutral-600 mb-5">
            Create payment streams for your workers to see live payroll data
            here.
          </p>
          <button
            onClick={() => void navigate("/create-stream")}
            className="rounded-xl px-6 py-3 text-[14px] font-bold text-black transition-all hover:opacity-90"
            style={{ backgroundColor: "#facc15" }}
          >
            Create First Stream
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 sm:px-8 sm:py-10">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold text-white tracking-tight">
            Payroll
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            Live data from the Stellar testnet blockchain.
          </p>
        </div>
        <button
          onClick={() => void navigate("/create-stream")}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-black transition-all hover:opacity-90"
          style={{ backgroundColor: "#facc15" }}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Stream
        </button>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active Streams" value={activeStreams.length} accent />
        <StatCard label="Active Workers" value={uniqueWorkers} />
        <StatCard
          label="Total Streaming"
          value={fmt(totalStreamValue)}
          sub="across all streams"
        />
        <StatCard
          label="Total Disbursed"
          value={fmt(totalDisbursed)}
          sub="streamed so far"
        />
      </div>

      {/* Treasury */}
      {vaultData.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {vaultData.map((v) => {
            const bal = Number(v.balance ?? 0) / STROOPS;
            const liab = Number(v.liability ?? 0) / STROOPS;
            const avail = Math.max(0, bal - liab);
            const pct = bal > 0 ? Math.min(100, (liab / bal) * 100) : 0;
            return (
              <div
                key={v.tokenSymbol}
                className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[13px] font-bold text-white">
                    Treasury · {v.tokenSymbol}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pct > 80 ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}
                  >
                    {pct > 80 ? "Low" : "Solvent"}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Balance</span>
                    <span className="font-bold text-white">{fmt(bal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Liability</span>
                    <span className="font-bold text-red-400">{fmt(liab)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Available</span>
                    <span className="font-bold" style={{ color: "#facc15" }}>
                      {fmt(avail)}
                    </span>
                  </div>
                  <div className="mt-2 h-[3px] w-full rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: pct > 80 ? "#ef4444" : "#facc15",
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-neutral-700">
                    {pct.toFixed(1)}% committed
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Charts */}
      {(allocationData.length > 0 || rateBarData.length > 0) && (
        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {allocationData.length > 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
              <p className="mb-4 text-[13px] font-bold text-white">
                Worker Allocation
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={allocationData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    strokeWidth={0}
                    paddingAngle={2}
                  >
                    {allocationData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#111",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v) => [fmt(v as number), "Amount"]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => (
                      <span style={{ color: "#737373", fontSize: 11 }}>
                        {v}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {rateBarData.length > 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
              <p className="mb-4 text-[13px] font-bold text-white">
                Daily Streaming Rate per Worker
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={rateBarData}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#525252", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#525252", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#111",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v) => [fmt(v as number), "Per day"]}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  />
                  <Bar
                    dataKey="rate"
                    radius={[4, 4, 0, 0]}
                    fill="#facc15"
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Streams table */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <p className="text-[14px] font-bold text-white">
            All Streams
            <span className="ml-2 text-[12px] font-normal text-neutral-600">
              ({streams.length})
            </span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {[
                  "Worker",
                  "Token",
                  "Rate",
                  "Streamed",
                  "Total",
                  "Progress",
                  "Status",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {streams.map((s, i) => {
                const pct = streamPct(s);
                const style = STATUS_STYLE[s.status] ?? STATUS_STYLE.active;
                return (
                  <tr
                    key={i}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-black"
                          style={{ backgroundColor: "#facc15" }}
                        >
                          {s.employeeAddress.slice(1, 3).toUpperCase()}
                        </div>
                        <span className="font-mono text-[12px] text-neutral-400">
                          {shortAddr(s.employeeAddress)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-white">
                      {s.tokenSymbol}
                    </td>
                    <td className="px-5 py-3.5 text-neutral-400">
                      {fmtRate(s.flowRate)}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-white">
                      {fmt(parseFloat(s.totalStreamed))}
                    </td>
                    <td className="px-5 py-3.5 text-neutral-500">
                      {fmt(parseFloat(s.totalAmount))}
                    </td>
                    <td className="px-5 py-3.5 min-w-[110px]">
                      <div className="flex items-center gap-2">
                        <div className="h-[3px] flex-1 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: "#facc15",
                            }}
                          />
                        </div>
                        <span className="w-8 text-right text-[10px] text-neutral-700">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.cls}`}
                      >
                        {style.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Completed summary */}
      {completedStreams.length > 0 && (
        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-white/[0.05] bg-[#0a0a0a] px-5 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-800">
            <svg
              className="h-4 w-4 text-neutral-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-[13px] text-neutral-500">
            <span className="font-semibold text-neutral-400">
              {completedStreams.length}
            </span>{" "}
            completed stream{completedStreams.length > 1 ? "s" : ""} ·{" "}
            <span className="font-semibold text-neutral-400">
              {fmt(
                completedStreams.reduce(
                  (s, x) => s + parseFloat(x.totalStreamed),
                  0,
                ),
              )}
            </span>{" "}
            total paid out
          </p>
        </div>
      )}
    </div>
  );
}
