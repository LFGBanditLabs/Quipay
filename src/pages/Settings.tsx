/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — @stellar/design-system types are incomplete for Badge, Card, Modal, Icon
import React, { useState } from "react";
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

// Types for local state
interface TeamMember {
  id: string;
  name: string;
  address: string;
  role: string;
  status: "active" | "pending";
}

interface CustomRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

interface AuditLog {
  id: string;
  timestamp: string;
  wallet: string;
  action: string;
  details: string;
  status: "success" | "failure" | "pending";
}

type TabId = "team" | "roles" | "audit" | "approvals";

const AVAILABLE_PERMISSIONS = [
  {
    id: "view_only",
    name: "View Only",
    description: "Can view all data but cannot perform any actions",
  },
  {
    id: "payroll_submit",
    name: "Payroll Submitter",
    description: "Can create and propose new payroll streams",
  },
  {
    id: "treasury_approve",
    name: "Treasury Approver",
    description: "Can approve treasury transactions and proposals",
  },
  {
    id: "treasury_execute",
    name: "Treasury Execution",
    description: "Can execute approved treasury transactions",
  },
  {
    id: "admin_manage",
    name: "Admin Management",
    description: "Can manage team members and custom roles",
  },
];

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>("team");
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [auditSearch, setAuditSearch] = useState("");
  const [auditFilter, setAuditFilter] = useState("all");

  // Mock Data
  const [members] = useState<TeamMember[]>([
    {
      id: "1",
      name: "Organization Owner",
      address: "GCFX...ABC1",
      role: "Owner",
      status: "active",
    },
    {
      id: "2",
      name: "Alice Manager",
      address: "GDYQ...DEF2",
      role: "Treasury Approver",
      status: "active",
    },
    {
      id: "3",
      name: "Bob Accountant",
      address: "GAHU...GHI3",
      role: "Payroll Submitter",
      status: "pending",
    },
  ]);

  const [roles] = useState<CustomRole[]>([
    {
      id: "r1",
      name: "Payroll Submitter",
      description: "Responsible for initiating payroll runs",
      permissions: ["payroll_submit", "view_only"],
    },
    {
      id: "r2",
      name: "Treasury Approver",
      description: "Authorizes high-value treasury movements",
      permissions: ["treasury_approve", "view_only"],
    },
    {
      id: "r3",
      name: "View Only",
      description: "Stakeholders who only need read access",
      permissions: ["view_only"],
    },
  ]);

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
              Team Management
            </Text>
            <Badge variant="secondary" size="sm" className="opacity-70">
              {members.length} Members
            </Badge>
          </div>
          <Text as="p" size="sm" variant="secondary">
            Invite and manage members of your treasury vault.
          </Text>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsMemberModalOpen(true)}
        >
          <Icon name="add" size="sm" /> Add Member
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {members.map((member) => (
          <div
            key={member.id}
            className="group flex items-center justify-between p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] hover:bg-[var(--surface)] hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/10 group-hover:scale-110 transition-transform relative">
                <Icon name="user" size="md" className="text-indigo-400" />
                {member.role === "Owner" && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-[var(--surface)] flex items-center justify-center">
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
                    variant={member.role === "Owner" ? "success" : "secondary"}
                    size="sm"
                    className={member.role === "Owner" ? "" : "opacity-60"}
                  >
                    {member.role === "Owner" ? "Owner" : "Authorized Agent"}
                  </Badge>
                  {member.status === "pending" && (
                    <Badge variant="warning" size="sm">
                      Pending
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
                  <div className="w-1 h-1 bg-[var(--border)] rounded-full" />
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
                  Access Level
                </Text>
                <Text
                  as="p"
                  size="sm"
                  weight="semi-bold"
                  className="text-indigo-400"
                >
                  {member.role === "Owner"
                    ? "Full Access"
                    : "Limited Permissions"}
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
            Define granular permissions for different team responsibilities.
          </Text>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsRoleModalOpen(true)}
        >
          <Icon name="add" size="sm" /> Create Role
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {roles.map((role) => (
          <Card
            key={role.id}
            className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] hover:border-indigo-500/30 transition-all duration-300 group"
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
                  {AVAILABLE_PERMISSIONS.find((ap) => ap.id === p)?.name || p}
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
      message: "Audit logs exported successfully!",
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
            A permanent, verifiable record of all actions performed by
            authorized wallets.
          </Text>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="sm"
            className="shadow-sm"
            onClick={handleExportCSV}
          >
            <Icon name="download" size="sm" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border)] shadow-inner">
        <div className="flex-1 min-w-[240px] relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none">
            <Icon name="search" size="sm" />
          </div>
          <input
            type="text"
            placeholder="Search logs by action, wallet, or details..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:opacity-50"
            value={auditSearch}
            onChange={(e) => setAuditSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Text
            as="span"
            size="sm"
            weight="medium"
            className="text-[var(--muted)] whitespace-nowrap"
          >
            Status:
          </Text>
          <select
            className="p-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            value={auditFilter}
            onChange={(e) => setAuditFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      <Card className="overflow-hidden border-[var(--border)] rounded-2xl shadow-sm bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--surface-subtle)] border-b border-[var(--border)]">
                <th className="p-4">
                  <Text
                    as="span"
                    size="xs"
                    weight="bold"
                    variant="secondary"
                    className="uppercase tracking-widest"
                  >
                    Timestamp
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
                    Wallet
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
            <tbody className="divide-y divide-[var(--border)]">
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
                        No logs found matching your filters.
                      </Text>
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          setAuditSearch("");
                          setAuditFilter("all");
                        }}
                      >
                        Clear Filters
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
            Queue of high-value treasury operations awaiting multi-sig
            authorization.
          </Text>
        </div>
      </div>

      <div className="py-20 flex flex-col items-center justify-center text-center rounded-3xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-subtle)]/30 backdrop-blur-sm">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full flex items-center justify-center mb-6 relative">
          <div className="absolute inset-0 bg-indigo-500/5 rounded-full animate-ping" />
          <Icon
            name="check"
            size="lg"
            className="text-indigo-400 relative z-10"
          />
        </div>
        <Text as="h3" size="lg" weight="bold" className="mb-2">
          Queue is Empty
        </Text>
        <Text
          as="p"
          size="md"
          variant="secondary"
          className="mb-8 max-w-xs leading-relaxed"
        >
          No pending treasury actions currently require your digital signature.
        </Text>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void window.open("/governance", "_blank")}
        >
          View Governance Overview
        </Button>
      </div>
    </div>
  );

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "team", label: "Team", icon: "user" },
    { id: "roles", label: "Roles", icon: "settings" },
    { id: "approvals", label: "Approvals", icon: "check" },
    { id: "audit", label: "Audit Log", icon: "fileText" },
  ];

  return (
    <Layout.Content>
      <SeoHelmet
        title="Security & Governance Settings | Quipay"
        description="Manage team access, custom roles, multi-sig approvals, and view structured audit logs for your Quipay treasury."
      />
      <Layout.Inset>
        <header className="mb-10">
          <Text as="h1" size="xl" weight="bold" className="mb-2 tracking-tight">
            Vault Settings
          </Text>
          <Text as="p" size="md" variant="secondary" className="max-w-2xl">
            Configure granular access controls, manage your treasury team, and
            monitor all organizational activity through structured audit trails.
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
        <nav className="flex items-center gap-1 p-1 mb-10 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border)] overflow-x-auto no-scrollbar scroll-smooth shadow-inner">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-[var(--surface)] text-[var(--text)] shadow-lg shadow-indigo-500/10 border border-[var(--border)] translate-y-[-1px]"
                  : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]/50"
              }`}
            >
              <Icon name={tab.icon} size="sm" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="min-h-[500px]">
          {activeTab === "team" && renderTeamPortal()}
          {activeTab === "roles" && renderRolesUI()}
          {activeTab === "audit" && renderAuditLog()}
          {activeTab === "approvals" && renderApprovals()}
        </div>

        {/* Modals with premium styling */}
        <Modal
          visible={isMemberModalOpen}
          onClose={() => setIsMemberModalOpen(false)}
        >
          <div className="p-8 bg-[var(--surface)] text-[var(--text)] rounded-3xl shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
            <Text as="h2" size="lg" weight="bold" className="mb-6">
              Invite Collaborator
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
                  className="text-[var(--muted)]"
                >
                  Assign Role
                </Text>
                <select className="w-full p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all">
                  <option value="">Select a role...</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsMemberModalOpen(false)}
                >
                  Dismiss
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setNotification({
                      message: "Invitation sent successfully!",
                      type: "success",
                    });
                    setIsMemberModalOpen(false);
                  }}
                >
                  Send Invite
                </Button>
              </div>
            </div>
          </div>
        </Modal>

        <Modal
          visible={isRoleModalOpen}
          onClose={() => setIsRoleModalOpen(false)}
        >
          <div className="p-8 bg-[var(--surface)] text-[var(--text)] max-w-lg rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/5 rounded-full -ml-16 -mt-16 blur-3xl" />
            <Text as="h2" size="lg" weight="bold" className="mb-6">
              Create Custom Role
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
                  className="text-[var(--muted)]"
                >
                  Capability Permissions
                </Text>
                <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                  {AVAILABLE_PERMISSIONS.map((p) => (
                    <label
                      key={p.id}
                      className="group flex items-start gap-4 p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] hover:border-indigo-500/40 hover:bg-[var(--surface)] cursor-pointer transition-all duration-300"
                    >
                      <div className="relative flex items-center mt-1">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded-lg border-2 border-[var(--border)] appearance-none checked:bg-indigo-500 checked:border-indigo-500 transition-all cursor-pointer"
                        />
                        <Icon
                          name="check"
                          size="xs"
                          className="absolute left-1 text-white opacity-0 group-has-[:checked]:opacity-100 transition-opacity"
                        />
                      </div>
                      <div>
                        <Text
                          as="p"
                          size="sm"
                          weight="bold"
                          className="group-hover:text-indigo-400 transition-colors"
                        >
                          {p.name}
                        </Text>
                        <Text
                          as="p"
                          size="xs"
                          variant="secondary"
                          className="mt-0.5 leading-relaxed opacity-80"
                        >
                          {p.description}
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
                      message: "Custom role created successfully!",
                      type: "success",
                    });
                    setIsRoleModalOpen(false);
                  }}
                >
                  Define Role
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
