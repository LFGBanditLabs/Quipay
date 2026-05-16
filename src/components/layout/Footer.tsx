import React from "react";
import { Link } from "react-router-dom";
const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  const cols = [
    {
      heading: "Product",
      links: [
        { label: "Dashboard", to: "/dashboard" },
        { label: "Payroll", to: "/payroll" },
        { label: "Treasury", to: "/treasury-management" },
        { label: "Workforce", to: "/workforce" },
        { label: "Analytics", to: "/analytics" },
        { label: "Governance", to: "/governance" },
      ],
    },
    {
      heading: "Resources",
      links: [
        { label: "Documentation", to: "/help" },
        { label: "Debugger", to: "/debug" },
        { label: "Stellar Docs", href: "https://developers.stellar.org" },
        { label: "Soroban Docs", href: "https://soroban.stellar.org" },
        { label: "GitHub", href: "https://github.com/LFGBanditLabs/Quipay" },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "About", href: "#" },
        { label: "Blog", href: "#" },
        { label: "Careers", href: "#" },
        { label: "Contact", href: "#" },
        { label: "Security", to: "/help" },
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Privacy Policy", href: "#" },
        { label: "Terms of Service", href: "#" },
        { label: "Cookie Policy", href: "#" },
        { label: "MIT License", href: "https://opensource.org/license/mit" },
      ],
    },
  ] as const;

  return (
    <footer className="border-t border-white/[0.07] bg-[#050505]">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        {/* ── Top: brand + columns ─────────────────────────────── */}
        <div className="grid grid-cols-2 gap-10 py-16 md:grid-cols-[1.6fr_1fr_1fr_1fr_1fr] lg:py-20">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="mb-6 flex w-fit items-center gap-2.5 group">
              <div
                className="h-8 w-8 shrink-0 transition-opacity group-hover:opacity-80"
                style={{
                  backgroundColor: "#facc15",
                  WebkitMaskImage: "url('/quipay-icon-mark.png')",
                  WebkitMaskSize: "contain",
                  WebkitMaskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskImage: "url('/quipay-icon-mark.png')",
                  maskSize: "contain",
                  maskRepeat: "no-repeat",
                  maskPosition: "center",
                }}
              />
              <span
                className="text-[18px] font-bold tracking-tight text-white"
                style={{ letterSpacing: "-0.02em" }}
              >
                Quipay
              </span>
            </Link>

            <p className="mb-6 max-w-[220px] text-[13px] leading-relaxed text-neutral-500">
              Autonomous payroll infrastructure built on Stellar. Real-time
              streaming payments for global teams.
            </p>

            {/* Stellar badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="#facc15">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              <span className="text-[11px] font-medium text-neutral-500">
                Built on Stellar
              </span>
            </div>

            {/* Social icons */}
            <div className="flex items-center gap-4">
              {[
                {
                  label: "GitHub",
                  href: "https://github.com/LFGBanditLabs/Quipay",
                  icon: (
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      />
                    </svg>
                  ),
                },
                {
                  label: "X",
                  href: "https://twitter.com/Quipay",
                  icon: (
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  ),
                },
                {
                  label: "Discord",
                  href: "https://discord.gg/Quipay",
                  icon: (
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                    </svg>
                  ),
                },
              ].map(({ label, href, icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="text-neutral-600 transition-colors duration-150 hover:text-white"
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {cols.map((col) => (
            <div key={col.heading}>
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-600">
                {col.heading}
              </p>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {"to" in link ? (
                      <Link
                        to={link.to}
                        className="text-[13px] text-neutral-500 transition-colors duration-150 hover:text-white"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-neutral-500 transition-colors duration-150 hover:text-white"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Newsletter strip ──────────────────────────────────── */}
        <div className="flex flex-col items-start justify-between gap-6 border-t border-white/[0.06] py-8 sm:flex-row sm:items-center">
          <div>
            <p className="text-[14px] font-semibold text-white">
              Stay in the loop
            </p>
            <p className="mt-0.5 text-[13px] text-neutral-500">
              Product updates, Stellar news, payroll insights.
            </p>
          </div>
          <div className="flex w-full max-w-sm items-center gap-2">
            <input
              type="email"
              placeholder="you@company.com"
              className="flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-[13px] text-white placeholder:text-neutral-600 focus:border-yellow-400/40 focus:outline-none focus:ring-1 focus:ring-yellow-400/20"
            />
            <button
              className="shrink-0 rounded-xl px-5 py-2.5 text-[13px] font-bold text-black transition-all hover:opacity-90"
              style={{ backgroundColor: "#facc15" }}
            >
              Subscribe
            </button>
          </div>
        </div>

        {/* ── Bottom bar ────────────────────────────────────────── */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] py-6 sm:flex-row">
          <p className="text-[12px] text-neutral-600">
            © {year} Quipay · LFG Bandit Labs ·{" "}
            <a
              href="https://opensource.org/license/mit"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-neutral-400"
            >
              MIT License
            </a>
          </p>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
            <p className="text-[12px] text-neutral-600 font-mono">
              All systems operational
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
