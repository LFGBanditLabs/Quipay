import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import SocialProof from "../components/landing/SocialProof";

interface Stream {
  id: number;
  name: string;
  role: string;
  avatar: string;
  amount: number;
  rate: number;
  status: "streaming" | "paused" | "completed";
  color: string;
}

const mockStreams: Stream[] = [
  {
    id: 1,
    name: "Alice Chen",
    role: "Senior Engineer",
    avatar: "AC",
    amount: 1250,
    rate: 0.0034,
    status: "streaming",
    color: "from-indigo-500 to-purple-500",
  },
  {
    id: 2,
    name: "Bob Martinez",
    role: "Product Designer",
    avatar: "BM",
    amount: 980,
    rate: 0.0027,
    status: "streaming",
    color: "from-pink-500 to-rose-500",
  },
  {
    id: 3,
    name: "Carol Wu",
    role: "DevOps Lead",
    avatar: "CW",
    amount: 1420,
    rate: 0.0039,
    status: "paused",
    color: "from-emerald-500 to-teal-500",
  },
];

const particles = [
  { id: "p1", x: 12, y: 24, size: 4, delay: 0.2 },
  { id: "p2", x: 45, y: 67, size: 3, delay: 1.5 },
  { id: "p3", x: 78, y: 12, size: 5, delay: 0.8 },
  { id: "p4", x: 23, y: 89, size: 4, delay: 2.1 },
  { id: "p5", x: 56, y: 34, size: 6, delay: 1.2 },
  { id: "p6", x: 89, y: 56, size: 3, delay: 0.5 },
  { id: "p7", x: 34, y: 78, size: 5, delay: 1.8 },
  { id: "p8", x: 67, y: 23, size: 4, delay: 2.5 },
  { id: "p9", x: 12, y: 45, size: 3, delay: 0.3 },
  { id: "p10", x: 45, y: 12, size: 6, delay: 1.1 },
  { id: "p11", x: 78, y: 89, size: 4, delay: 2.2 },
  { id: "p12", x: 23, y: 56, size: 5, delay: 0.7 },
  { id: "p13", x: 56, y: 23, size: 3, delay: 1.9 },
  { id: "p14", x: 89, y: 78, size: 6, delay: 0.4 },
  { id: "p15", x: 34, y: 12, size: 4, delay: 2.3 },
  { id: "p16", x: 67, y: 45, size: 5, delay: 1.0 },
  { id: "p17", x: 12, y: 78, size: 3, delay: 0.6 },
  { id: "p18", x: 45, y: 56, size: 6, delay: 1.7 },
  { id: "p19", x: 78, y: 34, size: 4, delay: 2.4 },
  { id: "p20", x: 23, y: 23, size: 5, delay: 0.9 },
];

const tokenFlows = [
  { id: "t1", delay: 0, duration: 3.5, y: 15 },
  { id: "t2", delay: 0.8, duration: 4.2, y: 27 },
  { id: "t3", delay: 1.6, duration: 3.8, y: 39 },
  { id: "t4", delay: 2.4, duration: 4.5, y: 51 },
  { id: "t5", delay: 3.2, duration: 3.2, y: 63 },
  { id: "t6", delay: 4.0, duration: 4.8, y: 75 },
];

const TokenFlow: React.FC<{
  id: string;
  delay: number;
  duration: number;
  y: number;
}> = ({ delay, duration, y }) => (
  <div
    className="absolute pointer-events-none animate-token-flow"
    style={{
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
      top: `${y}%`,
    }}
  >
    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-indigo-500/20 to-pink-500/20 backdrop-blur-sm border border-white/10">
      <div className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-400 to-pink-400 animate-pulse-glow" />
      <span className="text-xs font-mono text-white/80">+0.0024</span>
    </div>
  </div>
);

