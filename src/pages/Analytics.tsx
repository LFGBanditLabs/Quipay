import { useAnalyticsData } from "../hooks/useAnalyticsData";
import { useTheme } from "../providers/ThemeProvider";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtVolume(raw: string | number) {
  const n = typeof raw === "string" ? parseFloat(raw) : raw;
  if (isNaN(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

function shortBucket(bucket: string) {
  // "2025-01-15" → "Jan 15" or "Jan W3"
  const d = new Date(bucket);
  if (isNaN(d.getTime())) return bucket;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Chart theme helpers ───────────────────────────────────────────────────────

function useChartTheme(theme: string) {
  const dark = theme === "dark";
  return {
    axisColor: dark ? "#94a3b8" : "#64748b",
    gridColor: dark ? "rgba(99,102,241,0.1)" : "rgba(71,85,105,0.12)",
    tooltipStyle: {
      backgroundColor: dark ? "#0f172a" : "#ffffff",
      border: dark
        ? "1px solid rgba(99,102,241,0.25)"
        : "1px solid rgba(148,163,184,0.4)",
      borderRadius: "0.75rem",
      color: dark ? "#e2e8f0" : "#0f172a",
      fontSize: "0.78rem",
    },
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChartCard({
  title,
  description,
  children,
  cardCls,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  cardCls: string;
}) {
  return (
    <div className={cardCls}>
      <div className="mb-4">
        <p className="text-[0.95rem] font-bold text-slate-100">{title}</p>
        <p className="mt-0.5 text-[0.78rem] text-slate-400">{description}</p>
      </div>
      {children}
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
  cardCls,
}: {
  label: string;
  value: string;
  accent: string;
  cardCls: string;
}) {
  return (
    <div className={cardCls}>
      <p className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </p>
      <p className={`text-[1.45rem] font-extrabold ${accent}`}>{value}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const Analytics: React.FC = () => {
  const { theme } = useTheme();
  const ct = useChartTheme(theme);
  const dark = theme === "dark";

  const {
    summary,
    volumeOverTime,
    topWorkers,
    streamCreationRate,
    withdrawalFrequency,
    granularity,
    setGranularity,
    loading,
    error,
    lastUpdatedAt,
    refreshIntervalMs,
    refresh,
  } = useAnalyticsData();

  const pageCls = dark
    ? "min-h-screen bg-[linear-gradient(135deg,#0f172a_0%,#1e1b4b_50%,#0f172a_100%)] px-4 pb-16 pt-8 text-slate-200"
    : "min-h-screen bg-[linear-gradient(135deg,#f7fbff_0%,#eef4ff_55%,#f8fafc_100%)] px-4 pb-16 pt-8 text-slate-900";

  const cardCls = dark
    ? "rounded-2xl border border-indigo-500/15 bg-slate-800/55 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-[20px]"
    : "rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_8px_32px_rgba(15,23,42,0.08)] backdrop-blur-[20px]";

  const titleCls = dark
    ? "mb-1 text-[1.9rem] font-extrabold tracking-[-0.02em] text-transparent bg-[linear-gradient(135deg,#818cf8,#c084fc,#6366f1)] bg-clip-text"
    : "mb-1 text-[1.9rem] font-extrabold tracking-[-0.02em] text-transparent bg-[linear-gradient(135deg,#0f172a,#1d4ed8,#14b8a6)] bg-clip-text";

  const subtitleCls = dark ? "text-slate-400" : "text-slate-500";

  const btnBase =
    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150";
  const btnActive = dark
    ? `${btnBase} bg-indigo-500/20 border border-indigo-500/40 text-indigo-300`
    : `${btnBase} bg-indigo-100 border border-indigo-300 text-indigo-700`;
  const btnInactive = dark
    ? `${btnBase} border border-slate-700 text-slate-400 hover:text-slate-200`
    : `${btnBase} border border-slate-200 text-slate-500 hover:text-slate-700`;

  return (
    <div className={pageCls}>
      {/* Header */}
      <header className="mx-auto mb-6 max-w-[1200px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className={titleCls}>Streaming Analytics</h1>
            <p className={`m-0 text-[0.9rem] ${subtitleCls}`}>
              Real-time XLM/USDC volume, top earners, stream creation and
              withdrawal activity
            </p>
            <p className={`mt-1 text-xs ${subtitleCls}`}>
              Auto-refreshes every {refreshIntervalMs / 1000}s · Last updated{" "}
              {lastUpdatedAt.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs ${subtitleCls}`}>Granularity:</span>
            <button
              className={granularity === "daily" ? btnActive : btnInactive}
              onClick={() => setGranularity("daily")}
            >
              Daily
            </button>
            <button
              className={granularity === "weekly" ? btnActive : btnInactive}
              onClick={() => setGranularity("weekly")}
            >
              Weekly
            </button>
            <button
              className={btnInactive}
              onClick={() => void refresh()}
              aria-label="Refresh analytics"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
          >
            {error} — showing last known data.
          </div>
        )}
      </header>

      {/* KPI row */}
      <div
        className="mx-auto mb-6 grid max-w-[1200px] grid-cols-2 gap-4 sm:grid-cols-4"
        role="region"
        aria-label="Key metrics"
      >
        <KpiCard
          label="Total Streams"
          value={summary ? String(summary.total_streams) : "—"}
          accent="text-indigo-400"
          cardCls={cardCls}
        />
        <KpiCard
          label="Active Streams"
          value={summary ? String(summary.active_streams) : "—"}
          accent="text-emerald-400"
          cardCls={cardCls}
        />
        <KpiCard
          label="Total Volume"
          value={summary ? fmtVolume(summary.total_volume) : "—"}
          accent="text-purple-400"
          cardCls={cardCls}
        />
        <KpiCard
          label="Total Withdrawn"
          value={summary ? fmtVolume(summary.total_withdrawn) : "—"}
          accent="text-pink-400"
          cardCls={cardCls}
        />
      </div>

      {/* Charts grid */}
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-6 md:grid-cols-2">
        {/* 1 — Volume over time */}
        <ChartCard
          title="XLM / USDC Streamed"
          description={`Total payroll volume per ${granularity === "weekly" ? "week" : "day"} (last 30 days)`}
          cardCls={cardCls}
        >
          {loading && volumeOverTime.length === 0 ? (
            <Skeleton />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart
                data={volumeOverTime.map((d) => ({
                  ...d,
                  bucket: shortBucket(d.bucket),
                  total_volume: parseFloat(d.total_volume),
                  xlm_volume: parseFloat(d.xlm_volume),
                  usdc_volume: parseFloat(d.usdc_volume),
                }))}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="vol-total" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="vol-usdc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={ct.gridColor}
                  vertical={false}
                />
                <XAxis
                  dataKey="bucket"
                  tick={{ fill: ct.axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: ct.axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtVolume}
                />
                <Tooltip
                  contentStyle={ct.tooltipStyle}
                  formatter={(v) => [fmtVolume(v as number)]}
                />
                <Legend
                  wrapperStyle={{ fontSize: "0.75rem", color: ct.axisColor }}
                />
                <Area
                  type="monotone"
                  dataKey="total_volume"
                  name="Total"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#vol-total)"
                />
                <Area
                  type="monotone"
                  dataKey="usdc_volume"
                  name="USDC"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  fill="url(#vol-usdc)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* 2 — Top workers by earned amount */}
        <ChartCard
          title="Top Workers by Earned Amount"
          description="Cumulative withdrawals per worker"
          cardCls={cardCls}
        >
          {loading && topWorkers.length === 0 ? (
            <Skeleton />
          ) : topWorkers.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={topWorkers.map((w) => ({
                  worker: shortAddr(w.worker),
                  earned: parseFloat(w.total_earned),
                  streams: w.stream_count,
                }))}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={ct.gridColor}
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: ct.axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtVolume}
                />
                <YAxis
                  type="category"
                  dataKey="worker"
                  tick={{ fill: ct.axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                />
                <Tooltip
                  contentStyle={ct.tooltipStyle}
                  formatter={(v) => [fmtVolume(v as number), "Earned"]}
                />
                <Bar
                  dataKey="earned"
                  name="Earned"
                  fill="#818cf8"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* 3 — Stream creation rate */}
        <ChartCard
          title="Stream Creation Rate"
          description={`New streams per ${granularity === "weekly" ? "week" : "day"} (last 30 days)`}
          cardCls={cardCls}
        >
          {loading && streamCreationRate.length === 0 ? (
            <Skeleton />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={streamCreationRate.map((d) => ({
                  ...d,
                  bucket: shortBucket(d.bucket),
                }))}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={ct.gridColor}
                  vertical={false}
                />
                <XAxis
                  dataKey="bucket"
                  tick={{ fill: ct.axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: ct.axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={ct.tooltipStyle}
                  formatter={(v) => [v, "Streams created"]}
                />
                <Bar
                  dataKey="streams_created"
                  name="Streams Created"
                  fill="#c084fc"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* 4 — Withdrawal frequency */}
        <ChartCard
          title="Withdrawal Frequency"
          description={`Withdrawal count & volume per ${granularity === "weekly" ? "week" : "day"} (last 30 days)`}
          cardCls={cardCls}
        >
          {loading && withdrawalFrequency.length === 0 ? (
            <Skeleton />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={withdrawalFrequency.map((d) => ({
                  ...d,
                  bucket: shortBucket(d.bucket),
                  total_withdrawn: parseFloat(d.total_withdrawn),
                }))}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={ct.gridColor}
                  vertical={false}
                />
                <XAxis
                  dataKey="bucket"
                  tick={{ fill: ct.axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="count"
                  tick={{ fill: ct.axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="vol"
                  orientation="right"
                  tick={{ fill: ct.axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtVolume}
                />
                <Tooltip
                  contentStyle={ct.tooltipStyle}
                  formatter={(v, name) =>
                    name === "Volume"
                      ? [fmtVolume(v as number), name]
                      : [v, name]
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: "0.75rem", color: ct.axisColor }}
                />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="withdrawal_count"
                  name="Count"
                  stroke="#f472b6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="vol"
                  type="monotone"
                  dataKey="total_withdrawn"
                  name="Volume"
                  stroke="#fb923c"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="4 2"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
};

// ── Micro-components ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div
      className="h-[240px] w-full animate-pulse rounded-xl bg-slate-700/30"
      aria-busy="true"
      aria-label="Loading chart"
    />
  );
}

function EmptyState() {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">
      No data yet
    </div>
  );
}

export default Analytics;
