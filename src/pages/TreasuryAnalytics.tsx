import { useMemo } from "react";
import { useWallet } from "../hooks/useWallet";
import { usePayroll } from "../hooks/usePayroll";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
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

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
        {label}
      </p>
      <p
        className="text-[26px] font-black leading-none"
        style={{ color: color ?? "#fff" }}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[12px] text-neutral-600">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TreasuryAnalytics() {
  const { address } = useWallet();
  const { streams, vaultData, isLoading } = usePayroll(address);

  // ── Vault metrics ─────────────────────────────────────────────────────────

  const vaultMetrics = useMemo(
    () =>
      vaultData.map((v) => {
        const bal = Number(v.balance ?? 0) / STROOPS;
        const liab = Number(v.liability ?? 0) / STROOPS;
        const avail = Math.max(0, bal - liab);
        const pct = bal > 0 ? (liab / bal) * 100 : 0;

        // Burn rate = sum of all active stream rates × seconds per month
        const activeForToken = streams.filter(
          (s) => s.status === "active" && s.tokenSymbol === v.tokenSymbol,
        );
        const ratePerSec = activeForToken.reduce(
          (sum, s) => sum + parseFloat(s.flowRate || "0"),
          0,
        );
        const monthlyBurn = ratePerSec * 86400 * 30;

        // Runway in days
        const runwayDays =
          monthlyBurn > 0
            ? Math.floor(avail / (monthlyBurn / 30))
            : avail > 0
              ? 9999
              : 0;

        return {
          token: v.tokenSymbol,
          balance: bal,
          liability: liab,
          available: avail,
          pctCommitted: pct,
          ratePerSec,
          monthlyBurn,
          dailyBurn: ratePerSec * 86400,
          runwayDays,
        };
      }),
    [vaultData, streams],
  );

  // ── Stream value breakdown per token ──────────────────────────────────────

  const tokenBar = useMemo(() => {
    const map = new Map<string, { total: number; streamed: number }>();
    streams.forEach((s) => {
      const e = map.get(s.tokenSymbol) ?? { total: 0, streamed: 0 };
      e.total += parseFloat(s.totalAmount || "0");
      e.streamed += parseFloat(s.totalStreamed || "0");
      map.set(s.tokenSymbol, e);
    });
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }));
  }, [streams]);

  // ── Commitment health per token (for radial chart) ────────────────────────

  const commitmentData = useMemo(
    () =>
      vaultMetrics.map((v) => ({
        name: v.token,
        value: Math.min(100, v.pctCommitted),
        fill:
          v.pctCommitted > 85
            ? "#ef4444"
            : v.pctCommitted > 60
              ? YELLOW
              : "#22c55e",
      })),
    [vaultMetrics],
  );

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
        <h2 className="text-[20px] font-bold text-white mb-2">
          Connect your wallet
        </h2>
        <p className="text-[14px] text-neutral-500">
          Connect to view treasury analytics.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-6 py-8 sm:px-8 sm:py-10">
        <div className="mb-6 h-8 w-56 animate-pulse rounded-xl bg-white/[0.06]" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (vaultData.length === 0) {
    return (
      <div className="px-6 py-8 sm:px-8 sm:py-10">
        <div className="mb-8">
          <h1 className="text-[24px] font-bold text-white tracking-tight">
            Treasury Analytics
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            Deep insights into your payroll vault.
          </p>
        </div>
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0a0a0a] p-12 text-center">
          <p className="text-[15px] font-bold text-white mb-1">
            No treasury data
          </p>
          <p className="text-[13px] text-neutral-600">
            Deposit funds to your vault to see analytics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 sm:px-8 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-bold text-white tracking-tight">
          Treasury Analytics
        </h1>
        <p className="mt-1 text-[14px] text-neutral-500">
          Real-time vault health, burn rate, and runway from the Stellar
          testnet.
        </p>
      </div>

      {/* Per-token sections */}
      {vaultMetrics.map((v) => (
        <div key={v.token} className="mb-10">
          {/* Token header */}
          <div className="mb-5 flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[12px] font-black text-black"
              style={{ backgroundColor: YELLOW }}
            >
              {v.token.slice(0, 2)}
            </div>
            <div>
              <p className="text-[16px] font-bold text-white">{v.token}</p>
              <p className="text-[12px] text-neutral-600">Vault position</p>
            </div>
            <span
              className={`ml-auto rounded-full px-3 py-1 text-[11px] font-bold ${
                v.pctCommitted > 85
                  ? "bg-red-500/10 text-red-400"
                  : v.pctCommitted > 60
                    ? "bg-yellow-400/10 text-yellow-400"
                    : "bg-green-500/10 text-green-400"
              }`}
            >
              {v.pctCommitted > 85
                ? "⚠ Critical"
                : v.pctCommitted > 60
                  ? "Low runway"
                  : "✓ Healthy"}
            </span>
          </div>

          {/* KPI row */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Vault Balance"
              value={fmt(v.balance)}
              color={YELLOW}
            />
            <StatCard
              label="Stream Liability"
              value={fmt(v.liability)}
              color="#ef4444"
              sub="committed to streams"
            />
            <StatCard
              label="Available"
              value={fmt(v.available)}
              color="#22c55e"
              sub="can withdraw now"
            />
            <StatCard
              label="Runway"
              value={v.runwayDays >= 9999 ? "∞" : `${v.runwayDays}d`}
              color={
                v.runwayDays < 7
                  ? "#ef4444"
                  : v.runwayDays < 30
                    ? YELLOW
                    : "#22c55e"
              }
              sub={
                v.dailyBurn > 0
                  ? `${fmt(v.dailyBurn, 4)}/day burn`
                  : "no active streams"
              }
            />
          </div>

          {/* Commitment bar visual */}
          <div className="mb-5 rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-bold text-white">
                Vault commitment
              </p>
              <p
                className="text-[13px] font-bold"
                style={{ color: v.pctCommitted > 80 ? "#ef4444" : YELLOW }}
              >
                {v.pctCommitted.toFixed(1)}%
              </p>
            </div>
            <div className="h-4 w-full rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, v.pctCommitted)}%`,
                  backgroundColor:
                    v.pctCommitted > 85
                      ? "#ef4444"
                      : v.pctCommitted > 60
                        ? YELLOW
                        : "#22c55e",
                }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-neutral-700">
              <span>
                {fmt(v.liability)} {v.token} committed
              </span>
              <span>
                {fmt(v.available)} {v.token} free
              </span>
            </div>
          </div>

          {/* Burn rate info */}
          {v.ratePerSec > 0 && (
            <div className="mb-5 grid grid-cols-3 gap-3">
              {[
                {
                  label: "Per second",
                  value: `${fmt(v.ratePerSec, 6)} ${v.token}`,
                },
                {
                  label: "Per day",
                  value: `${fmt(v.dailyBurn, 2)} ${v.token}`,
                },
                {
                  label: "Per month",
                  value: `${fmt(v.monthlyBurn, 2)} ${v.token}`,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/[0.06] bg-[#0a0a0a] p-4"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-700 mb-1">
                    Burn {label}
                  </p>
                  <p className="text-[14px] font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Cross-token stream value chart */}
      {tokenBar.length > 0 && (
        <div className="mb-8 rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
          <p className="mb-4 text-[13px] font-bold text-white">
            Stream Value vs Disbursed
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={tokenBar}
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
                formatter={(v) => [fmt(v as number), ""]}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar
                dataKey="total"
                name="Total value"
                fill="rgba(250,204,21,0.3)"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
              <Bar
                dataKey="streamed"
                name="Disbursed"
                fill={YELLOW}
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 flex justify-center gap-5">
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded"
                style={{ backgroundColor: "rgba(250,204,21,0.3)" }}
              />
              <span className="text-[11px] text-neutral-500">Total value</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded"
                style={{ backgroundColor: YELLOW }}
              />
              <span className="text-[11px] text-neutral-500">Disbursed</span>
            </div>
          </div>
        </div>
      )}

      {/* Vault commitment radial */}
      {commitmentData.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
          <p className="mb-4 text-[13px] font-bold text-white">
            Commitment by Token (%)
          </p>
          <div className="flex flex-wrap gap-6 items-center">
            {commitmentData.map((d) => (
              <div key={d.name} className="flex flex-col items-center">
                <div className="relative h-24 w-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="90%"
                      data={[{ value: d.value }]}
                      startAngle={90}
                      endAngle={90 - (d.value / 100) * 360}
                    >
                      <RadialBar
                        dataKey="value"
                        cornerRadius={4}
                        fill={d.fill}
                        background={{ fill: "rgba(255,255,255,0.05)" }}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[13px] font-black text-white">
                      {d.value.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-[11px] font-bold text-neutral-500">
                  {d.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
