import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";

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

const Home: React.FC = () => {
  const [scrollY, setScrollY] = useState(0);
  const [featuresVisible, setFeaturesVisible] = useState(false);
  const featuresRef = useRef<HTMLDivElement>(null);

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

    window.addEventListener("scroll", handleScroll, { passive: true });

    if (featuresRef.current) {
      observer.observe(featuresRef.current);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans overflow-hidden">
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

      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 flex flex-col items-center">
        <section className="pt-24 pb-12 text-center max-w-4xl animate-slide-up">
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--surface-subtle)] border border-[var(--border)] backdrop-blur-md shadow-[0_4px_20px_var(--shadow-color),inset_0_0_0_1px_var(--border)] transition-all duration-300 hover:bg-[var(--surface)] hover:border-[var(--accent-transparent)] hover:-translate-y-[2px]">
              <span className="animate-bounce-subtle">✨</span>
              <span className="text-sm font-medium text-[var(--muted)] tracking-wide">
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

          <p className="text-[clamp(1rem,2vw,1.25rem)] leading-relaxed text-[var(--muted)] max-w-2xl mx-auto mb-10">
            Experience seamless, continuous streaming payments built on Stellar.
            Manage your treasury automatically with AI-driven compliance.
            Empower your workforce with real-time capital access.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/dashboard"
              className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-br from-indigo-600 to-pink-500 text-white font-semibold text-lg overflow-hidden transition-all duration-300 shadow-[0_10px_30px_-10px_rgba(236,72,153,0.5)] hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_20px_40px_-10px_rgba(236,72,153,0.6)]"
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
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] text-[var(--text)] font-semibold text-lg backdrop-blur-md transition-all duration-300 hover:bg-[var(--surface)] hover:border-[var(--accent-transparent)] hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_var(--shadow-color)]"
            >
              View Documentation
            </Link>
          </div>
        </section>

        <section
          className="w-full flex justify-center my-8 mb-20"
          style={{ perspective: "1000px" }}
        >
          <div className="w-full max-w-2xl bg-[var(--surface)]/80 border border-[var(--border)] rounded-3xl backdrop-blur-xl shadow-[0_30px_60px_-15px_var(--shadow-color),inset_0_1px_0_var(--border)] overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:border-[var(--accent-transparent)] hover:shadow-[0_40px_80px_-20px_var(--shadow-color)] animate-float-panel">
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
        </section>

        <section ref={featuresRef} className="w-full py-16 pb-24">
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
