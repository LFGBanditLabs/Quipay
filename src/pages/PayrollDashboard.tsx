/**
 * PayrollDashboard.tsx
 * Quipay — Advanced Payroll Analytics Dashboard
 * Place in: src/components/PayrollDashboard.tsx
 *
 * Dependencies: recharts
 * Install: npm install recharts
 */

import { useState, useMemo, useCallback } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Sector,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type Theme = "dark" | "light";
type DateRange = "7D" | "30D" | "90D" | "6M" | "1Y" | "ALL";
type Token = "USDC" | "XLM" | "ALL";

interface DailyRecord {
  date: string; // "YYYY-MM-DD"
  usdc: number;
  xlm: number;
  workers: number;
  transactions: number;
  fees: number;
}

// ─── Data Generation (500+ points) ───────────────────────────────────────────

function generateDailyData(): DailyRecord[] {
  const records: DailyRecord[] = [];
  const start = new Date("2024-01-01");
  const end = new Date("2025-12-31");

  let usdc = 18000;
  let xlm = 4200;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // Simulate realistic payroll patterns
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const month = d.getMonth();
    // Seasonal growth
    const growth = 1 + (d.getFullYear() - 2024) * 0.18 + month * 0.012;
    // Mid-month & end-of-month spikes
    const dom = d.getDate();
    const spike = dom === 15 || dom === 30 || dom === 1 ? 1.6 : 1;
    // Weekday variance
    const dayMod = isWeekend ? 0.15 : 1 + (Math.random() - 0.48) * 0.3;

    usdc = Math.max(
      500,
      usdc * 0.97 + (Math.random() * 800 + 400) * growth * spike * dayMod,
    );
    xlm = Math.max(
      100,
      xlm * 0.97 + (Math.random() * 200 + 80) * growth * spike * dayMod * 0.4,
    );

    records.push({
      date: d.toISOString().slice(0, 10),
      usdc: Math.round(usdc * 100) / 100,
      xlm: Math.round(xlm * 100) / 100,
      workers: Math.max(1, Math.round(12 * growth + (Math.random() - 0.5) * 4)),
      transactions: Math.max(
        1,
        Math.round((isWeekend ? 2 : 8) * growth * (Math.random() * 0.8 + 0.6)),
      ),
      fees: Math.round((usdc * 0.0008 + xlm * 0.0005) * 100) / 100,
    });
  }
  return records;
}

const ALL_DATA = generateDailyData();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number, dec = 0) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

const fmtUSD = (n: number) =>
  "$" +
  (n >= 1_000_000
    ? (n / 1_000_000).toFixed(2) + "M"
    : n >= 1_000
      ? (n / 1_000).toFixed(1) + "K"
      : n.toFixed(0));

function filterByRange(data: DailyRecord[], range: DateRange): DailyRecord[] {
  if (range === "ALL") return data;
  const days: Record<DateRange, number> = {
    "7D": 7,
    "30D": 30,
    "90D": 90,
    "6M": 180,
    "1Y": 365,
    ALL: 0,
  };
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days[range]);
  const cutStr = cutoff.toISOString().slice(0, 10);
  return data.filter((r) => r.date >= cutStr);
}

function downsample(data: DailyRecord[], maxPoints: number): DailyRecord[] {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, i) => i % step === 0);
}

