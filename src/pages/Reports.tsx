import { useMemo, useState } from "react";
import { usePayroll } from "../hooks/usePayroll";
import { useWallet } from "../hooks/useWallet";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STROOPS = 1e7;
const YELLOW = "#facc15";

function fmt(n: number, d = 2) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}
function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
function fmtDate(ts: string) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type Tab = "streams" | "workers" | "summary";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Reports() {
  const { address } = useWallet();
  const { streams, vaultData, isLoading } = usePayroll(address);
  const [tab, setTab] = useState<Tab>("streams");

  // ── Derived data ───────────────────────────────────────────────────────────

  const activeStreams = useMemo(
    () => streams.filter((s) => s.status === "active"),
    [streams],
  );
  const completedStreams = useMemo(
    () => streams.filter((s) => s.status === "completed"),
    [streams],
  );
  const cancelledStreams = useMemo(
    () => streams.filter((s) => s.status === "cancelled"),
    [streams],
  );

  const totalDisbursed = useMemo(
    () => streams.reduce((s, x) => s + parseFloat(x.totalStreamed || "0"), 0),
    [streams],
  );
  const totalValue = useMemo(
    () => streams.reduce((s, x) => s + parseFloat(x.totalAmount || "0"), 0),
    [streams],
  );

  // Per-worker summary
  const workerSummary = useMemo(() => {
    const map = new Map<
      string,
      { addr: string; earned: number; streams: number; tokens: Set<string> }
    >();
    streams.forEach((s) => {
      const ex = map.get(s.employeeAddress) ?? {
        addr: s.employeeAddress,
        earned: 0,
        streams: 0,
        tokens: new Set<string>(),
      };
      ex.earned += parseFloat(s.totalStreamed || "0");
      ex.streams += 1;
      ex.tokens.add(s.tokenSymbol);
      map.set(s.employeeAddress, ex);
    });
    return Array.from(map.values()).sort((a, b) => b.earned - a.earned);
  }, [streams]);

  // Token breakdown
  const tokenBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    streams.forEach((s) =>
      map.set(
        s.tokenSymbol,
        (map.get(s.tokenSymbol) ?? 0) + parseFloat(s.totalAmount || "0"),
      ),
    );
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [streams]);

  // Status pie
  const statusPie = useMemo(
    () =>
      [
        { name: "Active", value: activeStreams.length, fill: "#22c55e" },
        { name: "Completed", value: completedStreams.length, fill: YELLOW },
        { name: "Cancelled", value: cancelledStreams.length, fill: "#ef4444" },
      ].filter((d) => d.value > 0),
    [activeStreams, completedStreams, cancelledStreams],
  );

  // Vault summary
  const vaultSummary = useMemo(
    () =>
      vaultData.map((v) => ({
        token: v.tokenSymbol,
        balance: Number(v.balance ?? 0) / STROOPS,
        liability: Number(v.liability ?? 0) / STROOPS,
        available: Number(v.available ?? 0) / STROOPS,
      })),
    [vaultData],
  );

  // ── Guards ─────────────────────────────────────────────────────────────────

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
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <h2 className="text-[20px] font-bold text-white mb-2">
          Connect your wallet
        </h2>
        <p className="text-[14px] text-neutral-500">
          Connect to view your payroll reports.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 sm:px-8 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-bold text-white tracking-tight">
          Reports
        </h1>
        <p className="mt-1 text-[14px] text-neutral-500">
          Payroll data from your Stellar testnet contracts.
        </p>
      </div>

      {/* Summary strip */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Streams", value: streams.length, accent: false },
          { label: "Active", value: activeStreams.length, accent: true },
          {
            label: "Total Streamed",
            value: fmt(totalDisbursed, 0),
            accent: false,
          },
          { label: "Total Value", value: fmt(totalValue, 0), accent: false },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-4"
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
              {label}
            </p>
            <p
              className="text-[26px] font-black"
              style={accent ? { color: YELLOW } : { color: "#fff" }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-1">
        {(
          [
            ["streams", "Streams"],
            ["workers", "Workers"],
            ["summary", "Summary"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-all ${
              tab === id ? "text-black" : "text-neutral-500 hover:text-white"
            }`}
            style={tab === id ? { backgroundColor: YELLOW } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
      ) : streams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0a0a0a] p-12 text-center">
          <p className="text-[15px] font-bold text-white mb-1">
            No streams yet
          </p>
          <p className="text-[13px] text-neutral-600">
            Create payment streams to see reports here.
          </p>
        </div>
      ) : (
        <>
          {/* ── Streams tab ── */}
          {tab === "streams" && (
            <div className="flex flex-col gap-6">
              {/* Charts row */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {statusPie.length > 0 && (
                  <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
                    <p className="mb-4 text-[13px] font-bold text-white">
                      Stream Status
                    </p>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={statusPie}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          strokeWidth={0}
                          paddingAngle={2}
                        >
                          {statusPie.map((d, i) => (
                            <Cell key={i} fill={d.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "#111",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 flex justify-center gap-4">
                      {statusPie.map((d) => (
                        <div key={d.name} className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: d.fill }}
                          />
                          <span className="text-[11px] text-neutral-500">
                            {d.name} ({d.value})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {tokenBreakdown.length > 0 && (
                  <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
                    <p className="mb-4 text-[13px] font-bold text-white">
                      Value by Token
                    </p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={tokenBreakdown}
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
                          tickFormatter={(v) => fmt(v as number, 0)}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#111",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                          formatter={(v) => [fmt(v as number), "Amount"]}
                          cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        />
                        <Bar
                          dataKey="value"
                          fill={YELLOW}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={60}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Streams table */}
              <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
                <div className="border-b border-white/[0.06] px-5 py-4">
                  <p className="text-[14px] font-bold text-white">
                    All Streams ({streams.length})
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-white/[0.05]">
                        {[
                          "Worker",
                          "Token",
                          "Total",
                          "Streamed",
                          "Rate",
                          "Start",
                          "End",
                          "Status",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {streams.map((s, i) => (
                        <tr
                          key={i}
                          className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[9px] font-black text-black"
                                style={{ backgroundColor: YELLOW }}
                              >
                                {s.employeeAddress.slice(1, 3).toUpperCase()}
                              </div>
                              <span className="font-mono text-[11px] text-neutral-400">
                                {shortAddr(s.employeeAddress)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-white">
                            {s.tokenSymbol}
                          </td>
                          <td className="px-4 py-3 text-white">
                            {fmt(parseFloat(s.totalAmount))}
                          </td>
                          <td
                            className="px-4 py-3 font-semibold"
                            style={{ color: YELLOW }}
                          >
                            {fmt(parseFloat(s.totalStreamed))}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-neutral-500">
                            {s.flowRate}/s
                          </td>
                          <td className="px-4 py-3 text-neutral-500">
                            {fmtDate(s.startDate)}
                          </td>
                          <td className="px-4 py-3 text-neutral-500">
                            {fmtDate(s.endDate)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                                s.status === "active"
                                  ? "bg-green-500/10 text-green-400"
                                  : s.status === "completed"
                                    ? "bg-neutral-800 text-neutral-500"
                                    : "bg-red-500/10 text-red-400"
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Workers tab ── */}
          {tab === "workers" && (
            <div className="flex flex-col gap-4">
              {workerSummary.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0a0a0a] p-10 text-center">
                  <p className="text-neutral-600">No worker data yet.</p>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
                    <p className="mb-4 text-[13px] font-bold text-white">
                      Earnings per Worker
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={workerSummary
                          .slice(0, 8)
                          .map((w) => ({
                            name: shortAddr(w.addr),
                            earned: w.earned,
                          }))}
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
                          tickFormatter={(v) => fmt(v as number, 0)}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#111",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                          formatter={(v) => [fmt(v as number), "Earned"]}
                          cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        />
                        <Bar
                          dataKey="earned"
                          fill={YELLOW}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
                    <div className="border-b border-white/[0.06] px-5 py-4">
                      <p className="text-[14px] font-bold text-white">
                        Worker Summary ({workerSummary.length})
                      </p>
                    </div>
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-white/[0.05]">
                          {[
                            "Rank",
                            "Worker",
                            "Streams",
                            "Total Earned",
                            "Tokens",
                            "Share",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {workerSummary.map((w, i) => {
                          const share =
                            totalDisbursed > 0
                              ? (w.earned / totalDisbursed) * 100
                              : 0;
                          return (
                            <tr
                              key={i}
                              className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                            >
                              <td className="px-5 py-3.5">
                                <span
                                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${i === 0 ? "text-black" : "bg-white/[0.05] text-neutral-600"}`}
                                  style={
                                    i === 0 ? { backgroundColor: YELLOW } : {}
                                  }
                                >
                                  {i + 1}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 font-mono text-[12px] text-neutral-400">
                                {shortAddr(w.addr)}
                              </td>
                              <td className="px-5 py-3.5 text-neutral-500">
                                {w.streams}
                              </td>
                              <td className="px-5 py-3.5 font-bold text-white">
                                {fmt(w.earned)}
                              </td>
                              <td className="px-5 py-3.5 text-neutral-500">
                                {Array.from(w.tokens).join(", ")}
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2">
                                  <div className="h-[3px] w-16 rounded-full bg-white/[0.06] overflow-hidden">
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${share}%`,
                                        backgroundColor: YELLOW,
                                      }}
                                    />
                                  </div>
                                  <span className="text-[11px] text-neutral-600">
                                    {share.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Summary tab ── */}
          {tab === "summary" && (
            <div className="flex flex-col gap-4">
              {/* Vault summary */}
              {vaultSummary.length > 0 && (
                <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
                  <div className="border-b border-white/[0.06] px-5 py-4">
                    <p className="text-[14px] font-bold text-white">
                      Vault Summary
                    </p>
                  </div>
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-white/[0.05]">
                        {[
                          "Token",
                          "Balance",
                          "Liability",
                          "Available",
                          "% Committed",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vaultSummary.map((v) => {
                        const pct =
                          v.balance > 0 ? (v.liability / v.balance) * 100 : 0;
                        return (
                          <tr
                            key={v.token}
                            className="border-b border-white/[0.04] last:border-0"
                          >
                            <td className="px-5 py-4 font-bold text-white">
                              {v.token}
                            </td>
                            <td className="px-5 py-4 text-white">
                              {fmt(v.balance)}
                            </td>
                            <td className="px-5 py-4 text-red-400">
                              {fmt(v.liability)}
                            </td>
                            <td
                              className="px-5 py-4 font-bold"
                              style={{ color: YELLOW }}
                            >
                              {fmt(v.available)}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <div className="h-[3px] w-20 rounded-full bg-white/[0.06] overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.min(100, pct)}%`,
                                      backgroundColor:
                                        pct > 80 ? "#ef4444" : YELLOW,
                                    }}
                                  />
                                </div>
                                <span
                                  className={`text-[11px] ${pct > 80 ? "text-red-400" : "text-neutral-600"}`}
                                >
                                  {pct.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Stream breakdown */}
              <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
                <p className="mb-4 text-[13px] font-bold text-white">
                  Payroll Summary
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[
                    { label: "Total Streams", value: streams.length },
                    { label: "Active", value: activeStreams.length },
                    { label: "Completed", value: completedStreams.length },
                    { label: "Cancelled", value: cancelledStreams.length },
                    { label: "Unique Workers", value: workerSummary.length },
                    { label: "Tokens Used", value: tokenBreakdown.length },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4"
                    >
                      <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
                        {label}
                      </p>
                      <p className="text-[22px] font-black text-white">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
