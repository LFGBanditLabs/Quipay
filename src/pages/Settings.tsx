/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — @stellar/design-system types are incomplete for Badge, Card, Modal, Icon
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Layout,
  Text,
  Button,
  Card,
  Badge,
  Icon,
  Modal,
  Input,
  Notification,
} from "@stellar/design-system";
import { SeoHelmet } from "../components/seo/SeoHelmet";
import { Permission } from "../contracts/automation_gateway";
import { useTheme } from "../providers/ThemeProvider";
import { useStreamTemplates } from "../hooks/useStreamTemplates";
import { useWallet } from "../hooks/useWallet";
import NetworkHealthMonitor from "../components/NetworkHealthMonitor";
import BrandingSettings from "../components/BrandingSettings";

// Types for local state
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

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { address } = useWallet();
  const { templates, deleteTemplate } = useStreamTemplates();
  const [activeTab, setActiveTab] = useState<TabId>("team");
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [auditSearch, setAuditSearch] = useState("");
  const [auditFilter, setAuditFilter] = useState("all");

  const [notificationSettings, setNotificationSettings] = useState({
    emailEnabled: true,
    inAppEnabled: true,
    cliffUnlockAlerts: true,
    streamEndingAlerts: true,
    lowRunwayAlerts: true,
  });

  // Mock Data
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

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.details.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.wallet.toLowerCase().includes(auditSearch.toLowerCase());
    const matchesFilter = auditFilter === "all" || log.status === auditFilter;
    return matchesSearch && matchesFilter;
  });

  const renderTeamPortal = () => (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Text as="h2" size="lg" weight="medium">
              {t("settings.team_management")}
            </Text>
            <Badge variant="secondary" size="sm" className="opacity-70">
              {t("settings.members_count", { count: members.length })}
            </Badge>
          </div>
          <Text as="p" size="sm" variant="secondary">
            {t("settings.team_description")}
          </Text>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsMemberModalOpen(true)}
        >
          <Icon name="add" size="sm" /> {t("settings.add_member")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {members.map((member) => (
          <div
            key={member.id}
            className="group flex items-center justify-between p-5 rounded-2xl border border-(--border) bg-(--surface-subtle) hover:bg-(--surface) hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/10 group-hover:scale-110 transition-transform relative">
                <Icon name="user" size="md" className="text-indigo-400" />
                {member.role === "Owner" && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-(--surface) flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm" />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Text as="span" size="md" weight="semi-bold">
                    {member.name}
                  </Text>
                  <Badge
                    variant={member.role === "Admin" ? "success" : "secondary"}
                    size="sm"
                    className={member.role === "Admin" ? "" : "opacity-60"}
                  >
                    {member.role === "Admin" ? "Admin" : "Authorized Agent"}
                  </Badge>
                  {member.status === "pending" && (
                    <Badge variant="warning" size="sm">
                      {t("settings.pending")}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Text
                    as="p"
                    size="xs"
                    variant="secondary"
                    className="font-mono opacity-60"
                  >
                    {member.address}
                  </Text>
                  <div className="w-1 h-1 bg-(--border) rounded-full" />
                  <Text
                    as="p"
                    size="xs"
                    variant="secondary"
                    className="opacity-60"
                  >
                    {member.role}
                  </Text>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col items-end">
                <Text
                  as="p"
                  size="xs"
                  variant="secondary"
                  className="opacity-50 uppercase tracking-widest font-bold"
                >
                  {t("settings.access_level")}
                </Text>
                <Text
                  as="p"
                  size="sm"
                  weight="semi-bold"
                  className="text-indigo-400"
                >
                  {member.role === "Admin"
                    ? t("settings.full_access")
                    : member.role === "Viewer"
                      ? t("settings.read_only")
                      : t("settings.limited_permissions")}
                </Text>
              </div>
              <Button variant="secondary" size="xs">
                <Icon name="settings" size="xs" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderRolesUI = () => (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <Text as="h2" size="lg" weight="medium">
            Custom Roles
          </Text>
          <Text as="p" size="sm" variant="secondary">
            {t("settings.roles_description")}
          </Text>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsRoleModalOpen(true)}
        >
          <Icon name="add" size="sm" /> {t("settings.create_role")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {roles.map((role) => (
          <Card
            key={role.id}
            className="p-6 rounded-2xl border border-(--border) bg-(--surface-subtle) hover:border-indigo-500/30 transition-all duration-300 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <Text
                  as="h3"
                  size="md"
                  weight="bold"
                  className="group-hover:text-indigo-400 transition-colors"
                >
                  {role.name}
                </Text>
                <Text
                  as="p"
                  size="sm"
                  variant="secondary"
                  className="mt-1 leading-relaxed opacity-70"
                >
                  {role.description}
                </Text>
              </div>
              <Button variant="secondary" size="xs">
                Edit
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-auto">
              {role.permissions.map((p) => (
                <Badge
                  key={p}
                  size="sm"
                  style={{
                    backgroundColor: "var(--accent-transparent-strong)",
                    color: "var(--accent)",
                    border: "1px solid var(--accent-transparent)",
                  }}
                >
                  {t(
                    AVAILABLE_PERMISSIONS.find((ap) => ap.id === p)?.nameKey ??
                      "",
                  ) || p}
                </Badge>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const handleExportCSV = () => {
    const headers = ["Timestamp", "Wallet", "Action", "Details", "Status"];
    const rows = auditLogs.map((log) => [
      log.timestamp,
      log.wallet,
      log.action,
      log.details,
      log.status,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((e) => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `quipay_audit_logs_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setNotification({
      message: t("settings.audit_exported"),
      type: "success",
    });
  };

  const renderAuditLog = () => (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Text as="h2" size="lg" weight="medium">
            Audit Logs
          </Text>
          <Text as="p" size="sm" variant="secondary">
            {t("settings.audit_description")}
          </Text>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="sm"
            className="shadow-sm"
            onClick={handleExportCSV}
          >
            <Icon name="download" size="sm" /> {t("settings.export_csv")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-(--surface-subtle) border border-(--border) shadow-inner">
        <div className="flex-1 min-w-60 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-(--muted) pointer-events-none">
            <Icon name="search" size="sm" />
          </div>
          <input
            type="text"
            placeholder={t("settings.search_logs_placeholder")}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-(--border) bg-(--surface) text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:opacity-50"
            value={auditSearch}
            onChange={(e) => setAuditSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Text
            as="span"
            size="sm"
            weight="medium"
            className="text-(--muted) whitespace-nowrap"
          >
            {t("settings.status_filter")}
          </Text>
          <select
            className="p-2 rounded-xl border border-(--border) bg-(--surface) text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            value={auditFilter}
            onChange={(e) => setAuditFilter(e.target.value)}
          >
            <option value="all">{t("settings.all_status")}</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      <Card className="overflow-hidden border-(--border) rounded-2xl shadow-sm bg-(--surface)">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-(--surface-subtle) border-b border-(--border)">
                <th className="p-4">
                  <Text
                    as="span"
                    size="xs"
                    weight="bold"
                    variant="secondary"
                    className="uppercase tracking-widest"
                  >
                    {t("settings.timestamp")}
                  </Text>
                </th>
                <th className="p-4">
                  <Text
                    as="span"
                    size="xs"
                    weight="bold"
                    variant="secondary"
                    className="uppercase tracking-widest"
                  >
                    {t("wallet.connect").split(" ")[0]}
                  </Text>
                </th>
                <th className="p-4">
                  <Text
                    as="span"
                    size="xs"
                    weight="bold"
                    variant="secondary"
                    className="uppercase tracking-widest"
                  >
                    Action
                  </Text>
                </th>
                <th className="p-4">
                  <Text
                    as="span"
                    size="xs"
                    weight="bold"
                    variant="secondary"
                    className="uppercase tracking-widest"
                  >
                    Details
                  </Text>
                </th>
                <th className="p-4">
                  <Text
                    as="span"
                    size="xs"
                    weight="bold"
                    variant="secondary"
                    className="uppercase tracking-widest"
                  >
                    Status
                  </Text>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--border)">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-indigo-500/5 transition-colors group"
                  >
                    <td className="p-4">
                      <Text
                        as="span"
                        size="sm"
                        className="font-mono text-[11px] opacity-70 group-hover:opacity-100 transition-opacity"
                      >
                        {log.timestamp}
                      </Text>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                          <Icon
                            name="user"
                            size="xs"
                            className="text-indigo-400"
                          />
                        </div>
                        <Text
                          as="span"
                          size="sm"
                          className="font-mono text-xs hover:text-indigo-400 cursor-pointer transition-colors"
                        >
                          {log.wallet}
                        </Text>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge
                        size="sm"
                        variant="secondary"
                        className="font-medium"
                      >
                        {log.action}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Text
                        as="span"
                        size="sm"
                        weight="medium"
                        className="opacity-90"
                      >
                        {log.details}
                      </Text>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            log.status === "success"
                              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                              : log.status === "failure"
                                ? "bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                                : "bg-amber-400"
                          } ${log.status === "pending" ? "animate-pulse" : ""}`}
                        />
                        <Text
                          as="span"
                          size="sm"
                          weight="semi-bold"
                          className="capitalize group-hover:text-indigo-400 transition-colors"
                        >
                          {log.status}
                        </Text>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Icon name="search" size="lg" className="opacity-20" />
                      <Text as="p" size="md" variant="secondary">
                        {t("settings.no_logs_found")}
                      </Text>
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          setAuditSearch("");
                          setAuditFilter("all");
                        }}
                      >
                        {t("common.clear_filters")}
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderApprovals = () => (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <Text as="h2" size="lg" weight="medium">
            Approval Requests
          </Text>
          <Text as="p" size="sm" variant="secondary">
            {t("settings.approval_description")}
          </Text>
        </div>
      </div>

      <div className="py-20 flex flex-col items-center justify-center text-center rounded-3xl border-2 border-dashed border-(--border) bg-(--surface-subtle)/30 backdrop-blur-sm">
        <div className="w-20 h-20 bg-linear-to-br from-indigo-500/10 to-purple-500/10 rounded-full flex items-center justify-center mb-6 relative">
          <div className="absolute inset-0 bg-indigo-500/5 rounded-full animate-ping" />
          <Icon
            name="check"
            size="lg"
            className="text-indigo-400 relative z-10"
          />
        </div>
        <Text as="h3" size="lg" weight="bold" className="mb-2">
          {t("settings.queue_empty")}
        </Text>
        <Text
          as="p"
          size="md"
          variant="secondary"
          className="mb-8 max-w-xs leading-relaxed"
        >
          {t("settings.no_pending_actions")}
        </Text>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void window.open("/governance", "_blank")}
        >
          {t("settings.view_governance")}
        </Button>
      </div>
    </div>
  );

  const renderTemplates = () => (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Text as="h2" size="lg" weight="medium">
              {t("settings.tab_templates")}
            </Text>
            <Badge variant="secondary" size="sm" className="opacity-70">
              {t("settings.templates_count", { count: templates.length })}
            </Badge>
          </div>
          <Text as="p" size="sm" variant="secondary">
            {t("settings.templates_description")}
          </Text>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void window.open("/create-stream", "_blank")}
        >
          <Icon name="add" size="sm" /> {t("settings.create_template")}
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-center rounded-3xl border-2 border-dashed border-(--border) bg-(--surface-subtle)/30">
          <div className="w-16 h-16 bg-linear-to-br from-indigo-500/10 to-purple-500/10 rounded-full flex items-center justify-center mb-4">
            <Icon name="fileText" size="lg" className="text-indigo-400" />
          </div>
          <Text as="h3" size="lg" weight="bold" className="mb-2">
            {t("settings.no_templates")}
          </Text>
          <Text as="p" size="md" variant="secondary" className="mb-6 max-w-xs">
            {t("settings.no_templates_desc")}
          </Text>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void window.open("/create-stream", "_blank")}
          >
            {t("settings.create_first_stream")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="p-5 rounded-2xl border border-(--border) bg-(--surface-subtle) hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Text
                    as="h3"
                    size="md"
                    weight="bold"
                    className="group-hover:text-indigo-400 transition-colors"
                  >
                    {template.name}
                  </Text>
                  <Text as="p" size="xs" variant="secondary" className="mt-0.5">
                    {new Date(template.createdAt).toLocaleDateString()}
                  </Text>
                </div>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => deleteTemplate(template.id)}
                >
                  <Icon name="delete" size="xs" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  size="sm"
                  style={{
                    backgroundColor: "var(--accent-transparent-strong)",
                    color: "var(--accent)",
                    border: "1px solid var(--accent-transparent)",
                  }}
                >
                  {template.token}
                </Badge>
                <Badge variant="secondary" size="sm">
                  {template.frequency}
                </Badge>
                <Badge variant="secondary" size="sm">
                  {template.duration} days
                </Badge>
                {template.enableCliff && (
                  <Badge variant="warning" size="sm">
                    Cliff: {template.cliffDuration} days
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderNotifications = () => (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <Text as="h2" size="lg" weight="medium">
            {t("settings.notification_prefs")}
          </Text>
          <Text as="p" size="sm" variant="secondary">
            {t("settings.notification_desc")}
          </Text>
        </div>
      </div>

      <Card className="p-6 rounded-2xl border border-(--border) bg-(--surface-subtle)">
        <div className="flex flex-col gap-6">
          <div>
            <Text as="h3" size="md" weight="bold" className="mb-4">
              {t("settings.delivery_channels")}
            </Text>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-(--border) bg-(--surface) hover:border-indigo-500/30 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={notificationSettings.emailEnabled}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      emailEnabled: e.target.checked,
                    })
                  }
                  className="w-5 h-5 rounded-lg border-2 border-(--border)"
                />
                <div>
                  <Text as="span" size="sm" weight="medium">
                    {t("settings.email_notifications")}
                  </Text>
                  <Text as="p" size="xs" variant="secondary">
                    {t("settings.email_desc")}
                  </Text>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-(--border) bg-(--surface) hover:border-indigo-500/30 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={notificationSettings.inAppEnabled}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      inAppEnabled: e.target.checked,
                    })
                  }
                  className="w-5 h-5 rounded-lg border-2 border-(--border)"
                />
                <div>
                  <Text as="span" size="sm" weight="medium">
                    {t("settings.in_app_notifications")}
                  </Text>
                  <Text as="p" size="xs" variant="secondary">
                    {t("settings.in_app_desc")}
                  </Text>
                </div>
              </label>
            </div>
          </div>

          <div>
            <Text as="h3" size="md" weight="bold" className="mb-4">
              {t("settings.alert_types")}
            </Text>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-(--border) bg-(--surface) hover:border-indigo-500/30 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={notificationSettings.cliffUnlockAlerts}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      cliffUnlockAlerts: e.target.checked,
                    })
                  }
                  className="w-5 h-5 rounded-lg border-2 border-(--border)"
                />
                <div>
                  <Text as="span" size="sm" weight="medium">
                    {t("settings.cliff_unlock_alerts")}
                  </Text>
                  <Text as="p" size="xs" variant="secondary">
                    {t("settings.cliff_unlock_desc")}
                  </Text>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-(--border) bg-(--surface) hover:border-indigo-500/30 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={notificationSettings.streamEndingAlerts}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      streamEndingAlerts: e.target.checked,
                    })
                  }
                  className="w-5 h-5 rounded-lg border-2 border-(--border)"
                />
                <div>
                  <Text as="span" size="sm" weight="medium">
                    {t("settings.stream_ending_alerts")}
                  </Text>
                  <Text as="p" size="xs" variant="secondary">
                    {t("settings.stream_ending_desc")}
                  </Text>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-(--border) bg-(--surface) hover:border-indigo-500/30 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={notificationSettings.lowRunwayAlerts}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      lowRunwayAlerts: e.target.checked,
                    })
                  }
                  className="w-5 h-5 rounded-lg border-2 border-(--border)"
                />
                <div>
                  <Text as="span" size="sm" weight="medium">
                    {t("settings.low_runway_alerts")}
                  </Text>
                  <Text as="p" size="xs" variant="secondary">
                    {t("settings.low_runway_desc")}
                  </Text>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setNotification({
                  message: t("settings.notification_saved"),
                  type: "success",
                });
              }}
            >
              {t("settings.save_preferences")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "team", label: t("settings.tab_team"), icon: "user" },
    { id: "roles", label: t("settings.tab_roles"), icon: "settings" },
    { id: "branding", label: "Branding", icon: "image" },
    { id: "templates", label: t("settings.tab_templates"), icon: "fileText" },
    {
      id: "notifications",
      label: t("settings.tab_notifications"),
      icon: "bell",
    },
    { id: "network", label: t("settings.tab_network"), icon: "activity" },
    { id: "approvals", label: t("settings.tab_approvals"), icon: "check" },
    { id: "audit", label: t("settings.tab_audit"), icon: "fileText" },
  ];

  return (
    <Layout.Content>
      <SeoHelmet
        title={t("settings.page_title")}
        description={t("settings.page_description")}
      />
      <Layout.Inset>
        <header className="mb-10">
          <div className="flex items-center justify-between">
            <Text
              as="h1"
              size="xl"
              weight="bold"
              className="mb-2 tracking-tight"
            >
              {t("settings.vault_settings")}
            </Text>
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              className="flex items-center gap-2 rounded-xl border border-(--border) bg-(--surface-subtle) px-4 py-2 text-sm font-medium text-(--muted) transition-all duration-200 hover:bg-(--surface) hover:text-(--text) hover:shadow-md"
            >
              {theme === "light" ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
              {theme === "light"
                ? t("settings.dark_mode")
                : t("settings.light_mode")}
            </button>
          </div>
          <Text as="p" size="md" variant="secondary" className="max-w-2xl">
            {t("settings.vault_description")}
          </Text>
        </header>

        {notification && (
          <Notification
            variant={notification.type}
            onClose={() => setNotification(null)}
            title={notification.type === "success" ? "Success" : "Error"}
            className="mb-8 animate-slide-up"
          >
            {notification.message}
          </Notification>
        )}

        {/* Glassmorphism Navigation */}
        <nav className="flex items-center gap-1 p-1 mb-10 rounded-2xl bg-(--surface-subtle) border border-(--border) overflow-x-auto no-scrollbar scroll-smooth shadow-inner">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-(--surface) text-(--text) shadow-lg shadow-indigo-500/10 border border-(--border) -translate-y-px"
                  : "text-(--muted) hover:text-(--text) hover:bg-(--surface)/50"
              }`}
            >
              <Icon name={tab.icon} size="sm" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="min-h-125">
          {activeTab === "team" && renderTeamPortal()}
          {activeTab === "roles" && renderRolesUI()}
          {activeTab === "branding" && address && (
            <div>
              <Text as="h2" size="md" weight="bold" className="mb-2">
                Payslip Branding
              </Text>
              <p className="mb-6 text-sm text-(--muted)">
                Customize your company logo and colors for worker payslips
              </p>
              <BrandingSettings employerAddress={address} />
            </div>
          )}
          {activeTab === "templates" && renderTemplates()}
          {activeTab === "notifications" && renderNotifications()}
          {activeTab === "network" && (
            <div style={{ maxWidth: 640 }}>
              <Text as="h2" size="md" weight="bold" className="mb-2">
                {t("settings.network_health")}
              </Text>
              <p className="mb-4 text-sm text-(--muted)">
                {t("settings.network_health_desc")}
              </p>
              <NetworkHealthMonitor />
            </div>
          )}
          {activeTab === "audit" && renderAuditLog()}
          {activeTab === "approvals" && renderApprovals()}
        </div>

        {/* Modals with premium styling */}
        <Modal
          visible={isMemberModalOpen}
          onClose={() => setIsMemberModalOpen(false)}
        >
          <div className="p-8 bg-(--surface) text-(--text) rounded-3xl shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
            <Text as="h2" size="lg" weight="bold" className="mb-6">
              {t("settings.invite_collaborator")}
            </Text>
            <div className="flex flex-col gap-5">
              <Input
                id="name"
                label="Display Name"
                placeholder="e.g. Sarah Connor"
                fieldSize="md"
              />
              <Input
                id="address"
                label="Stellar Wallet Address"
                placeholder="G..."
                fieldSize="md"
              />
              <div className="flex flex-col gap-2">
                <Text
                  as="span"
                  size="sm"
                  weight="semi-bold"
                  className="text-(--muted)"
                >
                  {t("settings.assign_role")}
                </Text>
                <select
                  className="w-full p-3.5 rounded-xl border border-(--border) bg-(--surface-subtle) text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                  onChange={(e) => {
                    const role = roles.find((r) => r.id === e.target.value);
                    if (role) {
                      // TODO: pre-check on-chain permissions in UI
                    }
                  }}
                >
                  <option value="">{t("settings.select_role")}</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <Text as="p" size="xs" variant="secondary" className="mt-1">
                  {t("settings.register_note")}
                </Text>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsMemberModalOpen(false)}
                >
                  {t("common.dismiss")}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setNotification({
                      message: t("settings.invitation_sent"),
                      type: "success",
                    });
                    setIsMemberModalOpen(false);
                  }}
                >
                  {t("settings.send_invite")}
                </Button>
              </div>
            </div>
          </div>
        </Modal>

        <Modal
          visible={isRoleModalOpen}
          onClose={() => setIsRoleModalOpen(false)}
        >
          <div className="p-8 bg-(--surface) text-(--text) max-w-lg rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/5 rounded-full -ml-16 -mt-16 blur-3xl" />
            <Text as="h2" size="lg" weight="bold" className="mb-6">
              {t("settings.create_custom_role")}
            </Text>
            <div className="flex flex-col gap-5">
              <Input
                id="roleName"
                label="Role Name"
                placeholder="e.g. Treasury Auditor"
                fieldSize="md"
              />
              <Input
                id="roleDesc"
                label="Brief Description"
                placeholder="Purpose of this role"
                fieldSize="md"
              />

              <div className="flex flex-col gap-3 mt-2">
                <Text
                  as="span"
                  size="sm"
                  weight="semi-bold"
                  className="text-(--muted)"
                >
                  {t("settings.capability_permissions")}
                </Text>
                <div className="grid grid-cols-1 gap-3 max-h-75 overflow-y-auto pr-2 no-scrollbar">
                  {AVAILABLE_PERMISSIONS.map((p) => (
                    <label
                      key={p.id}
                      className="group flex items-start gap-4 p-4 rounded-2xl border border-(--border) bg-(--surface-subtle) hover:border-indigo-500/40 hover:bg-(--surface) cursor-pointer transition-all duration-300"
                    >
                      <div className="relative flex items-center mt-1">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded-lg border-2 border-(--border) appearance-none checked:bg-indigo-500 checked:border-indigo-500 transition-all cursor-pointer"
                        />
                        <Icon
                          name="check"
                          size="xs"
                          className="absolute left-1 text-white opacity-0 group-has-checked:opacity-100 transition-opacity"
                        />
                      </div>
                      <div>
                        <Text
                          as="p"
                          size="sm"
                          weight="bold"
                          className="group-hover:text-indigo-400 transition-colors"
                        >
                          {t(p.nameKey)}
                        </Text>
                        <Text
                          as="p"
                          size="xs"
                          variant="secondary"
                          className="mt-0.5 leading-relaxed opacity-80"
                        >
                          {t(p.descKey)}
                        </Text>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsRoleModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setNotification({
                      message: t("settings.role_created"),
                      type: "success",
                    });
                    setIsRoleModalOpen(false);
                  }}
                >
                  {t("settings.define_role")}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      </Layout.Inset>
    </Layout.Content>
  );
};

export default Settings;
