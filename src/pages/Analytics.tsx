import { useRef } from "react";
import { useAnalyticsData } from "../hooks/useAnalyticsData";
import { PayrollTrendChart } from "../components/Charts/PayrollTrendChart";
import { EarningsTrendChart } from "../components/Charts/EarningsTrendChart";
import { TreasuryBalanceChart } from "../components/Charts/TreasuryBalanceChart";
import { StreamStatusChart } from "../components/Charts/StreamStatusChart";
import { useTheme } from "../providers/ThemeProvider";

const tw = {
  page: "min-h-screen bg-[linear-gradient(135deg,#0f172a_0%,#1e1b4b_50%,#0f172a_100%)] px-6 pb-16 pt-8 font-[Inter,sans-serif] text-slate-200",
  header: "mx-auto mb-8 max-w-[1200px]",
  title:
    "mb-1 text-[2rem] font-extrabold tracking-[-0.02em] text-transparent bg-[linear-gradient(135deg,#818cf8,#c084fc,#6366f1)] bg-clip-text",
  subtitle: "m-0 text-[0.95rem] text-slate-400",
  kpiGrid:
    "mx-auto mb-8 grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4",
  kpi: "rounded-2xl border border-indigo-500/15 bg-slate-800/55 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-[20px]",
  kpiLabel:
    "mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-slate-500",
  kpiValue: "text-[1.5rem] font-extrabold",
  chartsGrid: "mx-auto grid max-w-[1200px] grid-cols-1 gap-6 md:grid-cols-2",
  card: "rounded-2xl border border-indigo-500/15 bg-slate-800/55 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-[20px]",
  cardHeader: "mb-4 flex items-start justify-between gap-3",
  cardMeta: "flex-1",
  cardTitle: "text-[1rem] font-bold text-slate-100",
  cardDesc: "mt-0.5 text-[0.8rem] text-slate-400",
  exportRow: "flex shrink-0 gap-2",
  btnExport:
    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.75rem] font-semibold transition-all duration-200",
  btnCSV:
    "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
  btnPNG:
    "border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20",
};

