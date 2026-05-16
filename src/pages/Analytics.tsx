import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useWallet } from "../hooks/useWallet";
import { usePayroll } from "../hooks/usePayroll";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STROOPS = 1e7;
const YELLOW = "#facc15";
const COLORS = [YELLOW, "#eab308", "#ca8a04", "#a16207", "#854d0e"];

function fmt(n: number, d = 2) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(d)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

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
      <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-neutral-600">
        {label}
      </p>
      <p
        className="text-[26px] font-black leading-none"
        style={accent ? { color: YELLOW } : { color: "#fff" }}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[12px] text-neutral-600">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const { address } = useWallet();
  const { streams, vaultData, isLoading, error } = usePayroll(address);

  // ── Derived data ──────────────────────────────────────────────────────────

  const active = streams.filter((s) => s.status === "active");
  const completed = streams.filter((s) => s.status === "completed");
  const cancelled = streams.filter((s) => s.status === "cancelled");

  const totalStreamed = streams.reduce(
    (s, x) => s + parseFloat(x.totalStreamed || "0"),
    0,
  );
  const uniqueWorkers = new Set(streams.map((s) => s.employeeAddress)).size;

  // Status breakdown pie
  const statusData = useMemo(
    () =>
      [
        { name: "Active", value: active.length, fill: "#22c55e" },
        { name: "Completed", value: completed.length, fill: YELLOW },
        { name: "Cancelled", value: cancelled.length, fill: "#ef4444" },
      ].filter((d) => d.value > 0),
    [active.length, completed.length, cancelled.length],
  );

  // Per-worker earnings bar
  const workerData = useMemo(() => {
    const map = new Map<string, number>();
    streams.forEach((s) => {
      const addr = s.employeeAddress;
      map.set(addr, (map.get(addr) ?? 0) + parseFloat(s.totalStreamed || "0"));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([addr, earned]) => ({ name: shortAddr(addr), earned }));
  }, [streams]);

  // Token distribution
  const tokenData = useMemo(() => {
    const map = new Map<string, number>();
    streams.forEach((s) => {
      map.set(
        s.tokenSymbol,
        (map.get(s.tokenSymbol) ?? 0) + parseFloat(s.totalAmount || "0"),
      );
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [streams]);

  // Vault treasury overview
  const vaultRows = vaultData.map((v) => ({
    token: v.tokenSymbol,
    balance: Number(v.balance ?? 0) / STROOPS,
    liability: Number(v.liability ?? 0) / STROOPS,
    available: Math.max(
      0,
      Number(v.balance ?? 0) / STROOPS - Number(v.liability ?? 0) / STROOPS,
    ),
  }));

  // ── Guards ────────────────────────────────────────────────────────────────

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
          Connect to view your analytics.
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
          Failed to load analytics
        </p>
        <p className="font-mono text-[12px] text-neutral-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 sm:px-8 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-bold text-white tracking-tight">
          Analytics
        </h1>
        <p className="mt-1 text-[14px] text-neutral-500">
          Live data from your Stellar testnet contracts.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Streams" value={streams.length} accent />
        <StatCard label="Active Streams" value={active.length} />
        <StatCard label="Unique Workers" value={uniqueWorkers} />
        <StatCard
          label="Total Streamed"
          value={fmt(totalStreamed, 0)}
          sub="in token units"
        />
      </div>

      {/* Vault overview */}
      {vaultRows.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {vaultRows.map((v) => (
            <div
              key={v.token}
              className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5"
            >
              <p className="mb-3 text-[13px] font-bold text-white">
                Vault · {v.token}
              </p>
              <div className="flex flex-col gap-1.5 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Balance</span>
                  <span className="font-bold text-white">{fmt(v.balance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Liability</span>
                  <span className="font-bold text-red-400">
                    {fmt(v.liability)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Available</span>
                  <span className="font-bold" style={{ color: YELLOW }}>
                    {fmt(v.available)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {streams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0a0a0a] p-12 text-center">
          <p className="text-[15px] font-bold text-white mb-1">
            No stream data yet
          </p>
          <p className="text-[13px] text-neutral-600">
            Create streams to see analytics here.
          </p>
        </div>
      ) : (
        <>
          {/* Charts row */}
          <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Status breakdown */}
            {statusData.length > 0 && (
              <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
                <p className="mb-4 text-[13px] font-bold text-white">
                  Stream Status
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      strokeWidth={0}
                      paddingAngle={3}
                    >
                      {statusData.map((d, i) => (
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
                      formatter={(v) => [v as number, ""]}
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

            {/* Token distribution */}
            {tokenData.length > 0 && (
              <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
                <p className="mb-4 text-[13px] font-bold text-white">
                  Token Distribution
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={tokenData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      strokeWidth={0}
                      paddingAngle={3}
                    >
                      {tokenData.map((_, i) => (
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
                      formatter={(v) => [fmt(v as number), "Total value"]}
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
          </div>

          {/* Worker earnings bar */}
          {workerData.length > 0 && (
            <div className="mb-8 rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
              <p className="mb-4 text-[13px] font-bold text-white">
                Earnings per Worker
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={workerData}
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
                    tickFormatter={(v) => fmt(v, 0)}
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
                    radius={[4, 4, 0, 0]}
                    fill={YELLOW}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Worker leaderboard */}
          {workerData.length > 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
              <div className="border-b border-white/[0.06] px-5 py-4">
                <p className="text-[14px] font-bold text-white">
                  Worker Leaderboard
                </p>
              </div>
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    {["Rank", "Worker", "Streams", "Total Earned", "Share"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {workerData.map((w, i) => {
                    const share =
                      totalStreamed > 0 ? (w.earned / totalStreamed) * 100 : 0;
                    const workerStreams = streams.filter(
                      (s) => shortAddr(s.employeeAddress) === w.name,
                    );
                    return (
                      <tr
                        key={i}
                        className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${i === 0 ? "text-black" : "text-neutral-600 bg-white/[0.05]"}`}
                            style={i === 0 ? { backgroundColor: YELLOW } : {}}
                          >
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-black"
                              style={{ backgroundColor: YELLOW }}
                            >
                              {w.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-mono text-[12px] text-neutral-400">
                              {w.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-neutral-500">
                          {workerStreams.length}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-white">
                          {fmt(w.earned)}
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
          )}
        </>
      )}
    </div>
  );
}