const Particle: React.FC<{
  id: string;
  x: number;
  y: number;
  size: number;
  delay: number;
}> = ({ x, y, size, delay }) => (
  <div
    className="absolute rounded-full bg-gradient-to-r from-indigo-400/30 to-pink-400/30 animate-pulse-glow"
    style={{
      left: `${x}%`,
      top: `${y}%`,
      width: size,
      height: size,
      animationDelay: `${delay}s`,
    }}
  />
);

const StatusBadge: React.FC<{ status: Stream["status"] }> = ({ status }) => {
  const config = {
    streaming: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      label: "Streaming",
      dot: "bg-emerald-400",
    },
    paused: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      label: "Paused",
      dot: "bg-amber-400",
    },
    completed: {
      bg: "bg-blue-500/10",
      text: "text-blue-400",
      label: "Completed",
      dot: "bg-blue-400",
    },
  };

  const { bg, text, label, dot } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${dot} ${status === "streaming" ? "animate-pulse" : ""}`}
      />
      {label}
    </span>
  );
};

const StreamCard: React.FC<{ stream: Stream; index: number }> = ({
  stream,
  index,
}) => {
  const [amount, setAmount] = useState(stream.amount);

  useEffect(() => {
    if (stream.status !== "streaming") return;
    const interval = setInterval(() => {
      setAmount((prev) => prev + stream.rate);
    }, 1000);
    return () => clearInterval(interval);
  }, [stream.rate, stream.status]);

  return (
    <div
      className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border)] transition-all duration-300 hover:bg-[var(--surface)] hover:border-[var(--accent-transparent)] hover:shadow-lg group"
      style={{ animationDelay: `${index * 150}ms` }}
    >
      <div
        className={`flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${stream.color} font-bold text-sm text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}
      >
        {stream.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h4 className="text-sm font-medium text-[var(--text)] truncate">
            {stream.name}
          </h4>
          <StatusBadge status={stream.status} />
        </div>
        <p className="text-xs text-[var(--muted)]">{stream.role}</p>
      </div>
      <div className="text-right">
        <span className="block font-mono text-base font-semibold text-emerald-400 tabular-nums">
          + {amount.toFixed(4)}
        </span>
        <span className="text-[10px] text-[var(--muted)] uppercase tracking-wide">
          USDC
        </span>
      </div>
    </div>
  );
};

const MobileStreamCard: React.FC<{ stream: Stream }> = ({ stream }) => (
  <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5">
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-[var(--text)]">
        {stream.name}
      </p>
      <p className="text-[11px] text-[var(--muted)]">{stream.role}</p>
    </div>
    <div className="text-right">
      <p className="text-sm font-semibold text-emerald-400">
        +{stream.amount.toFixed(2)}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
        USDC
      </p>
    </div>
  </div>
);

const FeatureCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  index: number;
  isVisible: boolean;
}> = ({ icon, title, description, index, isVisible }) => (
  <div
    className={`group relative bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-8 backdrop-blur-md transition-all duration-500 hover:-translate-y-2 hover:bg-[var(--surface-subtle)] hover:shadow-[0_20px_40px_-10px_var(--shadow-color)] ${
      isVisible ? "animate-fade-in-up" : "opacity-0 translate-y-8"
    }`}
    style={{ animationDelay: `${index * 100}ms` }}
  >
    <div className="absolute inset-0 rounded-3xl p-[1px] bg-gradient-to-b from-white/15 to-transparent style-mask-border pointer-events-none" />
    <div className="w-14 h-14 flex items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 mb-6 transition-all duration-300 group-hover:bg-indigo-500 group-hover:text-white group-hover:scale-110 group-hover:rotate-6">
      {icon}
    </div>
    <h3 className="text-xl font-semibold mb-4 text-[var(--text)]">{title}</h3>
    <p className="text-base leading-relaxed text-[var(--muted)] m-0">
      {description}
    </p>
  </div>
);

