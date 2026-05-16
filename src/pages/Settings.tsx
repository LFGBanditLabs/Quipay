import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { SeoHelmet } from "../components/seo/SeoHelmet";
import { Permission } from "../contracts/automation_gateway";
import { useStreamTemplates } from "../hooks/useStreamTemplates";
import { useWallet } from "../hooks/useWallet";
import NetworkHealthMonitor from "../components/NetworkHealthMonitor";
import BrandingSettings from "../components/BrandingSettings";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  name: string;
  address: string;
  role: string;
  status: "active" | "pending";
  permissions?: Permission[];
}

interface CustomRole {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

interface AuditLog {
  id: string;
  timestamp: string;
  wallet: string;
  action: string;
  details: string;
  status: "success" | "failure" | "pending";
}

type TabId =
  | "team"
  | "roles"
  | "audit"
  | "approvals"
  | "templates"
  | "notifications"
  | "network"
  | "branding";

// ─── Data ─────────────────────────────────────────────────────────────────────

const AVAILABLE_PERMISSIONS = [
  {
    id: Permission.CreateStream,
    nameKey: "settings.perm_create_stream",
    descKey: "settings.perm_create_stream_desc",
  },
  {
    id: Permission.CancelStream,
    nameKey: "settings.perm_cancel_stream",
    descKey: "settings.perm_cancel_stream_desc",
  },
  {
    id: Permission.ExecutePayroll,
    nameKey: "settings.perm_execute_payroll",
    descKey: "settings.perm_execute_payroll_desc",
  },
  {
    id: Permission.ManageTreasury,
    nameKey: "settings.perm_manage_treasury",
    descKey: "settings.perm_manage_treasury_desc",
  },
  {
    id: Permission.RegisterAgent,
    nameKey: "settings.perm_register_agent",
    descKey: "settings.perm_register_agent_desc",
  },
  {
    id: Permission.RebalanceTreasury,
    nameKey: "settings.perm_rebalance_treasury",
    descKey: "settings.perm_rebalance_treasury_desc",
  },
];

const ROLES: CustomRole[] = [
  {
    id: "admin",
    name: "Admin",
    description: "Full access to all protocol management functions",
    permissions: [
      Permission.ExecutePayroll,
      Permission.ManageTreasury,
      Permission.RegisterAgent,
      Permission.CreateStream,
      Permission.CancelStream,
      Permission.RebalanceTreasury,
    ],
  },
  {
    id: "manager",
    name: "Manager",
    description: "Can manage payroll and streams but cannot register agents",
    permissions: [
      Permission.ExecutePayroll,
      Permission.CreateStream,
      Permission.CancelStream,
    ],
  },
  {
    id: "viewer",
    name: "Viewer",
    description:
      "Read-only access to organization data (No on-chain permissions)",
    permissions: [],
  },
];

// ─── Shared components ────────────────────────────────────────────────────────

const SectionHeader: React.FC<{
  title: string;
  desc?: string;
  action?: React.ReactNode;
}> = ({ title, desc, action }) => (
  <div className="flex items-start justify-between gap-4 mb-6">
    <div>
      <h2 className="text-[20px] font-bold text-white">{title}</h2>
      {desc && <p className="mt-1 text-[14px] text-neutral-500">{desc}</p>}
    </div>
    {action}
  </div>
);

const Btn: React.FC<{
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md";
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ onClick, variant = "secondary", size = "md", children, disabled }) => {
  const base =
    "inline-flex items-center gap-1.5 rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]";
  const sz =
    size === "sm" ? "px-3.5 py-1.5 text-[13px]" : "px-5 py-2.5 text-[14px]";
  const v =
    variant === "primary"
      ? "text-black hover:opacity-90"
      : variant === "danger"
        ? "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
        : "border border-white/[0.1] bg-white/[0.04] text-white hover:bg-white/[0.08]";
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${sz} ${v}`}
      style={variant === "primary" ? { backgroundColor: "#facc15" } : {}}
    >
      {children}
    </button>
  );
};

const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ checked, onChange }) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "" : "bg-white/[0.1]"}`}
    style={checked ? { backgroundColor: "#facc15" } : {}}
  >
    <span
      className={`absolute top-0.5 h-5 w-5 rounded-full bg-black shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
    />
  </button>
);

const StatusDot: React.FC<{
  status: "success" | "failure" | "pending" | "active" | "paused";
}> = ({ status }) => {
  const colors = {
    success: "bg-green-400",
    active: "bg-green-400",
    failure: "bg-red-400",
    pending: "bg-yellow-400",
    paused: "bg-neutral-500",
  };
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colors[status]} ${status === "pending" ? "animate-pulse" : ""}`}
    />
  );
};

