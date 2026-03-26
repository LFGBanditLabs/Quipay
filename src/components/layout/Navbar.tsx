import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ConnectAccount from "../ConnectAccount";
import ThemeToggle from "../ThemeToggle";
import LanguageSwitcher from "../LanguageSwitcher";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui";

const Navbar: React.FC = () => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const navLinks = [
    { to: "/dashboard", label: t("nav.dashboard"), shortcut: "Ctrl+D" },
    { to: "/payroll", label: t("nav.payroll") },
    { to: "/treasury-management", label: t("nav.treasury") },
    { to: "/worker", label: t("nav.worker") },
    { to: "/workforce", label: t("nav.workforce") },
    { to: "/reports", label: t("nav.reports") },
    { to: "/templates", label: "Templates" },
    { to: "/governance", label: t("nav.governance") },
    {
      to: "/withdraw",
      label: t("nav.withdraw") || "Withdraw",
      shortcut: "Ctrl+W",
    },
    {
      to: "/create-stream",
      label: t("nav.create_stream") || "New Stream",
      shortcut: "Ctrl+N",
    },
    {
      to: "/settings",
      label: t("nav.settings") || "Settings",
      shortcut: "Ctrl+,",
    },
  ];

  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-[var(--surface)]/80 backdrop-blur-xl border-b border-[var(--border)] shadow-lg"
            : "bg-transparent"
        }`}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25">
                Q
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Quipay
              </span>
            </div>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Tooltip key={link.to}>
                  <TooltipTrigger>
                    <NavLink
                      to={link.to}
                      onClick={closeMenu}
                      className={({ isActive }) =>
                        `relative inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "text-[var(--text)] bg-[var(--surface-subtle)]"
                            : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-subtle)]/50"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {link.label}
                          {isActive && (
                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-gradient-to-r from-indigo-400 to-pink-400" />
                          )}
                        </>
                      )}
                    </NavLink>
                  </TooltipTrigger>
                  {link.shortcut && (
                    <TooltipContent side="bottom" className="flex gap-2">
                      {link.label}
                      <kbd className="rounded bg-background/20 px-1.5 py-0.5 text-[10px] font-sans">
                        {link.shortcut}
                      </kbd>
                    </TooltipContent>
                  )}
                </Tooltip>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2">
                <LanguageSwitcher />
                <ThemeToggle />
                <ConnectAccount />
              </div>

              <div className="flex md:hidden items-center gap-2">
                <ConnectAccount />
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="min-h-11 min-w-11 rounded-lg p-2 text-[var(--muted)] transition-all duration-200 hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"
                  aria-label={
                    isMenuOpen ? t("nav.close_menu") : t("nav.open_menu")
                  }
                  aria-expanded={isMenuOpen}
                >
                  {isMenuOpen ? (
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </nav>
      </header>

      {isMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={closeMenu}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        </div>
      )}

      <div
        className={`fixed top-16 left-0 right-0 z-40 md:hidden transition-all duration-300 ease-in-out ${
          isMenuOpen
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        <nav className="bg-[var(--surface)]/95 backdrop-blur-xl border-b border-[var(--border)] shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={closeMenu}
                className={({ isActive }) =>
                  `flex min-h-11 items-center rounded-xl px-4 py-3 text-base font-medium transition-all duration-200 ${
                    isActive
                      ? "text-[var(--text)] bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-[var(--border)]"
                      : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-subtle)]"
                  }`
                }
              >
                {({ isActive }) => (
                  <div className="flex items-center justify-between w-full">
                    <span>{link.label}</span>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-400 to-pink-400" />
                    )}
                  </div>
                )}
              </NavLink>
            ))}
            <div className="flex items-center justify-center gap-4 pt-4 mt-2 border-t border-[var(--border)]">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </nav>
      </div>

      <div className="h-16" />
    </>
  );
};

export default Navbar;