function toMonthly(data: DailyRecord[]) {
  const map = new Map<
    string,
    { month: string; usdc: number; xlm: number; transactions: number }
  >();
  data.forEach((r) => {
    const key = r.date.slice(0, 7);
    const existing = map.get(key);
    if (existing) {
      existing.usdc += r.usdc;
      existing.xlm += r.xlm;
      existing.transactions += r.transactions;
    } else {
      const [y, m] = key.split("-");
      const label = new Date(Number(y), Number(m) - 1).toLocaleDateString(
        "en-US",
        { month: "short", year: "2-digit" },
      );
      map.set(key, {
        month: label,
        usdc: r.usdc,
        xlm: r.xlm,
        transactions: r.transactions,
      });
    }
  });
  return Array.from(map.values());
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(data: DailyRecord[], filename: string) {
  const headers = [
    "Date",
    "USDC Payroll",
    "XLM Payroll",
    "Workers",
    "Transactions",
    "Fees",
  ];
  const rows = data.map((r) => [
    r.date,
    r.usdc,
    r.xlm,
    r.workers,
    r.transactions,
    r.fees,
  ]);
  const csv =
    "\uFEFF" + [headers, ...rows].map((r) => r.join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Theme tokens ─────────────────────────────────────────────────────────────

const THEMES = {
  dark: {
    bg: "#0a0910",
    panel: "#100f1a",
    card: "#141320",
    border: "rgba(255,255,255,0.07)",
    text: "#eceaf8",
    muted: "#6b6585",
    gridLine: "rgba(255,255,255,0.05)",
    tooltipBg: "#1e1b2e",
    tooltipBorder: "rgba(110,86,207,0.4)",
  },
  light: {
    bg: "#f4f2ff",
    panel: "#ffffff",
    card: "#ffffff",
    border: "#e0daf5",
    text: "#13111a",
    muted: "#8a82a8",
    gridLine: "rgba(0,0,0,0.06)",
    tooltipBg: "#ffffff",
    tooltipBorder: "rgba(110,86,207,0.3)",
  },
};

const ACCENT = "#6E56CF";
const ACCENT2 = "#9b85f5";
const CLR_XLM = "#22d3ee";
const CLR_FEE = "#f59e0b";
const CLR_WORK = "#34d399";

const PIE_COLORS = [ACCENT, CLR_XLM, CLR_FEE, CLR_WORK, "#f472b6", "#818cf8"];

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
  theme,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  theme: Theme;
}) {
  if (!active || !payload?.length) return null;
  const t = THEMES[theme];
  return (
    <div
      style={{
        background: t.tooltipBg,
        border: `1px solid ${t.tooltipBorder}`,
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      }}
    >
      <div
        style={{
          color: t.muted,
          marginBottom: 6,
          fontSize: 11,
          letterSpacing: ".06em",
        }}
      >
        {label}
      </div>
      {payload.map((p) => (
        <div
          key={p.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 3,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: p.color,
              flexShrink: 0,
            }}
          />
          <span style={{ color: t.muted, flex: 1 }}>{p.name}</span>
          <span
            style={{ color: t.text, fontWeight: 700, fontFamily: "monospace" }}
          >
            {typeof p.value === "number" && p.name.toLowerCase().includes("usd")
              ? fmtUSD(p.value)
              : fmt(p.value, 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
  delta,
  theme,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  theme: Theme;
}) {
  const t = THEMES[theme];
  const up = (delta ?? 0) >= 0;
  return (
    <div
      style={{
        background: t.card,
        border: `1.5px solid ${t.border}`,
        borderRadius: 14,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: t.muted,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: t.text,
          lineHeight: 1.15,
          fontFamily: "'DM Mono', monospace",
        }}
      >
        {value}
      </span>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}
      >
        {delta !== undefined && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 99,
              background: up ? "rgba(52,211,153,.12)" : "rgba(248,113,113,.12)",
              color: up ? "#34d399" : "#f87171",
            }}
          >
            {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {sub && <span style={{ fontSize: 11, color: t.muted }}>{sub}</span>}
      </div>
    </div>
  );
}

// ─── Active Pie Shape ─────────────────────────────────────────────────────────

interface ActivePieShapeProps {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
  payload: { name: string };
  percent: number;
  value: number;
}

function ActivePieShape(props: ActivePieShapeProps) {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
    value,
  } = props;
  return (
    <g>
      <text
        x={cx}
        y={cy - 10}
        textAnchor="middle"
        fill={fill}
        style={{
          fontSize: 16,
          fontWeight: 800,
          fontFamily: "'DM Mono',monospace",
        }}
      >
        {fmtUSD(value)}
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        fill="#8a82a8"
        style={{ fontSize: 11 }}
      >
        {(percent * 100).toFixed(1)}%
      </text>
      <text
        x={cx}
        y={cy + 28}
        textAnchor="middle"
        fill="#8a82a8"
        style={{ fontSize: 10 }}
      >
        {payload.name}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 12}
        outerRadius={outerRadius + 16}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function PayrollDashboard() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [range, setRange] = useState<DateRange>("90D");
  const [tokenFilter, setToken] = useState<Token>("ALL");
  const [activePie, setActivePie] = useState(0);
  const [exportMsg, setExportMsg] = useState("");

  const t = THEMES[theme];

  // ── Filtered data ──
  const filtered = useMemo(() => filterByRange(ALL_DATA, range), [range]);

  // Downsample for burn-rate chart (keep perf for 500+ points)
  const burnData = useMemo(
    () =>
      downsample(filtered, 120).map((r) => ({
        date: r.date.slice(5), // MM-DD
        USDC: tokenFilter === "XLM" ? undefined : r.usdc,
        XLM: tokenFilter === "USDC" ? undefined : r.xlm,
      })),
    [filtered, tokenFilter],
  );

  const monthlyBar = useMemo(() => toMonthly(filtered), [filtered]);

  const totalUSDC = useMemo(
    () => filtered.reduce((s, r) => s + r.usdc, 0),
    [filtered],
  );
  const totalXLM = useMemo(
    () => filtered.reduce((s, r) => s + r.xlm, 0),
    [filtered],
  );
  const totalTx = useMemo(
    () => filtered.reduce((s, r) => s + r.transactions, 0),
    [filtered],
  );
  const avgWorkers = useMemo(
    () =>
      Math.round(
        filtered.reduce((s, r) => s + r.workers, 0) / (filtered.length || 1),
      ),
    [filtered],
  );
  const totalFees = useMemo(
    () => filtered.reduce((s, r) => s + r.fees, 0),
    [filtered],
  );

  // Delta vs previous period
  const prevFiltered = useMemo(() => {
    if (range === "ALL") return filtered;
    const days: Record<DateRange, number> = {
      "7D": 7,
      "30D": 30,
      "90D": 90,
      "6M": 180,
      "1Y": 365,
      ALL: 0,
    };
    const d = days[range];
    const to = new Date();
    to.setDate(to.getDate() - d);
    const from = new Date(to);
    from.setDate(from.getDate() - d);
    return ALL_DATA.filter(
      (r) =>
        r.date >= from.toISOString().slice(0, 10) &&
        r.date < to.toISOString().slice(0, 10),
    );
  }, [range, filtered]);

  const prevUSDC = useMemo(
    () => prevFiltered.reduce((s, r) => s + r.usdc, 0),
    [prevFiltered],
  );
  const deltaUSDC =
    prevUSDC > 0 ? ((totalUSDC - prevUSDC) / prevUSDC) * 100 : 0;

  // Token pie data
  const pieData = useMemo(
    () => [
      { name: "USDC", value: totalUSDC },
      { name: "XLM", value: totalXLM },
      { name: "Fees", value: totalFees },
    ],
    [totalUSDC, totalXLM, totalFees],
  );

  // Worker trend (weekly sampled)
  const workerTrend = useMemo(
    () =>
      downsample(filtered, 60).map((r) => ({
        date: r.date.slice(5),
        Workers: r.workers,
      })),
    [filtered],
  );

  const handleExport = useCallback(() => {
    exportCSV(filtered, `quipay-analytics-${range}-${Date.now()}.csv`);
    setExportMsg("Downloaded!");
    setTimeout(() => setExportMsg(""), 2500);
  }, [filtered, range]);

  // ── Styles ──
  const sectionLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: ".14em",
    textTransform: "uppercase",
    color: t.muted,
    marginBottom: 12,
  };
  const chartCard: React.CSSProperties = {
    background: t.card,
    border: `1.5px solid ${t.border}`,
    borderRadius: 16,
    padding: "22px 20px",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Clash+Display:wght@500;600;700&family=DM+Mono:wght@400;500&family=Outfit:wght@400;500;600&display=swap');

        @keyframes pdFadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pdPulse  { 0%,100%{opacity:1}50%{opacity:.5} }

        .pd-root { animation: pdFadeUp .4s ease both; }
        .pd-root * { box-sizing: border-box; margin:0; padding:0; }

        .pd-btn {
          padding: 8px 16px; border-radius: 8px; border: none;
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all .15s; letter-spacing: .02em;
        }
        .pd-pill {
          padding: 6px 14px; border-radius: 99px; border: none;
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all .15s;
        }

        .pd-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 14px;
        }
        .pd-chart-row {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 16px;
          align-items: start;
        }
        .pd-chart-row-3 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 900px) {
          .pd-chart-row   { grid-template-columns: 1fr; }
          .pd-chart-row-3 { grid-template-columns: 1fr; }
        }
      `}</style>

      <div
        className="pd-root"
        style={{
          background: t.bg,
          minHeight: "100vh",
          padding: "32px 28px",
          fontFamily: "'Outfit', sans-serif",
          color: t.text,
        }}
      >
        {/* ── Top bar ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: ACCENT2,
                marginBottom: 6,
              }}
            >
              Quipay · Employer Analytics
            </div>
            <h1
              style={{
                fontFamily: "'Clash Display', sans-serif",
                fontSize: "clamp(22px, 3.5vw, 36px)",
                fontWeight: 700,
                lineHeight: 1.1,
                color: t.text,
              }}
            >
              Payroll Intelligence
            </h1>
            <p style={{ fontSize: 13, color: t.muted, marginTop: 6 }}>
              {fmt(ALL_DATA.length)} data points · Real-time payroll analytics
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {/* Theme toggle */}
            <button
              className="pd-btn"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              style={{
                background: t.card,
                border: `1.5px solid ${t.border}`,
                color: t.text,
              }}
            >
              {theme === "dark" ? "☀ Light" : "☾ Dark"}
            </button>

            {/* Export */}
            <button
              className="pd-btn"
              onClick={handleExport}
              style={{
                background: ACCENT,
                color: "#fff",
                boxShadow: `0 4px 20px rgba(110,86,207,.35)`,
              }}
            >
              {exportMsg || "↓ Export CSV"}
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div
          style={{
            display: "flex",
            gap: 24,
            marginBottom: 28,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {/* Date range */}
          <div
            style={{
              display: "flex",
              gap: 6,
              background: t.card,
              border: `1.5px solid ${t.border}`,
              borderRadius: 99,
              padding: "4px",
            }}
          >
            {(["7D", "30D", "90D", "6M", "1Y", "ALL"] as DateRange[]).map(
              (r) => (
                <button
                  key={r}
                  className="pd-pill"
                  onClick={() => setRange(r)}
                  style={{
                    background: range === r ? ACCENT : "transparent",
                    color: range === r ? "#fff" : t.muted,
                    boxShadow:
                      range === r ? `0 2px 12px rgba(110,86,207,.4)` : "none",
                  }}
                >
                  {r}
                </button>
              ),
            )}
          </div>

          {/* Token filter */}
          <div
            style={{
              display: "flex",
              gap: 6,
              background: t.card,
              border: `1.5px solid ${t.border}`,
              borderRadius: 99,
              padding: "4px",
            }}
          >
            {(["ALL", "USDC", "XLM"] as Token[]).map((tk) => (
              <button
                key={tk}
                className="pd-pill"
                onClick={() => setToken(tk)}
                style={{
                  background:
                    tokenFilter === tk
                      ? tk === "XLM"
                        ? CLR_XLM
                        : tk === "USDC"
                          ? ACCENT
                          : ACCENT
                      : "transparent",
                  color: tokenFilter === tk ? "#fff" : t.muted,
                }}
              >
                {tk}
              </button>
            ))}
          </div>

          <span style={{ fontSize: 12, color: t.muted, marginLeft: "auto" }}>
            {fmt(filtered.length)} days selected
          </span>
        </div>

        {/* ── KPI Row ── */}
        <div className="pd-kpi-grid" style={{ marginBottom: 20 }}>
          <KPICard
            label="Total USDC Payroll"
            value={fmtUSD(totalUSDC)}
            delta={deltaUSDC}
            sub="vs prev period"
            theme={theme}
          />
          <KPICard
            label="Total XLM Payroll"
            value={fmt(totalXLM, 0) + " XLM"}
            sub="native token"
            theme={theme}
          />
          <KPICard
            label="Transactions"
            value={fmt(totalTx)}
            sub="on-chain"
            theme={theme}
          />
          <KPICard
            label="Avg Active Workers"
            value={fmt(avgWorkers)}
            sub="per day"
            theme={theme}
          />
          <KPICard
            label="Total Protocol Fees"
            value={fmtUSD(totalFees)}
            sub="paid to network"
            theme={theme}
          />
        </div>

        {/* ── Burn Rate + Pie ── */}
        <div className="pd-chart-row" style={{ marginBottom: 16 }}>
          {/* Burn Rate Area Chart */}
          <div style={chartCard}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 18,
              }}
            >
              <div>
                <p style={sectionLabel}>Burn Rate</p>
                <p style={{ fontSize: 13, color: t.muted }}>
                  Daily payroll spend over time
                </p>
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: t.muted,
                  background: t.panel,
                  padding: "4px 10px",
                  borderRadius: 99,
                  border: `1px solid ${t.border}`,
                }}
              >
                {burnData.length} pts rendered
              </span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart
                data={burnData}
                margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradUSDC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={ACCENT} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradXLM" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CLR_XLM} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CLR_XLM} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={t.gridLine} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: t.muted, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(1, Math.floor(burnData.length / 8))}
                />
                <YAxis
                  tick={{ fill: t.muted, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={fmtUSD}
                  width={56}
                />
                <Tooltip content={<ChartTooltip theme={theme} />} />
                <Legend wrapperStyle={{ fontSize: 11, color: t.muted }} />
                {tokenFilter !== "XLM" && (
                  <Area
                    type="monotone"
                    dataKey="USDC"
                    stroke={ACCENT}
                    strokeWidth={2}
                    fill="url(#gradUSDC)"
                    dot={false}
                    activeDot={{ r: 4, fill: ACCENT }}
                  />
                )}
                {tokenFilter !== "USDC" && (
                  <Area
                    type="monotone"
                    dataKey="XLM"
                    stroke={CLR_XLM}
                    strokeWidth={2}
                    fill="url(#gradXLM)"
                    dot={false}
                    activeDot={{ r: 4, fill: CLR_XLM }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Token Distribution Donut */}
          <div
            style={{ ...chartCard, display: "flex", flexDirection: "column" }}
          >
            <p style={sectionLabel}>Token Distribution</p>
            <p style={{ fontSize: 13, color: t.muted, marginBottom: 16 }}>
              Payroll spend by asset
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  activeShape={ActivePieShape}
                  onMouseEnter={(_: ActivePieShapeProps, i: number) =>
                    setActivePie(i)
                  }
                  {...{ activeIndex: activePie }}
                >
                  {pieData.map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 8,
              }}
            >
              {pieData.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 12,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: PIE_COLORS[i],
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: t.muted, flex: 1 }}>{p.name}</span>
                  <span
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      color: t.text,
                      fontWeight: 600,
                    }}
                  >
                    {fmtUSD(p.value)}
                  </span>
                  <span style={{ fontSize: 10, color: t.muted }}>
                    {(
                      (p.value / (totalUSDC + totalXLM + totalFees)) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Monthly Bar + Worker Trend ── */}
        <div className="pd-chart-row-3" style={{ marginBottom: 16 }}>
          {/* Monthly payroll bar chart */}
          <div style={chartCard}>
            <p style={sectionLabel}>Monthly Payroll Volume</p>
            <p style={{ fontSize: 13, color: t.muted, marginBottom: 18 }}>
              USDC + XLM stacked by month
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={monthlyBar}
                margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                barSize={18}
              >
                <CartesianGrid
                  stroke={t.gridLine}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: t.muted, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: t.muted, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={fmtUSD}
                  width={56}
                />
                <Tooltip content={<ChartTooltip theme={theme} />} />
                <Legend wrapperStyle={{ fontSize: 11, color: t.muted }} />
                <Bar
                  dataKey="usdc"
                  name="USDC"
                  stackId="a"
                  fill={ACCENT}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="xlm"
                  name="XLM"
                  stackId="a"
                  fill={CLR_XLM}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Worker trend line */}
          <div style={chartCard}>
            <p style={sectionLabel}>Active Worker Trend</p>
            <p style={{ fontSize: 13, color: t.muted, marginBottom: 18 }}>
              Workers receiving streams per day
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={workerTrend}
                margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradWorker" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={CLR_WORK} />
                    <stop offset="100%" stopColor={ACCENT2} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={t.gridLine} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: t.muted, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(1, Math.floor(workerTrend.length / 6))}
                />
                <YAxis
                  tick={{ fill: t.muted, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <Tooltip content={<ChartTooltip theme={theme} />} />
                <Line
                  type="monotone"
                  dataKey="Workers"
                  stroke="url(#gradWorker)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: CLR_WORK }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Transaction frequency bar ── */}
        <div style={chartCard}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 18,
            }}
          >
            <div>
              <p style={sectionLabel}>Transaction Frequency</p>
              <p style={{ fontSize: 13, color: t.muted }}>
                On-chain transactions per day
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 22,
                  fontWeight: 700,
                  color: t.text,
                }}
              >
                {fmt(totalTx)}
              </div>
              <div style={{ fontSize: 11, color: t.muted }}>
                total in period
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart
              data={downsample(filtered, 90).map((r) => ({
                date: r.date.slice(5),
                Txns: r.transactions,
              }))}
              margin={{ top: 0, right: 8, left: 8, bottom: 0 }}
              barSize={4}
            >
              <CartesianGrid
                stroke={t.gridLine}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: t.muted, fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                interval={Math.floor(filtered.length / 8)}
              />
              <YAxis
                tick={{ fill: t.muted, fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                width={24}
              />
              <Tooltip content={<ChartTooltip theme={theme} />} />
              <Bar
                dataKey="Txns"
                fill={ACCENT2}
                radius={[2, 2, 0, 0]}
                opacity={0.85}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            textAlign: "center",
            marginTop: 32,
            fontSize: 11,
            color: t.muted,
          }}
        >
          Quipay Analytics · {fmt(ALL_DATA.length)} data points · All amounts in
          USD equivalent
        </div>
      </div>
    </>
  );
}
