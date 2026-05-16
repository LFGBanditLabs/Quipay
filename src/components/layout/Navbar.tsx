import { useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";
import { WalletButton } from "../WalletButton";
import NotificationCenter from "../NotificationCenter";

// ─── Nav config ───────────────────────────────────────────────────────────────

const PRIMARY_NAV = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

const Navbar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      {/* ─── Header ─────────────────────────────────────────────── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-black/92 backdrop-blur-xl border-b border-white/[0.07]"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-24 max-w-[1440px] items-center px-20">
          {/* ── Logo ── */}
          <Link to="/" className="flex shrink-0 items-center gap-2.5 group">
            {/* mask-image gives exact #facc15 — no filter approximation */}
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
              className="text-[22px] font-bold tracking-tight text-white leading-none select-none"
              style={{ letterSpacing: "-0.02em" }}
            >
              Quipay
            </span>
          </Link>

          {/* ── Desktop nav (center) ──────────────────────────────── */}
          <nav className="items-center justify-center flex-1 hidden gap-10 md:flex">
            {PRIMARY_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `text-[15px] font-semibold transition-colors duration-150 ${
                    isActive
                      ? "text-white"
                      : "text-neutral-400 hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* ── Right buttons ─────────────────────────────────────── */}
          <div className="items-center hidden gap-3 md:flex shrink-0">
            <NotificationCenter />

            {/* Log in — ghost pill (Tertiary style from Figma) */}
            <WalletButton />

            {/* Get Started — yellow filled pill (Secondary style from Figma) */}
          </div>

          {/* ── Mobile hamburger ──────────────────────────────────── */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="ml-auto flex md:hidden h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-xl hover:bg-white/[0.06] transition-colors"
          >
            <span
              className={`block h-[1.5px] w-[18px] rounded-full bg-neutral-400 transition-all duration-200 ${mobileOpen ? "translate-y-[6.5px] rotate-45 !bg-white" : ""}`}
            />
            <span
              className={`block h-[1.5px] w-[18px] rounded-full bg-neutral-400 transition-all duration-200 ${mobileOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`block h-[1.5px] w-[18px] rounded-full bg-neutral-400 transition-all duration-200 ${mobileOpen ? "-translate-y-[6.5px] -rotate-45 !bg-white" : ""}`}
            />
          </button>
        </div>
      </header>

      {/* ─── Mobile overlay ──────────────────────────────────────── */}
      <div
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-200 ${
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* ─── Mobile drawer ───────────────────────────────────────── */}
      <div
        className={`fixed inset-x-0 top-24 z-40 md:hidden transition-all duration-200 ease-out ${
          mobileOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-1 pointer-events-none"
        }`}
      >
        <div className="border-b border-white/[0.07] bg-[#090909] shadow-2xl">
          <div className="mx-auto max-w-[1440px] px-5 py-5">
            {PRIMARY_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center justify-between rounded-xl px-3 text-[15px] font-semibold transition-colors ${
                    isActive
                      ? "text-white"
                      : "text-neutral-400 hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <WalletButton />
            </div>
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="h-24" />
    </>
  );
};

export default Navbar;