// ─── Settings page ────────────────────────────────────────────────────────────

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useWallet();
  const { templates, deleteTemplate } = useStreamTemplates();
  const [activeTab, setActiveTab] = useState<TabId>("team");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const [auditSearch, setAuditSearch] = useState("");
  const [auditFilter, setAuditFilter] = useState("all");

  const [notif, setNotif] = useState({
    emailEnabled: true,
    inAppEnabled: true,
    cliffUnlockAlerts: true,
    streamEndingAlerts: true,
    lowRunwayAlerts: true,
  });

  const [members] = useState<TeamMember[]>([
    {
      id: "1",
      name: "Organization Owner",
      address: "GCFX...ABC1",
      role: "Admin",
      status: "active",
      permissions: ROLES.find((r) => r.id === "admin")?.permissions,
    },
    {
      id: "2",
      name: "Alice Manager",
      address: "GDYQ...DEF2",
      role: "Manager",
      status: "active",
      permissions: ROLES.find((r) => r.id === "manager")?.permissions,
    },
    {
      id: "3",
      name: "Bob Viewer",
      address: "GAHU...GHI3",
      role: "Viewer",
      status: "pending",
      permissions: [],
    },
  ]);

  const [roles] = useState<CustomRole[]>(ROLES);

  const [auditLogs] = useState<AuditLog[]>([
    {
      id: "l1",
      timestamp: "2024-03-08 10:24:45",
      wallet: "GCFX...ABC1",
      action: "Created Stream",
      details: "Stream ID #104 for Worker GD...X22",
      status: "success",
    },
    {
      id: "l2",
      timestamp: "2024-03-08 09:12:10",
      wallet: "GDYQ...DEF2",
      action: "Approved Proposal",
      details: "Proposal #002: Upgrade Treasury Contract",
      status: "success",
    },
    {
      id: "l3",
      timestamp: "2024-03-07 18:30:22",
      wallet: "GAHU...GHI3",
      action: "Modified Role",
      details: "Updated Payroll Submitter permissions",
      status: "success",
    },
    {
      id: "l4",
      timestamp: "2024-03-07 15:45:00",
      wallet: "GCFX...ABC1",
      action: "Executed Withdrawal",
      details: "10,000 USDC to Operations Wallet",
      status: "success",
    },
  ]);

  const filteredLogs = auditLogs.filter((l) => {
    const q = auditSearch.toLowerCase();
    const match =
      l.action.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q) ||
      l.wallet.toLowerCase().includes(q);
    return match && (auditFilter === "all" || l.status === auditFilter);
  });

  const handleExportCSV = () => {
    const headers = ["Timestamp", "Wallet", "Action", "Details", "Status"];
    const rows = auditLogs.map((l) => [
      l.timestamp,
      l.wallet,
      l.action,
      l.details,
      l.status,
    ]);
    const csv =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = encodeURI(csv);
    a.download = `quipay_audit_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Audit log exported successfully");
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "team", label: t("settings.tab_team") },
    { id: "roles", label: t("settings.tab_roles") },
    { id: "audit", label: t("settings.tab_audit") },
    { id: "approvals", label: t("settings.tab_approvals") },
    { id: "templates", label: t("settings.tab_templates") },
    { id: "notifications", label: t("settings.tab_notifications") },
    { id: "network", label: t("settings.tab_network") },
    { id: "branding", label: "Branding" },
  ];

  // ── Tab content ─────────────────────────────────────────────────────────────

  const renderTeam = () => (
    <div>
      <SectionHeader
        title={t("settings.team_management")}
        desc={t("settings.team_description")}
        action={
          <Btn
            variant="primary"
            size="sm"
            onClick={() => showToast("Invite member — coming soon")}
          >
            <span>+</span> {t("settings.add_member")}
          </Btn>
        }
      />
      <div className="flex flex-col gap-3">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#0a0a0a] px-5 py-4 hover:border-yellow-400/20 transition-colors"
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-black text-black"
              style={{ backgroundColor: "#facc15" }}
            >
              {m.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-semibold text-white">
                  {m.name}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${m.role === "Admin" ? "bg-yellow-400/10 text-yellow-400" : "bg-white/[0.06] text-neutral-400"}`}
                >
                  {m.role}
                </span>
                {m.status === "pending" && (
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-amber-400/10 text-amber-400">
                    Pending
                  </span>
                )}
              </div>
              <p className="mt-0.5 font-mono text-[12px] text-neutral-600">
                {m.address}
              </p>
            </div>
            <div className="hidden sm:flex flex-col items-end shrink-0">
              <p className="text-[11px] text-neutral-700 uppercase tracking-wider">
                {t("settings.access_level")}
              </p>
              <p
                className="text-[13px] font-semibold"
                style={{ color: "#facc15" }}
              >
                {m.role === "Admin"
                  ? t("settings.full_access")
                  : m.role === "Viewer"
                    ? t("settings.read_only")
                    : t("settings.limited_permissions")}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <StatusDot
                status={m.status === "active" ? "active" : "pending"}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderRoles = () => (
    <div>
      <SectionHeader
        title="Custom Roles"
        desc={t("settings.roles_description")}
        action={
          <Btn
            variant="primary"
            size="sm"
            onClick={() => showToast("Create role — coming soon")}
          >
            <span>+</span> {t("settings.create_role")}
          </Btn>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {roles.map((role) => (
          <div
            key={role.id}
            className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5 hover:border-yellow-400/20 transition-colors group"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-[16px] font-bold text-white group-hover:text-yellow-400 transition-colors">
                  {role.name}
                </h3>
                <p className="mt-1 text-[13px] text-neutral-500 leading-relaxed">
                  {role.description}
                </p>
              </div>
              <Btn
                size="sm"
                onClick={() => showToast("Edit role — coming soon")}
              >
                Edit
              </Btn>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {role.permissions.length === 0 ? (
                <span className="text-[12px] text-neutral-600">
                  No on-chain permissions
                </span>
              ) : (
                role.permissions.map((p) => (
                  <span
                    key={p}
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-yellow-400/10 text-yellow-400"
                  >
                    {t(
                      AVAILABLE_PERMISSIONS.find((ap) => ap.id === p)
                        ?.nameKey ?? "",
                    ) || p}
                  </span>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAudit = () => (
    <div>
      <SectionHeader
        title="Audit Logs"
        desc={t("settings.audit_description")}
        action={
          <Btn size="sm" onClick={handleExportCSV}>
            ↓ {t("settings.export_csv")}
          </Btn>
        }
      />

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder={t("settings.search_logs_placeholder")}
          value={auditSearch}
          onChange={(e) => setAuditSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-xl border border-white/[0.1] bg-black px-4 py-2.5 text-[14px] text-white placeholder:text-neutral-700 focus:border-yellow-400/40 focus:outline-none focus:ring-1 focus:ring-yellow-400/20"
        />
        <select
          value={auditFilter}
          onChange={(e) => setAuditFilter(e.target.value)}
          className="rounded-xl border border-white/[0.1] bg-black px-4 py-2.5 text-[14px] text-white focus:border-yellow-400/40 focus:outline-none"
        >
          <option value="all">{t("settings.all_status")}</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Timestamp", "Wallet", "Action", "Details", "Status"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-neutral-600"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3.5 font-mono text-[12px] text-neutral-500">
                      {log.timestamp}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[13px] text-neutral-400">
                      {log.wallet}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-white/[0.06] text-neutral-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-neutral-400 max-w-xs truncate">
                      {log.details}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <StatusDot status={log.status} />
                        <span
                          className={`text-[13px] font-semibold capitalize ${log.status === "success" ? "text-green-400" : log.status === "failure" ? "text-red-400" : "text-yellow-400"}`}
                        >
                          {log.status}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-[14px] text-neutral-600"
                  >
                    No logs found.{" "}
                    <button
                      onClick={() => {
                        setAuditSearch("");
                        setAuditFilter("all");
                      }}
                      className="text-yellow-400 hover:underline ml-1"
                    >
                      Clear filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderApprovals = () => (
    <div>
      <SectionHeader
        title="Approval Requests"
        desc={t("settings.approval_description")}
      />
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-[#0a0a0a] py-20 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-400/10 border border-yellow-400/20">
          <svg
            className="h-8 w-8 text-yellow-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <polyline
              points="20 6 9 17 4 12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="text-[18px] font-bold text-white mb-2">
          {t("settings.queue_empty")}
        </h3>
        <p className="text-[14px] text-neutral-500 max-w-xs mb-6">
          {t("settings.no_pending_actions")}
        </p>
        <Btn onClick={() => void navigate("/governance")}>
          {t("settings.view_governance")}
        </Btn>
      </div>
    </div>
  );

  const renderTemplates = () => (
    <div>
      <SectionHeader
        title={t("settings.tab_templates")}
        desc={t("settings.templates_description")}
        action={
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-yellow-400/10 px-2.5 py-0.5 text-[12px] font-semibold text-yellow-400">
              {templates.length}
            </span>
            <Btn
              variant="primary"
              size="sm"
              onClick={() => void navigate("/create-stream")}
            >
              <span>+</span> {t("settings.create_template")}
            </Btn>
          </div>
        }
      />
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-[#0a0a0a] py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-yellow-400/10 border border-yellow-400/20">
            <svg
              className="h-7 w-7 text-yellow-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path
                d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h3 className="text-[18px] font-bold text-white mb-2">
            {t("settings.no_templates")}
          </h3>
          <p className="text-[14px] text-neutral-500 mb-6 max-w-xs">
            {t("settings.no_templates_desc")}
          </p>
          <Btn onClick={() => void navigate("/create-stream")}>
            {t("settings.create_first_stream")}
          </Btn>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5 hover:border-yellow-400/20 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-[15px] font-bold text-white group-hover:text-yellow-400 transition-colors">
                    {tpl.name}
                  </h3>
                  <p className="text-[12px] text-neutral-600 mt-0.5">
                    {new Date(tpl.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Btn
                  size="sm"
                  variant="danger"
                  onClick={() => deleteTemplate(tpl.id)}
                >
                  Delete
                </Btn>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-yellow-400/10 text-yellow-400">
                  {tpl.token}
                </span>
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-white/[0.06] text-neutral-400">
                  {tpl.frequency}
                </span>
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-white/[0.06] text-neutral-400">
                  {tpl.duration}d
                </span>
                {tpl.enableCliff && (
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-400/10 text-amber-400">
                    Cliff: {tpl.cliffDuration}d
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderNotifications = () => {
    const toggleRow = (key: keyof typeof notif) =>
      setNotif((p) => ({ ...p, [key]: !p[key] }));
    const rows = [
      {
        key: "emailEnabled" as const,
        label: t("settings.email_notifications"),
        desc: t("settings.email_desc"),
      },
      {
        key: "inAppEnabled" as const,
        label: t("settings.in_app_notifications"),
        desc: t("settings.in_app_desc"),
      },
      {
        key: "cliffUnlockAlerts" as const,
        label: t("settings.cliff_unlock_alerts"),
        desc: t("settings.cliff_unlock_desc"),
      },
      {
        key: "streamEndingAlerts" as const,
        label: t("settings.stream_ending_alerts"),
        desc: t("settings.stream_ending_desc"),
      },
      {
        key: "lowRunwayAlerts" as const,
        label: t("settings.low_runway_alerts"),
        desc: t("settings.low_runway_desc"),
      },
    ];
    return (
      <div>
        <SectionHeader
          title={t("settings.notification_prefs")}
          desc={t("settings.notification_desc")}
        />
        <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] divide-y divide-white/[0.05]">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between px-5 py-4"
            >
              <div>
                <p className="text-[15px] font-semibold text-white">
                  {row.label}
                </p>
                <p className="text-[13px] text-neutral-500 mt-0.5">
                  {row.desc}
                </p>
              </div>
              <Toggle
                checked={notif[row.key]}
                onChange={() => toggleRow(row.key)}
              />
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <Btn
            variant="primary"
            onClick={() => showToast(t("settings.notification_saved"))}
          >
            {t("settings.save_preferences")}
          </Btn>
        </div>
      </div>
    );
  };

  const renderNetwork = () => (
    <div>
      <SectionHeader
        title={t("settings.tab_network")}
        desc="Monitor network health and RPC connectivity."
      />
      <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
        <NetworkHealthMonitor />
      </div>
    </div>
  );

  const renderBranding = () => (
    <div>
      <SectionHeader
        title="Branding"
        desc="Customise your organisation's visual identity within Quipay."
      />
      <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
        <BrandingSettings employerAddress="" />
      </div>
    </div>
  );

  const tabContent: Record<TabId, () => React.ReactNode> = {
    team: renderTeam,
    roles: renderRoles,
    audit: renderAudit,
    approvals: renderApprovals,
    templates: renderTemplates,
    notifications: renderNotifications,
    network: renderNetwork,
    branding: renderBranding,
  };

  return (
    <>
      <SeoHelmet
        title={t("settings.page_title")}
        description={t("settings.page_description")}
        path="/settings"
      />

      <div className="px-6 py-8 sm:px-8 sm:py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[24px] font-bold text-white tracking-tight">
            {t("settings.vault_settings")}
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] text-neutral-500">
            {t("settings.vault_description")}
          </p>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-[14px] font-medium ${toast.ok ? "border-green-500/20 bg-green-500/8 text-green-400" : "border-red-500/20 bg-red-500/8 text-red-400"}`}
          >
            <span>{toast.ok ? "✓" : "✕"}</span>
            {toast.msg}
            <button
              onClick={() => setToast(null)}
              className="ml-auto text-current opacity-50 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8 flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-[#0a0a0a] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 rounded-lg px-4 py-2 text-[13.5px] font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-black shadow-sm"
                  : "text-neutral-500 hover:text-neutral-200"
              }`}
              style={activeTab === tab.id ? { backgroundColor: "#facc15" } : {}}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="animate-fade-in-up">{tabContent[activeTab]?.()}</div>
      </div>
    </>
  );
};

export default Settings;
