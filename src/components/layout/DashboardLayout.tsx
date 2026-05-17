import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useWallet } from "../../hooks/useWallet";
import { useRoleDetect } from "../../hooks/useRoleDetect";
import { Suspense } from "react";
import NotificationCenter from "../NotificationCenter";

// ─── Nav config ────────────────────────────────────────────────────────────────

// ── Worker nav (simple — just their own pages) ────────────────────────────────

const WORKER_MAIN_NAV = [
  {
    label: "My Earnings",
    to: "/worker",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Withdraw",
    to: "/withdraw",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
      </svg>
    ),
  },
  {
    label: "Settings",
    to: "/settings",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
] as const;

// ── Employer nav ──────────────────────────────────────────────────────────────

const MAIN_NAV = [
  {
    label: "Overview",
    to: "/dashboard",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    label: "Payroll",
    to: "/payroll",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path
          d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: "Create Stream",
    to: "/create-stream",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v8M8 12h8" strokeLinecap="round" />
      </svg>
    ),
    accent: true,
  },
  {
    label: "Treasury",
    to: "/treasury-management",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    label: "Workers",
    to: "/worker",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "Workforce",
    to: "/workforce",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path
          d="M4 20h16M4 20v-4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M8 12V8m8 4V8M12 12V4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
] as const;

const ANALYTICS_NAV = [
  {
    label: "Analytics",
    to: "/analytics",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path d="M3 3v18h18" strokeLinecap="round" />
        <path
          d="M18 17l-5-5-3 3-4-4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Reports",
    to: "/reports",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Treasury Analytics",
    to: "/treasury-analytics",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" strokeLinecap="round" />
      </svg>
    ),
  },
] as const;

const TOOLS_NAV = [
  {
    label: "Governance",
    to: "/governance",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M9 22V12h6v10" />
      </svg>
    ),
  },
  {
    label: "Address Book",
    to: "/address-book",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <path d="M22 10H2M12 4v16" />
      </svg>
    ),
  },
  {
    label: "Templates",
    to: "/templates",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    label: "Withdraw",
    to: "/withdraw",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
      </svg>
    ),
  },
  {
    label: "Settings",
    to: "/settings",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
] as const;

// ─── Loading fallback ──────────────────────────────────────────────────────────

function DashboardLoadingFallback() {
  return (
    <div className="flex items-center justify-center flex-1">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 rounded-full animate-spin border-white/10 border-t-yellow-400" />
        <p className="text-[12px] font-medium text-neutral-600">Loading...</p>
      </div>
    </div>
  );
}

// ─── Sidebar nav section ───────────────────────────────────────────────────────

