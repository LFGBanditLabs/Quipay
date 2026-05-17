import React, { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "../util/formatters";
import { useWallet } from "../hooks/useWallet";
import { useRoleDetect } from "../hooks/useRoleDetect";

// ─── Mock data ────────────────────────────────────────────────────────────────

interface Stream {
  id: number;
  name: string;
  role: string;
  avatar: string;
  amount: number;
  rate: number;
  status: "streaming" | "paused" | "completed";
}

const STREAMS: Stream[] = [
  {
    id: 1,
    name: "Alice Chen",
    role: "Senior Engineer",
    avatar: "AC",
    amount: 1250,
    rate: 0.0034,
    status: "streaming",
  },
  {
    id: 2,
    name: "Bob Martinez",
    role: "Product Designer",
    avatar: "BM",
    amount: 980,
    rate: 0.0027,
    status: "streaming",
  },
  {
    id: 3,
    name: "Carol Wu",
    role: "DevOps Lead",
    avatar: "CW",
    amount: 1420,
    rate: 0.0039,
    status: "paused",
  },
  {
    id: 4,
    name: "David Lee",
    role: "Backend Engineer",
    avatar: "DL",
    amount: 1100,
    rate: 0.0031,
    status: "streaming",
  },
  {
    id: 5,
    name: "Emma Davis",
    role: "Product Manager",
    avatar: "ED",
    amount: 2100,
    rate: 0.0058,
    status: "streaming",
  },
];

interface StatMetric {
  id: string;
  label: string;
  value: number;
  format: "number" | "currency" | "duration";
  suffix?: string;
}

// ─── Live ticker counter ──────────────────────────────────────────────────────

function useLiveTotal(base: number, ratePerSec: number) {
  const [val, setVal] = useState(base);
  const start = useRef<number>(0);
  useEffect(() => {
    start.current = Date.now();
    const id = setInterval(() => {
      setVal(base + ((Date.now() - start.current) / 1000) * ratePerSec);
    }, 100);
    return () => clearInterval(id);
  }, [base, ratePerSec]);
  return val;
}

// ─── Dashboard mockup ─────────────────────────────────────────────────────────

function DashboardMockup() {
  const total = useLiveTotal(48291.7, 0.18);
  const treasury = useLiveTotal(284500, 0);
  const [streams, setStreams] = useState(STREAMS);

  useEffect(() => {
    const id = setInterval(() => {
      setStreams((prev) =>
        prev.map((s) =>
          s.status === "streaming" ? { ...s, amount: s.amount + s.rate } : s,
        ),
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const activeCount = streams.filter((s) => s.status === "streaming").length;
  const bars = [32, 48, 41, 62, 55, 70, 58, 76, 68, 85, 79, 92];

  const activity = [
    {
      user: "AC",
      name: "Alice Chen",
      action: "Claimed",
      amount: "+124.80",
      time: "2m ago",
      color: "#facc15",
    },
    {
      user: "ED",
      name: "Emma Davis",
      action: "Streaming",
      amount: "+210.24",
      time: "live",
      color: "#22c55e",
    },
    {
      user: "BM",
      name: "Bob Martinez",
      action: "Paused",
      amount: "+98.10",
      time: "14m ago",
      color: "#525252",
    },
  ];

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080808] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_60px_120px_-30px_rgba(0,0,0,0.9)]">
      {/* Yellow top bar */}
      <div className="h-[2px]" style={{ background: "#facc15" }} />

      {/* OS chrome */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] bg-[#0a0a0a] px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex flex-1 justify-center">
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-[#111] px-3 py-1">
            <svg
              className="h-3 w-3 text-neutral-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span className="font-mono text-[11px] text-neutral-500">
              app.quipay.xyz/dashboard
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
          <span className="font-mono text-[10px] text-neutral-500">LIVE</span>
        </div>
      </div>

      {/* App shell */}
      <div className="flex" style={{ minHeight: 520 }}>
        {/* ── Sidebar ── */}
        <div className="hidden w-[200px] shrink-0 flex-col border-r border-white/[0.05] bg-[#050505] sm:flex">
          {/* Brand */}
          <div className="flex items-center gap-2 px-4 py-4 border-b border-white/[0.05]">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black text-black"
              style={{ backgroundColor: "#facc15" }}
            >
              Q
            </div>
            <span className="text-[13px] font-bold text-white">Quipay</span>
            <span
              className="ml-auto rounded-md px-1.5 py-0.5 text-[9px] font-bold"
              style={{
                backgroundColor: "rgba(250,204,21,0.12)",
                color: "#facc15",
              }}
            >
              PRO
            </span>
          </div>

          {/* Nav */}
          <div className="flex-1 p-2 space-y-0.5">
            {[
              { label: "Overview", icon: "▦", active: true },
              { label: "Payroll", icon: "⚡", active: false },
              { label: "Treasury", icon: "🏦", active: false },
              { label: "Workforce", icon: "👥", active: false },
              { label: "Analytics", icon: "📊", active: false },
              { label: "Compliance", icon: "🛡", active: false },
            ].map(({ label, icon, active }) => (
              <div
                key={label}
                className={`flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium ${
                  active
                    ? "text-white"
                    : "text-neutral-600 hover:text-neutral-400"
                }`}
                style={
                  active ? { backgroundColor: "rgba(250,204,21,0.08)" } : {}
                }
              >
                <span className="text-[13px]">{icon}</span>
                {label}
                {active && (
                  <span
                    className="ml-auto h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: "#facc15" }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Sidebar footer */}
          <div className="border-t border-white/[0.05] p-3 space-y-1">
            <div className="flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-neutral-600">
              <span className="text-[13px]">⚙️</span> Settings
            </div>
            <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-black"
                style={{ backgroundColor: "#facc15" }}
              >
                JD
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-white leading-none">
                  John Doe
                </p>
                <p className="text-[10px] text-neutral-600">
                  Admin · Acme Corp
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main area ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-2.5">
            <div>
              <h1 className="text-[14px] font-bold text-white">Overview</h1>
              <p className="text-[10px] text-neutral-600">
                May 2026 · Stellar Testnet
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="hidden items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 sm:flex">
                <svg
                  className="h-3 w-3 text-neutral-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <span className="text-[11px] text-neutral-600">Search...</span>
              </div>
              {/* Bell */}
              <div className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
                <svg
                  className="h-3.5 w-3.5 text-neutral-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-[#080808]"
                  style={{ backgroundColor: "#facc15" }}
                />
              </div>
              {/* New stream btn */}
              <button
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-black"
                style={{ backgroundColor: "#facc15" }}
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                New Stream
              </button>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 border-b border-white/[0.05] sm:grid-cols-4">
            {[
              {
                label: "Streaming Now",
                value: formatCurrency(total, "USD"),
                delta: "+0.18/s",
                up: true,
                mono: true,
              },
              {
                label: "Treasury Balance",
                value: "$284,500",
                delta: "−12.4% MoM",
                up: false,
                mono: false,
              },
              {
                label: "Active Streams",
                value: String(activeCount),
                delta: `of 32 workers`,
                up: true,
                mono: false,
              },
              {
                label: "This Month Total",
                value: "$48,291",
                delta: "+18.4%",
                up: true,
                mono: false,
              },
            ].map(({ label, value, delta, up, mono }, i) => (
              <div
                key={label}
                className={`px-4 py-3 ${i < 3 ? "border-r border-white/[0.05]" : ""}`}
              >
                <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-600">
                  {label}
                </p>
                <p
                  className={`mt-1 text-[15px] font-bold leading-none text-white ${mono ? "font-mono tabular-nums" : ""}`}
                >
                  {value}
                </p>
                <p
                  className={`mt-1 text-[10px] font-medium ${up ? "text-green-400" : "text-neutral-500"}`}
                >
                  {delta}
                </p>
              </div>
            ))}
          </div>

          {/* Content split */}
          <div className="flex flex-1 overflow-hidden">
            {/* ── Stream table ── */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Table header */}
              <div className="flex items-center gap-2 border-b border-white/[0.04] px-4 py-2">
                <p className="flex-1 text-[10px] font-bold uppercase tracking-widest text-neutral-700">
                  Employee
                </p>
                <p className="hidden w-24 text-[10px] font-bold uppercase tracking-widest text-neutral-700 sm:block">
                  Rate / sec
                </p>
                <p className="w-20 text-right text-[10px] font-bold uppercase tracking-widest text-neutral-700">
                  Earned
                </p>
                <p className="w-16 text-right text-[10px] font-bold uppercase tracking-widest text-neutral-700">
                  Status
                </p>
              </div>

              {/* Rows */}
              <div className="flex-1 divide-y divide-white/[0.03] overflow-hidden">
                {streams.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.02]"
                  >
                    {/* Avatar */}
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-black"
                      style={{ backgroundColor: "#facc15" }}
                    >
                      {s.avatar}
                    </div>
                    {/* Name + role */}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-[12px] font-semibold text-white leading-none">
                        {s.name}
                      </p>
                      <p className="mt-0.5 text-[10px] text-neutral-600">
                        {s.role}
                      </p>
                    </div>
                    {/* Rate */}
                    <div className="hidden w-24 sm:block">
                      <p className="font-mono text-[11px] text-neutral-500">
                        ${s.rate.toFixed(4)}
                      </p>
                    </div>
                    {/* Earned + bar */}
                    <div className="w-20 text-right">
                      <p
                        className="font-mono text-[12px] font-bold tabular-nums"
                        style={{ color: "#facc15" }}
                      >
                        {s.amount.toFixed(2)}
                      </p>
                      <div className="mt-1 h-[2px] w-full rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min((s.amount / 2000) * 100, 100)}%`,
                            backgroundColor:
                              s.status === "streaming" ? "#facc15" : "#374151",
                          }}
                        />
                      </div>
                    </div>
                    {/* Status badge */}
                    <div className="w-16 flex justify-end">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          s.status === "streaming"
                            ? "bg-green-500/10 text-green-400"
                            : s.status === "paused"
                              ? "text-neutral-500"
                              : "text-neutral-600"
                        }`}
                        style={
                          s.status === "paused"
                            ? {
                                backgroundColor: "rgba(250,204,21,0.08)",
                                color: "#facc15",
                              }
                            : {}
                        }
                      >
                        <span
                          className={`h-1 w-1 rounded-full ${s.status === "streaming" ? "animate-pulse bg-green-400" : s.status === "paused" ? "" : "bg-neutral-600"}`}
                          style={
                            s.status === "paused"
                              ? { backgroundColor: "#facc15" }
                              : {}
                          }
                        />
                        {s.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Table footer */}
              <div className="flex items-center justify-between border-t border-white/[0.04] px-4 py-2">
                <p className="text-[10px] text-neutral-700">
                  Showing 5 of 32 employees
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                    <p className="font-mono text-[10px] text-neutral-600">
                      Stellar · Real-time
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right panel ── */}
            <div className="hidden w-[200px] shrink-0 flex-col border-l border-white/[0.05] lg:flex">
              {/* Payout chart */}
              <div className="border-b border-white/[0.05] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-700">
                    Payroll
                  </p>
                  <p
                    className="text-[10px] font-semibold"
                    style={{ color: "#facc15" }}
                  >
                    +18.4%
                  </p>
                </div>
                <div className="flex h-16 items-end gap-[2px]">
                  {bars.map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm"
                      style={{
                        height: `${h}%`,
                        backgroundColor:
                          i === bars.length - 1
                            ? "#facc15"
                            : `rgba(250,204,21,${0.08 + (i / bars.length) * 0.22})`,
                      }}
                    />
                  ))}
                </div>
                <div className="mt-1.5 flex justify-between">
                  <span className="text-[9px] text-neutral-700">Jun '25</span>
                  <span className="text-[9px] text-neutral-700">May '26</span>
                </div>
              </div>

              {/* Treasury */}
              <div className="border-b border-white/[0.05] p-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-700">
                  Treasury
                </p>
                <p className="font-mono text-[14px] font-bold text-white">
                  {formatCurrency(treasury, "USD")}
                </p>
                <div className="mt-2 h-[3px] w-full rounded-full bg-white/[0.06]">
                  <div
                    className="h-full w-[72%] rounded-full"
                    style={{ backgroundColor: "#facc15" }}
                  />
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-[9px] text-neutral-600">
                    72% runway
                  </span>
                  <span className="text-[9px] text-neutral-600">~18 mo</span>
                </div>
              </div>

              {/* Activity feed */}
              <div className="flex-1 p-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-700">
                  Activity
                </p>
                <div className="space-y-2.5">
                  {activity.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[8px] font-bold text-black mt-0.5"
                        style={{ backgroundColor: a.color }}
                      >
                        {a.user}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium text-white leading-none truncate">
                          {a.name}
                        </p>
                        <p className="text-[9px] text-neutral-600 mt-0.5">
                          {a.action} · {a.time}
                        </p>
                      </div>
                      <p
                        className="shrink-0 font-mono text-[10px] font-bold"
                        style={{ color: a.color }}
                      >
                        {a.amount}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────

const FeatureCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  desc: string;
  index: number;
  visible: boolean;
}> = ({ icon, title, desc, index, visible }) => (
  <div
    className={`group rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6 transition-all duration-300 hover:border-yellow-400/20 hover:bg-[#0e0e0e] ${
      visible ? "animate-fade-in-up opacity-100" : "opacity-0 translate-y-6"
    }`}
    style={{ animationDelay: `${index * 80}ms` }}
  >
    <div className="flex items-center justify-center w-10 h-10 mb-4 text-yellow-400 transition-all rounded-xl bg-yellow-400/10 group-hover:bg-yellow-400 group-hover:text-black">
      {icon}
    </div>
    <h3 className="text-[15px] font-semibold text-white mb-2">{title}</h3>
    <p className="text-[13.5px] leading-relaxed text-neutral-500">{desc}</p>
  </div>
);

// ─── Animated stat ────────────────────────────────────────────────────────────

const AnimatedStat: React.FC<{
  metric: StatMetric;
  active: boolean;
  resetKey: number;
  index: number;
}> = ({ metric, active, resetKey, index }) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    const dur = 1200 + index * 120;
    const start = performance.now();
    let id = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      setVal(metric.value * (1 - (1 - p) ** 2));
      if (p < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [index, active, metric.value, resetKey]);

  const fmt = (v: number) => {
    if (metric.format === "currency")
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(v);
    if (metric.format === "duration")
      return v.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
    return new Intl.NumberFormat("en-US").format(Math.round(v));
  };

  return (
    <div className="py-6 text-center group sm:text-left sm:py-0">
      <p className="font-mono text-3xl font-bold text-white sm:text-4xl tabular-nums">
        {fmt(active ? val : 0)}
        {metric.suffix && (
          <span className="ml-1 text-base font-semibold text-neutral-500">
            {metric.suffix}
          </span>
        )}
      </p>
      <p className="mt-1.5 text-[13px] text-neutral-500">{metric.label}</p>
      <div className="mt-3 h-[2px] w-8 bg-yellow-400/40 group-hover:w-full group-hover:bg-yellow-400 transition-all duration-500 mx-auto sm:mx-0" />
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Detecting overlay (shown while RPC calls run) ────────────────────────────

const DetectingOverlay: React.FC = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm px-4">
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-yellow-400" />
      <p className="text-[15px] font-semibold text-white">
        Checking your account…
      </p>
      <p className="text-[13px] text-neutral-600">
        Reading on-chain data from Stellar
      </p>
    </div>
  </div>
);

// ─── First-time onboarding (new users only) ───────────────────────────────────

const Onboarding: React.FC<{
  onChoose: (r: "employer" | "worker") => void;
}> = ({ onChoose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm px-4">
    <div className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#111] shadow-2xl overflow-hidden">
      {/* Yellow accent top */}
      <div className="h-[3px]" style={{ background: "#facc15" }} />

      <div className="p-8">
        {/* Logo */}
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div
            className="h-8 w-8 rounded-xl"
            style={{
              backgroundColor: "#facc15",
              WebkitMaskImage: "url('/quipay-icon-mark.png')",
              WebkitMaskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskImage: "url('/quipay-icon-mark.png')",
              maskSize: "contain",
              maskRepeat: "no-repeat",
            }}
          />
          <span
            className="text-[20px] font-bold text-white"
            style={{ letterSpacing: "-0.02em" }}
          >
            Quipay
          </span>
        </div>

        <h2 className="mb-2 text-center text-[22px] font-black text-white tracking-tight">
          Welcome to Quipay
        </h2>
        <p className="mb-8 text-center text-[14px] text-neutral-500">
          How will you use this account?
        </p>

        <div className="flex flex-col gap-3">
          {/* Employer */}
          <button
            onClick={() => onChoose("employer")}
            className="group flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-left transition-all hover:border-yellow-400/30 hover:bg-yellow-400/[0.04]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 group-hover:bg-yellow-400/20 transition-colors">
              <svg
                className="h-6 w-6 text-yellow-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              >
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                <line x1="12" y1="12" x2="12" y2="16" />
                <line x1="10" y1="14" x2="14" y2="14" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-bold text-white">
                I'm an Employer
              </p>
              <p className="text-[13px] text-neutral-500 mt-0.5">
                I pay workers — I'll create streams and manage my payroll vault
              </p>
            </div>
            <svg
              className="h-5 w-5 shrink-0 text-neutral-700 group-hover:text-yellow-400 transition-colors"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>

          {/* Worker */}
          <button
            onClick={() => onChoose("worker")}
            className="group flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-left transition-all hover:border-yellow-400/30 hover:bg-yellow-400/[0.04]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 group-hover:bg-yellow-400/20 transition-colors">
              <svg
                className="h-6 w-6 text-yellow-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-bold text-white">I'm a Worker</p>
              <p className="text-[13px] text-neutral-500 mt-0.5">
                I get paid — I'll register with my employer and track my
                earnings
              </p>
            </div>
            <svg
              className="h-5 w-5 shrink-0 text-neutral-700 group-hover:text-yellow-400 transition-colors"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <p className="mt-5 text-center text-[11px] text-neutral-700">
          Your role is determined by your on-chain activity and cannot be shared
          between accounts. Use separate wallets for each role.
        </p>
      </div>
    </div>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const Home: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { address } = useWallet();
  const { role, isDetecting, forceRole } = useRoleDetect(address);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!address) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowOnboarding(false);
      return;
    }
    if (isDetecting) return; // wait for on-chain check

    if (role === "employer") {
      void navigate("/dashboard", { replace: true });
    } else if (role === "worker") {
      void navigate("/worker", { replace: true });
    } else {
      // New user — no on-chain history yet, let them choose

      setShowOnboarding(true);
    }
  }, [address, role, isDetecting, navigate]);

  const handleOnboardingChoice = (chosen: "employer" | "worker") => {
    // Only cache — the real on-chain role will be set when they first
    // create a stream (employer) or register with employer (worker)
    forceRole(chosen);
    setShowOnboarding(false);
    if (chosen === "employer") void navigate("/dashboard", { replace: true });
    else void navigate("/worker", { replace: true });
  };

  const stats = useMemo<StatMetric[]>(
    () => [
      {
        id: "streams",
        label: "Payment streams created",
        value: 12480,
        format: "number",
      },
      {
        id: "value",
        label: "Total value streamed",
        value: 3847500,
        format: "currency",
        suffix: " USDC",
      },
      {
        id: "workers",
        label: "Workers paid on-chain",
        value: 1820,
        format: "number",
      },
      {
        id: "duration",
        label: "Avg stream duration",
        value: 6.4,
        format: "duration",
        suffix: " hrs",
      },
    ],
    [],
  );

  const [featuresVisible, setFeaturesVisible] = useState(false);
  const [workflowVisible, setWorkflowVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [statsResetKey, setStatsResetKey] = useState(0);

  const featuresRef = useRef<HTMLDivElement>(null);
  const workflowRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = (cb: () => void, el: Element | null, t = 0.15) => {
      const o = new IntersectionObserver((e) => e[0].isIntersecting && cb(), {
        threshold: t,
      });
      if (el) o.observe(el);
      return o;
    };
    const statsObs = new IntersectionObserver(
      (e) => {
        if (e[0].isIntersecting) {
          setStatsVisible(true);
          setStatsResetKey((k) => k + 1);
        } else setStatsVisible(false);
      },
      { threshold: 0.25 },
    );

    const fObs = obs(() => setFeaturesVisible(true), featuresRef.current);
    const wObs = obs(() => setWorkflowVisible(true), workflowRef.current);
    if (statsRef.current) statsObs.observe(statsRef.current);

    return () => {
      fObs.disconnect();
      wObs.disconnect();
      statsObs.disconnect();
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white bg-black">
      {/* ── Detecting overlay ────────────────────────────────── */}
      {address && isDetecting && <DetectingOverlay />}

      {/* ── First-time onboarding ─────────────────────────────── */}
      {showOnboarding && !isDetecting && (
        <Onboarding onChoose={handleOnboardingChoice} />
      )}

      {/* ── Subtle grid ──────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
        }}
      />

      <div className="relative z-10">
        {/* ════════════════════════════════════════════════════════
            HERO  —  Figma: node 826-2890
            Layout: column gap-10, padding 88px top/bottom 184px sides
            H1: 100px DemiBold, left-aligned, highlighted word in yellow
            CTA row: pill button + globe + trust text
        ════════════════════════════════════════════════════════ */}
        <section className="w-full px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-[1280px]">
            {/* ── Headline group ── */}
            <div className="flex flex-col gap-6 mb-10">
              <h1
                className="font-extrabold text-white leading-[1.1]"
                style={{
                  fontSize: "clamp(2.5rem, 5.5vw, 5rem)",
                  letterSpacing: "-0.02em",
                  maxWidth: "820px",
                }}
              >
                {t("home.title")}{" "}
                <span style={{ color: "#facc15" }}>{t("home.subtitle")}</span>
              </h1>

              <p
                className="text-neutral-400 font-medium leading-[1.5]"
                style={{
                  fontSize: "clamp(0.9rem, 1.2vw, 1.1rem)",
                  letterSpacing: "-0.01em",
                  maxWidth: "580px",
                }}
              >
                {t("home.description")}
              </p>
            </div>

            {/* ── CTA row ── */}
            <div className="flex flex-col items-start gap-10 sm:flex-row sm:items-center">
              {/* Primary pill button */}
              <button
                onClick={() => (window.location.href = "/dashboard")}
                className="inline-flex items-center justify-center rounded-full font-bold  bg-[#facc15] transition-all hover:opacity-90 active:scale-[0.97] shrink-0 px-10 py-4 text-[15px] text-black"
                // style={{ padding: "16px 28px", fontSize: "1rem", letterSpacing: "-0.01em", backgroundColor: "#facc15" }}
              >
                {t("home.launch_app")}
              </button>

              {/* Trust text + globe icon */}
              <div className="flex items-center gap-2">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ color: "#facc15" }}
                  className="shrink-0"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M3.6 9h16.8M3.6 15h16.8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 3c-2.5 3-4 5.5-4 9s1.5 6 4 9M12 3c2.5 3 4 5.5 4 9s-1.5 6-4 9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
                <p
                  className="text-[15px] leading-[145%]"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  <span className="font-normal text-neutral-500">
                    Pay workers compliantly in{" "}
                  </span>
                  <span style={{ color: "#facc15" }} className="font-semibold">
                    150+ countries
                  </span>
                </p>
              </div>
            </div>
          </div>
          {/* end max-w container */}
        </section>

        {/* ════════════════════════════════════════════════════════
            PRODUCT MOCKUP — full width, pinned below hero
        ════════════════════════════════════════════════════════ */}
        <section className="px-5 pb-24 sm:px-8">
          <div className="mx-auto max-w-[1280px]">
            <DashboardMockup />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            STATS
        ════════════════════════════════════════════════════════ */}
        <section
          ref={statsRef}
          className="border-y border-white/[0.06] bg-[#060606]"
        >
          <div className="max-w-6xl px-5 py-16 mx-auto sm:px-8 sm:py-20">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/[0.06]">
              {stats.map((m, i) => (
                <div key={m.id} className="px-6 sm:px-8 first:pl-0 last:pr-0">
                  <AnimatedStat
                    metric={m}
                    active={statsVisible}
                    resetKey={statsResetKey}
                    index={i}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            FEATURES
        ════════════════════════════════════════════════════════ */}
        <section ref={featuresRef} className="px-5 py-24 sm:px-8 sm:py-32">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-xl mb-14">
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-yellow-400 mb-3">
                Platform
              </p>
              <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold tracking-tight text-white mb-4">
                {t("home.why_choose")}
              </h2>
              <p className="text-[15px] leading-relaxed text-neutral-400">
                {t("home.why_choose_desc")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: (
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  ),
                  title: t("home.feature_1_title"),
                  desc: t("home.feature_1_desc"),
                },
                {
                  icon: (
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  ),
                  title: t("home.feature_2_title"),
                  desc: t("home.feature_2_desc"),
                },
                {
                  icon: (
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  ),
                  title: t("home.feature_3_title"),
                  desc: t("home.feature_3_desc"),
                },
                {
                  icon: (
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  ),
                  title: "Real-Time Payments",
                  desc: "Workers accrue salary every second. No more waiting for end-of-month payroll runs.",
                },
                {
                  icon: (
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  ),
                  title: "Audited Contracts",
                  desc: "Multi-sig smart contract vaults on Stellar. Every transaction on-chain, every penny verifiable.",
                },
                {
                  icon: (
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 8V4H8" />
                      <rect x="5" y="8" width="14" height="12" rx="2" />
                      <path d="M9 13h.01M15 13h.01" />
                      <path d="M12 20v2" />
                    </svg>
                  ),
                  title: "AI-Powered Automation",
                  desc: "Autonomous agents handle scheduling, compliance, and solvency monitoring — without manual input.",
                },
              ].map((f, i) => (
                <FeatureCard
                  key={f.title}
                  icon={f.icon}
                  title={f.title}
                  desc={f.desc}
                  index={i}
                  visible={featuresVisible}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            HOW IT WORKS
        ════════════════════════════════════════════════════════ */}
        <section
          ref={workflowRef}
          className="border-t border-white/[0.06] bg-[#060606] px-5 sm:px-8 py-20 sm:py-28"
        >
          <div className="mx-auto max-w-[1280px]">
            {/* Header */}
            <div className="mb-16 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p
                  className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "#facc15" }}
                >
                  How it works
                </p>
                <h2
                  className="font-extrabold text-white"
                  style={{
                    fontSize: "clamp(1.75rem, 4vw, 3rem)",
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  Up and running
                  <br className="hidden sm:block" /> in minutes
                </h2>
              </div>
              <p className="max-w-xs text-[14px] leading-relaxed text-neutral-500 sm:text-right">
                No technical setup required. Connect your wallet and stream
                payroll to your team in under 60 seconds.
              </p>
            </div>

            {/* Steps grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  n: "01",
                  title: "Fund Your Treasury",
                  desc: "Deposit XLM, USDC or any Stellar asset into your audited multi-sig smart contract vault. Full custody, fully on-chain.",
                  tag: "Secure",
                  icon: (
                    <svg
                      className="w-6 h-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  ),
                },
                {
                  n: "02",
                  title: "Create Payment Streams",
                  desc: "Set a per-second rate for each worker. Streams start instantly — no batching, no delays, no manual processing.",
                  tag: "Real-time",
                  icon: (
                    <svg
                      className="w-6 h-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    >
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  ),
                },
                {
                  n: "03",
                  title: "Workers Claim Anytime",
                  desc: "Team members withdraw their earned salary 24/7 directly to their Stellar wallet. No payslips, no waiting periods.",
                  tag: "Instant",
                  icon: (
                    <svg
                      className="w-6 h-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    >
                      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                    </svg>
                  ),
                },
                {
                  n: "04",
                  title: "AI Manages Compliance",
                  desc: "Autonomous agents monitor treasury solvency, enforce tax rules, and send payroll reports — without any manual input.",
                  tag: "Automated",
                  icon: (
                    <svg
                      className="w-6 h-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    >
                      <path d="M12 8V4H8" />
                      <rect x="5" y="8" width="14" height="12" rx="2" />
                      <path d="M9 13h.01M15 13h.01M12 20v2" />
                    </svg>
                  ),
                },
              ].map((step, i) => (
                <div
                  key={step.n}
                  className={`group relative flex flex-col rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6 transition-all duration-700 hover:border-yellow-400/20 hover:bg-[#0e0e0e] ${
                    workflowVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-8"
                  }`}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  {/* Step number — large background */}
                  <span
                    className="absolute right-5 top-4 font-black text-white/[0.04] select-none leading-none"
                    style={{ fontSize: "5rem" }}
                  >
                    {step.n}
                  </span>

                  {/* Icon */}
                  <div
                    className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.07] transition-colors group-hover:border-yellow-400/30"
                    style={{ color: "#facc15", backgroundColor: "#111" }}
                  >
                    {step.icon}
                  </div>

                  {/* Tag */}
                  <span
                    className="mb-4 inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                    style={{
                      backgroundColor: "rgba(250,204,21,0.08)",
                      color: "#facc15",
                    }}
                  >
                    {step.tag}
                  </span>

                  {/* Content */}
                  <h3 className="mb-2 text-[15px] font-bold text-white">
                    {step.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-neutral-500">
                    {step.desc}
                  </p>

                  {/* Bottom accent line */}
                  <div
                    className="absolute bottom-0 left-6 right-6 h-[1px] scale-x-0 rounded-full transition-transform duration-300 group-hover:scale-x-100"
                    style={{
                      backgroundColor: "#facc15",
                      transformOrigin: "left",
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Bottom connector row */}
            <div className="mt-10 flex items-center justify-center gap-3">
              {["Fund", "Stream", "Withdraw", "Automate"].map(
                (label, i, arr) => (
                  <React.Fragment key={label}>
                    <span className="text-[12px] font-semibold text-neutral-600">
                      {label}
                    </span>
                    {i < arr.length - 1 && (
                      <svg
                        className="h-3 w-3 text-neutral-800"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          d="M5 12H19M19 12L12 5M19 12L12 19"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </React.Fragment>
                ),
              )}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            CTA
        ════════════════════════════════════════════════════════ */}
        <section className="px-5 py-24 sm:px-8 sm:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-extrabold tracking-tight text-white mb-5">
              {t("home.cta_title")}
            </h2>
            <p className="mx-auto max-w-xl text-[15px] sm:text-[17px] leading-relaxed text-neutral-400 mb-10">
              {t("home.cta_subtitle")}
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-yellow-400 px-10 py-4 text-[15px] font-bold text-black transition-all hover:bg-yellow-300 hover:-translate-y-[1px] active:scale-[0.98]"
              >
                {t("home.launch_app")}
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    d="M5 12H19M19 12L12 5M19 12L12 19"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <Link
                to="/help"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04] px-10 py-4 text-[15px] font-semibold text-white transition-all hover:border-white/[0.22] hover:bg-white/[0.08]"
              >
                {t("home.view_docs")}
              </Link>
            </div>

            {/* Fine print */}
            <p className="mt-6 text-[12px] text-neutral-700">
              No credit card required · Free to get started · Non-custodial
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;
