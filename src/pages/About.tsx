import { Link } from "react-router-dom";

// ─── Data ─────────────────────────────────────────────────────────────────────

const MISSION_POINTS = [
  {
    icon: (
      <svg
        className="h-6 w-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: "Real-time payments",
    body: "Money flows every second. Workers don't wait for monthly payroll cycles — they earn continuously as they work.",
  },
  {
    icon: (
      <svg
        className="h-6 w-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: "Trustless by design",
    body: "Smart contracts on Stellar hold funds in escrow. No employer can withhold pay — the protocol enforces the agreement.",
  },
  {
    icon: (
      <svg
        className="h-6 w-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "Non-custodial",
    body: "We never hold your funds. You connect your own Stellar wallet. You control your keys — always.",
  },
  {
    icon: (
      <svg
        className="h-6 w-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    title: "Borderless",
    body: "Stellar settles in 3–5 seconds anywhere in the world. Pay contractors across continents at near-zero cost.",
  },
];

const TEAM = [
  {
    name: "Ekezie Uchechukwu",
    role: "Founder & Protocol Engineer",
    initials: "EU",
    bio: "Blockchain engineer focused on DeFi primitives and payment infrastructure on Stellar.",
    twitter: "#",
    github: "#",
  },
  {
    name: "Core Contributors",
    role: "Open Source Community",
    initials: "CC",
    bio: "Quipay is being built in the open. Developers, auditors, and designers contributing from around the world.",
    twitter: "#",
    github: "https://github.com",
  },
];

const TIMELINE = [
  {
    year: "Q1 2025",
    label: "Concept & Research",
    note: "Identified gaps in Stellar payroll infra",
  },
  {
    year: "Q2 2025",
    label: "Smart Contract v0",
    note: "First Soroban streaming contract on testnet",
  },
  {
    year: "Q3 2025",
    label: "Frontend MVP",
    note: "Dashboard, worker portal, and workforce registry",
  },
  {
    year: "Q4 2025",
    label: "Open Source Launch",
    note: "Public repo, contributor program launched",
  },
  {
    year: "Q1 2026",
    label: "Mainnet Beta",
    note: "Live streams on Stellar mainnet with real funds",
  },
  {
    year: "Q2 2026",
    label: "Multi-token & Governance",
    note: "DAO voting, custom token support, audit complete",
  },
];

const VALUES = [
  {
    label: "Transparency",
    body: "Every transaction is on-chain and verifiable by anyone. No black boxes.",
  },
  {
    label: "Simplicity",
    body: "One form, three steps, a live stream. Complexity lives in the protocol, not the UX.",
  },
  {
    label: "Ownership",
    body: "Workers own their earnings the moment they're streamed. Employers own the contract rules.",
  },
  {
    label: "Open Source",
    body: "All contracts and frontend code are public. Fork it. Audit it. Contribute to it.",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/[0.06] px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-widest text-yellow-400">
      {children}
    </p>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function About() {
  return (
    <div className="bg-black text-white">
      {/* ─── Hero ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/[0.06] py-28 px-6">
        {/* Background glow */}
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full opacity-[0.06]"
          style={{
            background: "radial-gradient(circle, #facc15 0%, transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-[860px] text-center">
          <SectionLabel>About Quipay</SectionLabel>
          <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-black leading-[1.05] tracking-[-0.03em] text-white">
            Payroll should flow
            <br />
            <span style={{ color: "#facc15" }}>like water.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[640px] text-[17px] leading-relaxed text-neutral-500">
            Quipay is a real-time payroll streaming protocol built on Stellar.
            We eliminate the wait between work and pay — turning monthly salary
            cycles into continuous, per-second earnings.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97]"
              style={{ backgroundColor: "#facc15" }}
            >
              Get started
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-6 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.08]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.1.82-.26.82-.58v-2.03c-3.34.72-4.04-1.61-4.04-1.61-.54-1.38-1.33-1.74-1.33-1.74-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.48.99.1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.13 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57C20.57 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0z" />
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ─── Mission pillars ───────────────────────────────────────── */}
      <section className="border-b border-white/[0.06] py-24 px-6">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-14 text-center">
            <SectionLabel>Our Mission</SectionLabel>
            <h2 className="text-[clamp(1.8rem,4vw,2.75rem)] font-black tracking-[-0.025em] text-white">
              Built on four principles
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MISSION_POINTS.map(({ icon, title, body }) => (
              <div
                key={title}
                className="flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6"
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: "rgba(250,204,21,0.1)",
                    color: "#facc15",
                  }}
                >
                  {icon}
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-white mb-1.5">
                    {title}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-neutral-500">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Stats band ────────────────────────────────────────────── */}
      <section className="border-b border-white/[0.06] py-16 px-6">
        <div className="mx-auto max-w-[1100px] grid grid-cols-2 gap-6 sm:grid-cols-4">
          {[
            { value: "< 5s", label: "Settlement time" },
            { value: "$0.001", label: "Avg transaction fee" },
            { value: "100%", label: "Non-custodial" },
            { value: "Open", label: "Source code" },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <p
                className="text-[clamp(1.8rem,4vw,2.5rem)] font-black"
                style={{ color: "#facc15" }}
              >
                {value}
              </p>
              <p className="mt-1 text-[13px] font-medium text-neutral-600">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Story / Why Stellar ───────────────────────────────────── */}
      <section className="border-b border-white/[0.06] py-24 px-6">
        <div className="mx-auto max-w-[1100px] grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionLabel>Why Stellar</SectionLabel>
            <h2 className="text-[clamp(1.8rem,4vw,2.75rem)] font-black tracking-[-0.025em] text-white mb-6">
              The right chain for payments
            </h2>
            <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-neutral-500">
              <p>
                Most blockchains are designed for speculation. Stellar was
                designed for payments. It settles in 3–5 seconds, costs
                fractions of a cent per transaction, and has native asset
                issuance baked in.
              </p>
              <p>
                Soroban — Stellar's smart contract layer — lets us build
                streaming payment logic that executes on-chain without
                custodians. The result: payroll that's as fast as the internet,
                as trustless as math.
              </p>
              <p>
                We chose Stellar because workers in emerging markets shouldn't
                wait a month for wages, and because every dollar lost to wire
                fees or currency conversion is a dollar stolen from a worker.
              </p>
            </div>
          </div>

          {/* Visual — Stellar protocol card */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6">
            <p className="mb-6 text-[11px] font-bold uppercase tracking-widest text-neutral-700">
              Protocol Stack
            </p>
            <div className="flex flex-col gap-3">
              {[
                {
                  layer: "Quipay UI",
                  sub: "React · TypeScript · Tailwind",
                  color: "#facc15",
                },
                {
                  layer: "Soroban Contracts",
                  sub: "Streaming escrow · Payroll logic",
                  color: "#facc15",
                },
                {
                  layer: "Stellar Network",
                  sub: "3–5s finality · $0.001 fees",
                  color: "#facc15",
                },
                {
                  layer: "Your Wallet",
                  sub: "Non-custodial · You hold keys",
                  color: "#facc15",
                },
              ].map(({ layer, sub, color }, i) => (
                <div
                  key={layer}
                  className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black text-black"
                    style={{ backgroundColor: color, opacity: 1 - i * 0.18 }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-white">{layer}</p>
                    <p className="text-[11px] text-neutral-600">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Roadmap ───────────────────────────────────────────────── */}
      <section className="border-b border-white/[0.06] py-24 px-6">
        <div className="mx-auto max-w-[860px]">
          <div className="mb-14 text-center">
            <SectionLabel>Roadmap</SectionLabel>
            <h2 className="text-[clamp(1.8rem,4vw,2.75rem)] font-black tracking-[-0.025em] text-white">
              Where we've been, where we're going
            </h2>
          </div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-3 bottom-3 w-[2px] bg-white/[0.06] hidden sm:block" />

            <div className="flex flex-col gap-0">
              {TIMELINE.map(({ year, label, note }, i) => {
                const isPast = i < 4;
                return (
                  <div
                    key={year}
                    className="relative flex items-start gap-6 py-4 sm:pl-12"
                  >
                    {/* Dot */}
                    <div
                      className={`absolute left-0 top-5 hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-[10px] font-black ${
                        isPast
                          ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
                          : "border-white/[0.08] bg-white/[0.04] text-neutral-600"
                      }`}
                    >
                      {isPast ? "✓" : "○"}
                    </div>

                    <div className="flex-1 rounded-2xl border border-white/[0.06] bg-[#0a0a0a] px-5 py-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          className={`text-[11px] font-bold uppercase tracking-widest ${
                            isPast ? "text-yellow-400" : "text-neutral-700"
                          }`}
                        >
                          {year}
                        </span>
                        {isPast && (
                          <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-400">
                            Done
                          </span>
                        )}
                        {!isPast && i === 4 && (
                          <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                            In progress
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[15px] font-bold text-white">
                        {label}
                      </p>
                      <p className="mt-0.5 text-[13px] text-neutral-600">
                        {note}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Values ────────────────────────────────────────────────── */}
      <section className="border-b border-white/[0.06] py-24 px-6">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-14 text-center">
            <SectionLabel>Our Values</SectionLabel>
            <h2 className="text-[clamp(1.8rem,4vw,2.75rem)] font-black tracking-[-0.025em] text-white">
              What we stand for
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {VALUES.map(({ label, body }) => (
              <div
                key={label}
                className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className="h-1.5 w-8 rounded-full"
                    style={{ backgroundColor: "#facc15" }}
                  />
                  <h3 className="text-[16px] font-bold text-white">{label}</h3>
                </div>
                <p className="text-[14px] leading-relaxed text-neutral-500">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Team ──────────────────────────────────────────────────── */}
      <section className="border-b border-white/[0.06] py-24 px-6">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-14 text-center">
            <SectionLabel>The Team</SectionLabel>
            <h2 className="text-[clamp(1.8rem,4vw,2.75rem)] font-black tracking-[-0.025em] text-white">
              Built by people who care
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 max-w-[720px] mx-auto">
            {TEAM.map(({ name, role, initials, bio, twitter, github }) => (
              <div
                key={name}
                className="flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[16px] font-black text-black"
                    style={{ backgroundColor: "#facc15" }}
                  >
                    {initials}
                  </div>
                  <div>
                    <p className="text-[16px] font-bold text-white">{name}</p>
                    <p className="text-[13px] text-neutral-500">{role}</p>
                  </div>
                </div>
                <p className="text-[13px] leading-relaxed text-neutral-600">
                  {bio}
                </p>
                <div className="flex gap-3">
                  <a
                    href={twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-neutral-600 hover:text-white transition-colors"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    Twitter
                  </a>
                  <a
                    href={github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-neutral-600 hover:text-white transition-colors"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.1.82-.26.82-.58v-2.03c-3.34.72-4.04-1.61-4.04-1.61-.54-1.38-1.33-1.74-1.33-1.74-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.48.99.1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.13 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57C20.57 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0z" />
                    </svg>
                    GitHub
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────────────── */}
      <section className="py-28 px-6">
        <div className="mx-auto max-w-[860px] text-center">
          <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-black tracking-[-0.03em] text-white mb-4">
            Ready to stream payroll?
          </h2>
          <p className="mx-auto mb-10 max-w-[520px] text-[16px] text-neutral-500">
            Connect your Stellar wallet and create your first payment stream in
            under 3 minutes.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-[15px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97]"
              style={{ backgroundColor: "#facc15" }}
            >
              Launch app
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-8 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-white/[0.08]"
            >
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