function NavSection({
  label,
  items,
  collapsed,
}: {
  label?: string;
  items: readonly {
    label: string;
    to: string;
    icon: React.ReactNode;
    accent?: boolean;
  }[];
  collapsed: boolean;
}) {
  return (
    <div className="mb-1">
      {label && !collapsed && (
        <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-600">
          {label}
        </p>
      )}
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/dashboard"}
          className={({ isActive }) =>
            `relative flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium transition-all duration-150 mb-0.5 ${
              isActive
                ? "bg-yellow-400/10 text-white"
                : item.accent
                  ? "text-yellow-400 hover:bg-yellow-400/8"
                  : "text-neutral-500 hover:bg-white/[0.05] hover:text-neutral-200"
            } ${collapsed ? "justify-center px-2" : ""}`
          }
          title={collapsed ? item.label : undefined}
        >
          {({ isActive }) => (
            <>
              <span className={isActive ? "text-yellow-400" : ""}>
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
              {isActive && !collapsed && (
                <span
                  className="ml-auto h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: "#facc15" }}
                />
              )}
              {isActive && collapsed && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r-full"
                  style={{ backgroundColor: "#facc15" }}
                />
              )}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({
  collapsed,
  address,
  shortAddr,
  role,
  setCollapsed,
  onDisconnect,
}: {
  collapsed: boolean;
  address: string | undefined;
  shortAddr: string;
  role: string;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* Logo */}
      <div
        className={`flex items-center border-b border-white/[0.05] ${collapsed ? "justify-center px-0 py-[14px]" : "gap-2.5 px-4 py-[14px]"}`}
      >
        {/* Icon mark — same mask-image technique as Navbar */}
        <div
          className="w-8 h-8 shrink-0"
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
        {!collapsed && (
          <span
            className="text-[17px] font-bold tracking-tight text-white"
            style={{ letterSpacing: "-0.02em" }}
          >
            Quipay
          </span>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 px-2 py-3 overflow-y-auto scrollbar-none">
        {role === "worker" ? (
          /* ── Worker view — simple ── */
          <NavSection items={WORKER_MAIN_NAV} collapsed={collapsed} />
        ) : (
          /* ── Employer view — full ── */
          <>
            <NavSection items={MAIN_NAV} collapsed={collapsed} />
            <div className="my-2 border-t border-white/[0.05]" />
            <NavSection
              label="Analytics"
              items={ANALYTICS_NAV}
              collapsed={collapsed}
            />
            <div className="my-2 border-t border-white/[0.05]" />
            <NavSection label="Tools" items={TOOLS_NAV} collapsed={collapsed} />
          </>
        )}
      </div>

      {/* Role badge — visible when expanded */}
      {!collapsed && (
        <div className="px-4 pb-1">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
              role === "worker"
                ? "bg-blue-500/10 text-blue-400"
                : "bg-yellow-400/10 text-yellow-400"
            }`}
          >
            {role === "worker" ? "Worker" : "Employer"}
          </span>
        </div>
      )}

      {/* Bottom: user + actions */}
      <div className="border-t border-white/[0.05] p-2">
        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className={`hidden md:flex mb-2 w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-neutral-600 hover:bg-white/[0.04] hover:text-neutral-400 transition-colors ${collapsed ? "justify-center" : ""}`}
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M15 18l-6-6 6-6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>

        {/* User pill */}
        {address ? (
          <div
            className={`flex items-center gap-2.5 rounded-lg px-2 py-2 ${collapsed ? "justify-center" : ""}`}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black text-black"
              style={{ backgroundColor: "#facc15" }}
            >
              {address.slice(1, 3).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="truncate font-mono text-[13px] font-medium text-white">
                  {shortAddr}
                </p>
                <button
                  onClick={onDisconnect}
                  className="text-[12px] text-neutral-600 hover:text-red-400 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Dashboard Layout ──────────────────────────────────────────────────────────

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { address, disconnect } = useWallet();
  const { role, resetRole: clearRole } = useRoleDetect(address);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fn = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const shortAddr = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";
  const sidebarWidth = collapsed ? 56 : 220;
  const handleDisconnect = () => {
    clearRole();
    void disconnect().then(() => navigate("/"));
  };

  return (
    <div className="flex h-screen overflow-hidden text-white bg-black">
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden md:flex flex-col shrink-0 border-r border-white/[0.06] transition-all duration-200 overflow-hidden"
        style={{ width: sidebarWidth }}
      >
        <SidebarContent
          collapsed={collapsed}
          address={address}
          shortAddr={shortAddr}
          setCollapsed={setCollapsed}
          role={role}
          onDisconnect={handleDisconnect}
        />
      </aside>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col border-r border-white/[0.06] transition-transform duration-250 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent
          collapsed={collapsed}
          address={address}
          shortAddr={shortAddr}
          setCollapsed={setCollapsed}
          role={role}
          onDisconnect={handleDisconnect}
        />
      </aside>

      {/* ── Main content ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-black/90 px-4 sm:px-6 backdrop-blur-md">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-8 w-8 md:hidden items-center justify-center rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <svg
              className="w-4 h-4 text-neutral-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>

          {/* Breadcrumb / page title area (empty — pages set their own h1) */}
          <div className="hidden md:block" />

          {/* Right actions */}
          <div className="flex items-center gap-2 ml-auto">
            <NotificationCenter />

            <button
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97]"
              style={{ backgroundColor: "#facc15" }}
              onClick={() => void navigate("/create-stream")}
            >
              <svg
                className="w-3 h-3"
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
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-black">
          <Suspense fallback={<DashboardLoadingFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