const WorkflowStep: React.FC<{
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isActive: boolean;
  index: number;
}> = ({ number, title, description, icon, isActive, index }) => (
  <div
    className={`relative flex flex-col items-center text-center transition-all duration-1000 ${
      isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
    }`}
    style={{ transitionDelay: `${index * 200}ms` }}
  >
    <div className="relative mb-6 group">
      <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full scale-0 group-hover:scale-150 transition-transform duration-500 opacity-50" />
      <div className="relative z-10 w-20 h-20 flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-400/20 text-indigo-400 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-sm transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 group-hover:border-indigo-400/40 group-hover:shadow-indigo-500/20 group-hover:shadow-2xl">
        {icon}
      </div>
      <div className="absolute -top-3 -right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 text-white text-sm font-bold border-4 border-[var(--bg)] shadow-lg group-hover:scale-110 transition-transform duration-300">
        {number}
      </div>
    </div>
    <h3 className="text-xl font-bold mb-3 text-[var(--text)] transition-colors duration-300 group-hover:text-indigo-400">
      {title}
    </h3>
    <p className="text-sm text-[var(--muted)] max-w-[200px] leading-relaxed">
      {description}
    </p>
  </div>
);

interface StatMetric {
  id: string;
  label: string;
  value: number;
  format: "number" | "currency" | "duration";
  suffix?: string;
}

const stats: StatMetric[] = [
  {
    id: "streams",
    label: "Total Streams",
    value: 12480,
    format: "number",
  },
  {
    id: "value-streamed",
    label: "Total Value Streamed",
    value: 3847500,
    format: "currency",
    suffix: " USDC",
  },
  {
    id: "active-workers",
    label: "Active Workers",
    value: 1820,
    format: "number",
  },
  {
    id: "avg-duration",
    label: "Avg. Stream Duration",
    value: 6.4,
    format: "duration",
    suffix: " hrs",
  },
];