function fmt(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function exportCSV(data: Record<string, string | number>[], filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const rows = [
    keys.join(","),
    ...data.map((row) => keys.map((k) => String(row[k])).join(",")),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportPNG(
  ref: React.RefObject<HTMLDivElement | null>,
  filename: string,
) {
  const svg = ref.current?.querySelector("svg");
  if (!svg) return;
  const { width, height } = svg.getBoundingClientRect();
  const xml = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width || 600;
    canvas.height = height || 300;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = filename;
    a.click();
  };
  img.src = url;
}

const Analytics: React.FC = () => {
  const { theme } = useTheme();
  const {
    payrollTrend,
    earningsTrend,
    topEmployees,
    treasuryHistory,
    streamStatus,
    kpis,
    lastUpdatedAt,
    refreshIntervalMs,
  } = useAnalyticsData();

  const payrollRef = useRef<HTMLDivElement>(null);
  const earningsRef = useRef<HTMLDivElement>(null);
  const treasuryRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const palette =
    theme === "dark"
      ? {
          page: "min-h-screen bg-[linear-gradient(135deg,#0f172a_0%,#1e1b4b_50%,#0f172a_100%)] px-6 pb-16 pt-8 font-[Inter,sans-serif] text-slate-200",
          card: "rounded-2xl border border-indigo-500/15 bg-slate-800/55 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-[20px]",
          subtitle: "text-slate-400",
          title:
            "mb-1 text-[2rem] font-extrabold tracking-[-0.02em] text-transparent bg-[linear-gradient(135deg,#818cf8,#c084fc,#6366f1)] bg-clip-text",
        }
      : {
          page: "min-h-screen bg-[linear-gradient(135deg,#f7fbff_0%,#eef4ff_55%,#f8fafc_100%)] px-6 pb-16 pt-8 font-[Inter,sans-serif] text-slate-900",
          card: "rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_8px_32px_rgba(15,23,42,0.08)] backdrop-blur-[20px]",
          subtitle: "text-slate-500",
          title:
            "mb-1 text-[2rem] font-extrabold tracking-[-0.02em] text-transparent bg-[linear-gradient(135deg,#0f172a,#1d4ed8,#14b8a6)] bg-clip-text",
        };

  return (
    <div className={palette.page}>
      <header className={tw.header}>
        <h1 className={palette.title}>Payroll Analytics</h1>
        <p className={`m-0 text-[0.95rem] ${palette.subtitle}`}>
          Visualise spending trends, earnings, and treasury health
        </p>
        <p className={`mt-2 text-xs ${palette.subtitle}`}>
          Auto-refreshes every {refreshIntervalMs / 1000}s. Last updated{" "}
          {lastUpdatedAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
          .
        </p>
      </header>

      {/* KPIs */}
      <div className={tw.kpiGrid} role="region" aria-label="Key metrics">
        <div className={palette.card}>
          <div className={tw.kpiLabel}>Total Disbursed</div>
          <div className={`${tw.kpiValue} text-indigo-300`}>
            {fmt(kpis.totalDisbursed)} USDC
          </div>
        </div>
        <div className={palette.card}>
          <div className={tw.kpiLabel}>Active Workers</div>
          <div className={`${tw.kpiValue} text-slate-100`}>{kpis.workers}</div>
        </div>
        <div className={palette.card}>
          <div className={tw.kpiLabel}>Avg Monthly Payroll</div>
          <div className={`${tw.kpiValue} text-purple-300`}>
            {fmt(kpis.avgMonthly)} USDC
          </div>
        </div>
        <div className={palette.card}>
          <div className={tw.kpiLabel}>Current Treasury</div>
          <div className={`${tw.kpiValue} text-emerald-400`}>
            {fmt(kpis.treasury)} USDC
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className={tw.chartsGrid}>
        {/* Payroll Spending */}
        <div className={palette.card}>
          <div className={tw.cardHeader}>
            <div className={tw.cardMeta}>
              <div className={tw.cardTitle}>Payroll Spending</div>
              <div className={tw.cardDesc}>
                Completed vs failed payments per month
              </div>
            </div>
            <div className={tw.exportRow}>
              <button
                className={`${tw.btnExport} ${tw.btnCSV}`}
                onClick={() => exportCSV(payrollTrend, "payroll-trend.csv")}
                aria-label="Export payroll trend as CSV"
              >
                CSV
              </button>
              <button
                className={`${tw.btnExport} ${tw.btnPNG}`}
                onClick={() => exportPNG(payrollRef, "payroll-trend.png")}
                aria-label="Export payroll trend as PNG"
              >
                PNG
              </button>
            </div>
          </div>
          <div
            ref={payrollRef}
            role="img"
            aria-label="Payroll spending area chart"
          >
            <PayrollTrendChart data={payrollTrend} />
          </div>
        </div>

        {/* Worker Earnings */}
        <div className={palette.card}>
          <div className={tw.cardHeader}>
            <div className={tw.cardMeta}>
              <div className={tw.cardTitle}>Worker Earnings</div>
              <div className={tw.cardDesc}>Top 5 earners month-over-month</div>
            </div>
            <div className={tw.exportRow}>
              <button
                className={`${tw.btnExport} ${tw.btnCSV}`}
                onClick={() => exportCSV(earningsTrend, "earnings-trend.csv")}
                aria-label="Export earnings trend as CSV"
              >
                CSV
              </button>
              <button
                className={`${tw.btnExport} ${tw.btnPNG}`}
                onClick={() => exportPNG(earningsRef, "earnings-trend.png")}
                aria-label="Export earnings trend as PNG"
              >
                PNG
              </button>
            </div>
          </div>
          <div
            ref={earningsRef}
            role="img"
            aria-label="Worker earnings line chart"
          >
            <EarningsTrendChart data={earningsTrend} employees={topEmployees} />
          </div>
        </div>

        {/* Treasury Balance */}
        <div className={palette.card}>
          <div className={tw.cardHeader}>
            <div className={tw.cardMeta}>
              <div className={tw.cardTitle}>Treasury Balance</div>
              <div className={tw.cardDesc}>
                Running balance vs monthly payouts
              </div>
            </div>
            <div className={tw.exportRow}>
              <button
                className={`${tw.btnExport} ${tw.btnCSV}`}
                onClick={() =>
                  exportCSV(treasuryHistory, "treasury-history.csv")
                }
                aria-label="Export treasury history as CSV"
              >
                CSV
              </button>
              <button
                className={`${tw.btnExport} ${tw.btnPNG}`}
                onClick={() => exportPNG(treasuryRef, "treasury-balance.png")}
                aria-label="Export treasury balance as PNG"
              >
                PNG
              </button>
            </div>
          </div>
          <div
            ref={treasuryRef}
            role="img"
            aria-label="Treasury balance area chart"
          >
            <TreasuryBalanceChart data={treasuryHistory} />
          </div>
        </div>

        {/* Stream Status */}
        <div className={palette.card}>
          <div className={tw.cardHeader}>
            <div className={tw.cardMeta}>
              <div className={tw.cardTitle}>Stream Status</div>
              <div className={tw.cardDesc}>Breakdown by payment outcome</div>
            </div>
            <div className={tw.exportRow}>
              <button
                className={`${tw.btnExport} ${tw.btnCSV}`}
                onClick={() => exportCSV(streamStatus, "stream-status.csv")}
                aria-label="Export stream status as CSV"
              >
                CSV
              </button>
              <button
                className={`${tw.btnExport} ${tw.btnPNG}`}
                onClick={() => exportPNG(statusRef, "stream-status.png")}
                aria-label="Export stream status as PNG"
              >
                PNG
              </button>
            </div>
          </div>
          <div
            ref={statusRef}
            role="img"
            aria-label="Stream status donut chart"
          >
            <StreamStatusChart data={streamStatus} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
