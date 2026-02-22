import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const Home: React.FC = () => {
  const [streamAmount, setStreamAmount] = useState(1337.0425);

  useEffect(() => {
    const interval = setInterval(() => {
      setStreamAmount((prev) => prev + 0.0034);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#050505] text-white font-sans overflow-hidden">
      {/* Background Grid */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 80%)",
          maskImage:
            "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 80%)",
        }}
      ></div>

      {/* Glowing Orbs */}
      <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full blur-[100px] bg-[radial-gradient(circle,rgba(99,102,241,0.4),transparent_70%)] opacity-50 z-0 animate-[float_10s_ease-in-out_infinite]"></div>
      <div className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full blur-[100px] bg-[radial-gradient(circle,rgba(236,72,153,0.2),transparent_70%)] opacity-50 z-0 animate-[float_10s_ease-in-out_infinite_-3s]"></div>
      <div className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] rounded-full blur-[100px] bg-[radial-gradient(circle,rgba(16,185,129,0.15),transparent_70%)] opacity-50 z-0 animate-[float_10s_ease-in-out_infinite_-7s]"></div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 flex flex-col items-center">
        {/* Hero Section */}
        <section className="pt-32 pb-16 text-center max-w-4xl animate-[slideUp_1s_cubic-bezier(0.16,1,0.3,1)_forwards]">
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(255,255,255,0.05)] transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:-translate-y-[2px]">
              <span>✨</span>
              <span className="text-sm font-medium text-slate-200 tracking-wide">
                Welcome to Quipay 2.0
              </span>
            </div>
          </div>

          <h1 className="text-[clamp(3.5rem,8vw,6rem)] font-extrabold leading-[1.05] tracking-tight mb-8 text-white">
            The Future of <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Decentralized Payroll
            </span>
          </h1>

          <p className="text-[clamp(1.1rem,2.5vw,1.35rem)] leading-relaxed text-slate-400 max-w-3xl mx-auto mb-14">
            Experience seamless, continuous streaming payments built on Stellar.
            Manage your treasury automatically with AI-driven compliance.
            Empower your workforce with real-time capital access.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link
              to="/dashboard"
              className="group relative inline-flex items-center justify-center gap-3 px-10 py-4 rounded-xl bg-gradient-to-br from-indigo-600 to-pink-500 text-white font-semibold text-lg overflow-hidden transition-all duration-300 shadow-[0_10px_30px_-10px_rgba(236,72,153,0.5)] hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_20px_40px_-10px_rgba(236,72,153,0.6)] z-10"
            >
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-400 opacity-0 transition-opacity duration-300 -z-10 group-hover:opacity-100"></div>
              <span>Launch App</span>
              <svg
                className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
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
              className="inline-flex items-center justify-center px-10 py-4 rounded-xl bg-white/5 border border-white/10 text-slate-200 font-semibold text-lg backdrop-blur-md transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]"
            >
              View Documentation
            </Link>
          </div>
        </section>

        {/* Floating UI Showcase */}
        <section
          className="w-full flex justify-center my-12 mb-32 hidden md:flex"
          style={{ perspective: "1000px" }}
        >
          <div
            className="w-full max-w-2xl bg-[#141419]/60 border border-white/10 rounded-3xl backdrop-blur-xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden transition-all duration-500 hover:rotate-x-0 hover:-translate-y-3 hover:border-white/20 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.2)] animate-[floatPanel_6s_ease-in-out_infinite_alternate]"
            style={{ transform: "rotateX(5deg)" }}
          >
            <div className="flex items-center px-6 py-4 bg-black/20 border-b border-white/5">
              <div className="flex gap-1.5 mr-auto">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              </div>
              <div className="text-[13px] font-medium text-slate-400 tracking-wide uppercase mx-auto -translate-x-[24px]">
                Active Quipay Stream
              </div>
            </div>

            <div className="p-8">
              <div className="flex items-center gap-6 p-4 rounded-2xl bg-white/5 border border-white/5 transition-colors duration-300 hover:bg-white/10">
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl font-bold text-lg text-white shadow-[0_4px_10px_rgba(99,102,241,0.3)]">
                  AL
                </div>
                <div>
                  <h4 className="m-0 mb-1 text-lg text-slate-50">
                    Alice (Engineer)
                  </h4>
                  <p className="m-0 text-sm text-slate-400">
                    1,250 USDC / month
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <span className="block font-['Inconsolata'] text-xl font-semibold text-emerald-400 mb-1 animate-[counterPulse_1s_ease-in-out_infinite]">
                    + {streamAmount.toFixed(4)} USDC
                  </span>
                  <span className="block text-xs text-slate-400 uppercase tracking-wide">
                    Streaming...
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full py-16 pb-32">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group relative bg-[#141419]/40 border border-white/5 rounded-3xl p-10 backdrop-blur-md transition-all duration-400 hover:-translate-y-2 hover:bg-[#1e1e28]/60 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)]">
              <div className="absolute inset-0 rounded-3xl p-[1px] bg-gradient-to-b from-white/15 to-transparent style-mask-border pointer-events-none"></div>
              <div className="w-14 h-14 flex items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 mb-6 transition-all duration-300 group-hover:bg-indigo-500 group-hover:text-white group-hover:scale-110 group-hover:rotate-6">
                <svg
                  className="w-7 h-7"
                  style={{ width: "28px", height: "28px" }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-4 text-slate-100">
                Continuous Streaming
              </h3>
              <p className="text-base leading-relaxed text-slate-400 m-0">
                Money flows fluidly into wallets, eliminating the painful wait
                for payday. Employees watch their earnings grow by the second.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group relative bg-[#141419]/40 border border-white/5 rounded-3xl p-10 backdrop-blur-md transition-all duration-400 hover:-translate-y-2 hover:bg-[#1e1e28]/60 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)]">
              <div className="absolute inset-0 rounded-3xl p-[1px] bg-gradient-to-b from-white/15 to-transparent style-mask-border pointer-events-none"></div>
              <div className="w-14 h-14 flex items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 mb-6 transition-all duration-300 group-hover:bg-indigo-500 group-hover:text-white group-hover:scale-110 group-hover:rotate-6">
                <svg
                  className="w-7 h-7"
                  style={{ width: "28px", height: "28px" }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-4 text-slate-100">
                On-Chain Treasury
              </h3>
              <p className="text-base leading-relaxed text-slate-400 m-0">
                Fully transparent and verifiable smart contract vaults powered
                by Soroban. Self-custody your funds with zero counterparty risk.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group relative bg-[#141419]/40 border border-white/5 rounded-3xl p-10 backdrop-blur-md transition-all duration-400 hover:-translate-y-2 hover:bg-[#1e1e28]/60 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)]">
              <div className="absolute inset-0 rounded-3xl p-[1px] bg-gradient-to-b from-white/15 to-transparent style-mask-border pointer-events-none"></div>
              <div className="w-14 h-14 flex items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 mb-6 transition-all duration-300 group-hover:bg-indigo-500 group-hover:text-white group-hover:scale-110 group-hover:-rotate-6">
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
              </div>
              <h3 className="text-xl font-semibold mb-4 text-slate-100">
                Automated AI Agent
              </h3>
              <p className="text-base leading-relaxed text-slate-400 m-0">
                Let an autonomous AI agent handle the complex stream
                calculations, dynamic pause rules, and real-time solvency
                checks.
              </p>
            </div>
          </div>
        </section>
      </main>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatPanel {
          0% { transform: rotateX(5deg) translateY(0); }
          100% { transform: rotateX(5deg) translateY(-15px); }
        }
        @keyframes counterPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .style-mask-border {
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
        }
      `}</style>
    </div>
  );
};

export default Home;