const formatStatValue = (value: number, format: StatMetric["format"]) => {
  if (format === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (format === "duration") {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US").format(Math.round(value));
};

const AnimatedStat: React.FC<{
  metric: StatMetric;
  isActive: boolean;
  resetKey: number;
  index: number;
}> = ({ metric, isActive, resetKey, index }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const renderedValue = isActive ? displayValue : 0;

  useEffect(() => {
    if (!isActive) return;

    const duration = 1300 + index * 150;
    const start = performance.now();
    let frameId = 0;

    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplayValue(metric.value * eased);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [index, isActive, metric.value, resetKey]);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/15 bg-[var(--surface)]/90 p-5 shadow-[0_12px_35px_-20px_var(--shadow-color)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400/40 sm:p-6">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/15 via-transparent to-pink-500/15 opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute -inset-[1px] rounded-2xl border border-indigo-400/20 opacity-50 transition-opacity duration-300 group-hover:opacity-90" />
      <div className="absolute -left-8 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full bg-indigo-500/20 blur-2xl" />
      <div className="relative">
        <p className="mb-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          {metric.label}
        </p>
        <p className="font-mono text-2xl font-semibold tabular-nums text-[var(--text)] sm:text-3xl">
          {formatStatValue(renderedValue, metric.format)}
          {metric.suffix ? (
            <span className="ml-1 text-sm font-medium text-[var(--muted)] sm:text-base">
              {metric.suffix}
            </span>
          ) : null}
        </p>
      </div>
    </article>
  );
};

const Home: React.FC = () => {
  const [scrollY, setScrollY] = useState(0);
  const [featuresVisible, setFeaturesVisible] = useState(false);
  const [workflowVisible, setWorkflowVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [statsResetKey, setStatsResetKey] = useState(0);
  const featuresRef = useRef<HTMLDivElement>(null);
  const workflowRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setFeaturesVisible(true);
          }
        });
      },
      { threshold: 0.2 },
    );

    const workflowObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setWorkflowVisible(true);
          }
        });
      },
      { threshold: 0.2 },
    );

    const statsObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStatsVisible(true);
            setStatsResetKey((prev) => prev + 1);
            return;
          }
          setStatsVisible(false);
        });
      },
      { threshold: 0.35 },
    );

    window.addEventListener("scroll", handleScroll, { passive: true });

    if (featuresRef.current) {
      observer.observe(featuresRef.current);
    }
    if (workflowRef.current) {
      workflowObserver.observe(workflowRef.current);
    }
    if (statsRef.current) {
      statsObserver.observe(statsRef.current);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
      workflowObserver.disconnect();
      statsObserver.disconnect();
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[var(--bg)] font-sans text-[var(--text)]">
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px),
                            linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, var(--bg) 0%, transparent 80%)",
          maskImage:
            "radial-gradient(ellipse at center, var(--bg) 0%, transparent 80%)",
        }}
      />

      <div
        className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full blur-[100px] bg-[radial-gradient(circle,var(--accent-transparent-strong),transparent_70%)] opacity-30 z-0 animate-float"
        style={{ transform: `translateY(${scrollY * 0.05}px)` }}
      />
      <div
        className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full blur-[100px] bg-[radial-gradient(circle,rgba(236,72,153,0.15),transparent_70%)] opacity-20 z-0 animate-float"
        style={{ transform: `translateY(${scrollY * -0.03}px)` }}
      />
      <div
        className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] rounded-full blur-[100px] bg-[radial-gradient(circle,var(--success-transparent-strong),transparent_70%)] opacity-20 z-0 animate-float"
        style={{ transform: `translateY(${scrollY * 0.02}px)` }}
      />

      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {particles.map((p) => (
          <Particle key={p.id} {...p} />
        ))}
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 hidden lg:block">
        {tokenFlows.map((tf) => (
          <TokenFlow key={tf.id} {...tf} />
        ))}
      </div>

      <div className="absolute top-1/4 right-0 w-96 h-96 opacity-20 pointer-events-none z-0 hidden xl:block animate-spin-slow">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#f472b6" stopOpacity="0.5" />
            </linearGradient>
          </defs>
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke="url(#grad1)"
            strokeWidth="0.5"
            strokeDasharray="10 5"
          />
          <circle
            cx="100"
            cy="100"
            r="60"
            fill="none"
            stroke="url(#grad1)"
            strokeWidth="0.5"
            strokeDasharray="15 5"
          />
          <circle
            cx="100"
            cy="100"
            r="40"
            fill="none"
            stroke="url(#grad1)"
            strokeWidth="0.5"
            strokeDasharray="5 10"
          />
        </svg>
      </div>

      <main className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-4 sm:px-6 lg:px-8">
        <section className="max-w-4xl animate-slide-up pb-12 pt-20 text-center sm:pt-24">
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--surface-subtle)] border border-[var(--border)] backdrop-blur-md shadow-[0_4px_20px_var(--shadow-color),inset_0_0_0_1px_var(--border)] transition-all duration-300 hover:bg-[var(--surface)] hover:border-[var(--accent-transparent)] hover:-translate-y-[2px]">
              <span className="animate-bounce-subtle">✨</span>
              <span className="text-sm font-medium tracking-wide text-[var(--muted)]">
                Welcome to Quipay 2.0
              </span>
            </div>
          </div>

          <h1 className="text-[clamp(2.5rem,7vw,5rem)] font-extrabold leading-[1.1] tracking-tight mb-6 text-[var(--text)]">
            The Future of
            <br />
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Decentralized Payroll
              </span>
              <svg
                className="absolute -bottom-2 left-0 w-full h-3 text-indigo-400/30"
                viewBox="0 0 300 12"
                preserveAspectRatio="none"
              >
                <path
                  d="M0 6 Q 75 0, 150 6 T 300 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="animate-pulse-glow"
                />
              </svg>
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-[clamp(1rem,2vw,1.25rem)] leading-relaxed text-[var(--muted)]">
            Experience seamless, continuous streaming payments built on Stellar.
            Manage your treasury automatically with AI-driven compliance.
            Empower your workforce with real-time capital access.
          </p>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              to="/dashboard"
              className="group relative inline-flex min-h-11 items-center justify-center gap-3 overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 to-pink-500 px-8 py-4 text-lg font-semibold text-white transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_20px_40px_-10px_rgba(236,72,153,0.6)] shadow-[0_10px_30px_-10px_rgba(236,72,153,0.5)]"
            >
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="relative z-10">Launch App</span>
              <svg
                className="relative z-10 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M5 12H19M19 12L12 5M19 12L12 19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>

            <Link
              to="/help"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-8 py-4 text-lg font-semibold text-[var(--text)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent-transparent)] hover:bg-[var(--surface)] hover:shadow-[0_10px_30px_-10px_var(--shadow-color)]"
            >
              View Documentation
            </Link>
          </div>
        </section>
        <SocialProof />

        <section
          className="my-8 mb-20 flex w-full justify-center"
          style={{ perspective: "1000px" }}
        >
          <div className="hidden w-full max-w-2xl animate-float-panel overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 shadow-[0_30px_60px_-15px_var(--shadow-color),inset_0_1px_0_var(--border)] backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:border-[var(--accent-transparent)] hover:shadow-[0_40px_80px_-20px_var(--shadow-color)] md:block">
            <div className="flex items-center px-5 py-3 bg-[var(--surface-subtle)] border-b border-[var(--border)]">
              <div className="flex gap-1.5 mr-auto">
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--sds-color-feedback-error)]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--sds-color-feedback-warning)]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--sds-color-feedback-success)]" />
              </div>
              <div className="text-xs font-medium text-[var(--muted)] tracking-wide uppercase mx-auto -translate-x-[24px]">
                Active Streams
              </div>
              <span className="text-xs font-mono text-emerald-400 animate-counter-pulse">
                ● LIVE
              </span>
            </div>

            <div className="p-4 space-y-2">
              {mockStreams.map((stream, index) => (
                <StreamCard key={stream.id} stream={stream} index={index} />
              ))}
            </div>

            <div className="px-4 pb-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-indigo-500/5 to-pink-500/5 border border-[var(--border)]">
                <span className="text-xs text-[var(--muted)]">
                  Total streaming this month
                </span>
                <span className="font-mono text-sm font-semibold bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-transparent">
                  $12,847.50 USDC
                </span>
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 shadow-[0_20px_40px_-20px_var(--shadow-color)] backdrop-blur md:hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Live Payroll
              </span>
              <span className="text-xs font-mono text-emerald-400">● LIVE</span>
            </div>
            <div className="space-y-2 p-3">
              {mockStreams.slice(0, 2).map((stream) => (
                <MobileStreamCard key={stream.id} stream={stream} />
              ))}
            </div>
            <div className="border-t border-[var(--border)] px-3 py-2.5">
              <p className="text-xs text-[var(--muted)]">
                Total streaming this month
              </p>
              <p className="font-mono text-sm font-semibold text-indigo-400">
                $12,847.50 USDC
              </p>
            </div>
          </div>
        </section>

        <section ref={statsRef} className="w-full pb-10 pt-4 sm:pb-14 sm:pt-6">
          <div className="mb-8 text-center">
            <h2 className="mb-3 text-2xl font-bold text-[var(--text)] sm:text-3xl">
              Protocol By The Numbers
            </h2>
            <p className="mx-auto max-w-2xl text-sm text-[var(--muted)] sm:text-base">
              Real-time metrics from Quipay streams across teams, treasuries,
              and active contributors.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((metric, index) => (
              <AnimatedStat
                key={metric.id}
                index={index}
                isActive={statsVisible}
                metric={metric}
                resetKey={statsResetKey}
              />
            ))}
          </div>
        </section>

        <section
          ref={workflowRef}
          className="w-full py-20 relative overflow-hidden"
        >
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-[var(--text)] mb-4">
              How Quipay Works
            </h2>
            <p className="text-lg text-[var(--muted)] max-w-2xl mx-auto">
              A streamlined, automated payroll experience in 4 simple steps
            </p>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-4 gap-16 md:gap-8 px-4">
            {/* Connecting Lines for Desktop */}
            <div className="hidden md:block absolute top-[40px] left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-indigo-500/10 via-purple-500/20 to-pink-500/10 z-0">
              <div
                className={`h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-[2000ms] ease-out shadow-[0_0_10px_var(--accent)] ${
                  workflowVisible ? "w-full" : "w-0"
                }`}
              />
            </div>

            {/* Step 1: Fund Your Treasury */}
            <WorkflowStep
              number="01"
              title="Fund Your Treasury"
              description="Securely deposit assets into our audited multi-sig smart contract vaults."
              icon={
                <svg
                  className="w-10 h-10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
                </svg>
              }
              isActive={workflowVisible}
              index={0}
            />

            {/* Mobile Divider 1 */}
            <div className="md:hidden flex justify-center -my-8 opacity-20">
              <div className="w-[2px] h-16 bg-gradient-to-b from-indigo-500 to-purple-500" />
            </div>

            {/* Step 2: Create Payment Streams */}
            <WorkflowStep
              number="02"
              title="Create Payment Streams"
              description="Set up continuous, real-time token flows for your global contributors."
              icon={
                <svg
                  className="w-10 h-10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                  <path d="M22 12l-2 0m-16 0l-2 0m10-10l0 2m0 16l0 2" />
                </svg>
              }
              isActive={workflowVisible}
              index={1}
            />

            {/* Mobile Divider 2 */}
            <div className="md:hidden flex justify-center -my-8 opacity-20">
              <div className="w-[2px] h-16 bg-gradient-to-b from-purple-500 to-pink-500" />
            </div>

            {/* Step 3: Workers Withdraw Anytime */}
            <WorkflowStep
              number="03"
              title="Workers Withdraw Anytime"
              description="Empower your team with instant access to their earned capital, 24/7."
              icon={
                <svg
                  className="w-10 h-10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                  <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                </svg>
              }
              isActive={workflowVisible}
              index={2}
            />

            {/* Mobile Divider 3 */}
            <div className="md:hidden flex justify-center -my-8 opacity-20">
              <div className="w-[2px] h-16 bg-gradient-to-b from-pink-500 to-indigo-500" />
            </div>

            {/* Step 4: AI Manages Everything */}
            <WorkflowStep
              number="04"
              title="AI Manages Everything"
              description="Autonomous agents handle tax rules, solvency, and payroll compliance."
              icon={
                <svg
                  className="w-10 h-10"
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
              }
              isActive={workflowVisible}
              index={3}
            />
          </div>
        </section>

        <section ref={featuresRef} className="w-full pb-24 pt-12 sm:pt-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[var(--text)] mb-4">
              Why Choose Quipay?
            </h2>
            <p className="text-[var(--muted)] max-w-xl mx-auto">
              Built for the future of work, powered by cutting-edge blockchain
              technology
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              index={0}
              isVisible={featuresVisible}
              icon={
                <svg
                  className="w-7 h-7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
              title="Continuous Streaming"
              description="Money flows fluidly into wallets, eliminating the painful wait for payday. Watch earnings grow by the second."
            />
            <FeatureCard
              index={1}
              isVisible={featuresVisible}
              icon={
                <svg
                  className="w-7 h-7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              }
              title="On-Chain Treasury"
              description="Fully transparent smart contract vaults powered by Soroban. Self-custody with zero counterparty risk."
            />
            <FeatureCard
              index={2}
              isVisible={featuresVisible}
              icon={
                <svg
                  className="w-7 h-7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              }
              title="Automated AI Agent"
              description="Autonomous AI handles stream calculations, dynamic pause rules, and real-time solvency checks."
            />
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;
