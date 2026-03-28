/**
 * NotificationCenter.tsx
 * ─────────────────────
 * A bell-icon notification center that shows critical protocol alerts,
 * treasury balance warnings, network degradation events, and user actions.
 * Persists across page navigation and badges unread count.
 */

/* eslint-disable react-refresh/only-export-components */
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

/* ── Types ──────────────────────────────────────────────────────────────────── */

export type AlertSeverity = "critical" | "warning" | "info" | "success";
export type AlertCategory =
  | "treasury"
  | "network"
  | "wallet"
  | "protocol"
  | "system";

export interface ProtocolAlert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: AlertCategory;
  timestamp: number;
  read: boolean;
  /** Optional action the user can take */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Optional: auto-dismiss after ms */
  autoDismissMs?: number;
}

/* ── Store (module-level singleton so alerts survive re-renders) ─────────── */

type Listener = () => void;

class AlertStore {
  private alerts: ProtocolAlert[] = [];
  private listeners: Set<Listener> = new Set();
  private maxAlerts = 50;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  getAlerts() {
    return this.alerts;
  }

  addAlert(alert: Omit<ProtocolAlert, "id" | "timestamp" | "read">) {
    // Deduplicate: don't add if an identical title exists in the last 60s
    const recent = this.alerts.find(
      (a) => a.title === alert.title && Date.now() - a.timestamp < 60_000,
    );
    if (recent) return recent.id;

    const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newAlert: ProtocolAlert = {
      ...alert,
      id,
      timestamp: Date.now(),
      read: false,
    };

    this.alerts = [newAlert, ...this.alerts].slice(0, this.maxAlerts);
    this.notify();

    // Auto-dismiss
    if (alert.autoDismissMs) {
      setTimeout(() => this.dismissAlert(id), alert.autoDismissMs);
    }

    return id;
  }

  markAsRead(id: string) {
    this.alerts = this.alerts.map((a) =>
      a.id === id ? { ...a, read: true } : a,
    );
    this.notify();
  }

  markAllRead() {
    this.alerts = this.alerts.map((a) => ({ ...a, read: true }));
    this.notify();
  }

  dismissAlert(id: string) {
    this.alerts = this.alerts.filter((a) => a.id !== id);
    this.notify();
  }

  clearAll() {
    this.alerts = [];
    this.notify();
  }

  getUnreadCount() {
    return this.alerts.filter((a) => !a.read).length;
  }
}

export const alertStore = new AlertStore();

/* ── Hook ───────────────────────────────────────────────────────────────────── */

export function useAlertStore() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    return alertStore.subscribe(() => forceRender((n) => n + 1));
  }, []);

  return {
    alerts: alertStore.getAlerts(),
    unreadCount: alertStore.getUnreadCount(),
    addAlert: alertStore.addAlert.bind(alertStore),
    markAsRead: alertStore.markAsRead.bind(alertStore),
    markAllRead: alertStore.markAllRead.bind(alertStore),
    dismissAlert: alertStore.dismissAlert.bind(alertStore),
    clearAll: alertStore.clearAll.bind(alertStore),
  };
}

/* ── Icons ──────────────────────────────────────────────────────────────────── */

const IconBell = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const IconX = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/* ── Severity styling ───────────────────────────────────────────────────────── */

const SEVERITY_STYLES: Record<
  AlertSeverity,
  { bg: string; border: string; icon: string; color: string }
> = {
  critical: {
    bg: "rgba(239, 68, 68, 0.08)",
    border: "rgba(239, 68, 68, 0.25)",
    icon: "🚨",
    color: "#ef4444",
  },
  warning: {
    bg: "rgba(245, 166, 35, 0.08)",
    border: "rgba(245, 166, 35, 0.25)",
    icon: "⚠️",
    color: "#f5a623",
  },
  info: {
    bg: "rgba(99, 102, 241, 0.08)",
    border: "rgba(99, 102, 241, 0.25)",
    icon: "ℹ️",
    color: "#6366f1",
  },
  success: {
    bg: "rgba(16, 185, 129, 0.08)",
    border: "rgba(16, 185, 129, 0.25)",
    icon: "✅",
    color: "#10b981",
  },
};

const CATEGORY_LABELS: Record<AlertCategory, string> = {
  treasury: "Treasury",
  network: "Network",
  wallet: "Wallet",
  protocol: "Protocol",
  system: "System",
};

/* ── Alert Item ─────────────────────────────────────────────────────────────── */

function AlertItem({
  alert,
  onRead,
  onDismiss,
}: {
  alert: ProtocolAlert;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const style = SEVERITY_STYLES[alert.severity];

  // Use state for current time so Date.now() is not called during render
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const age = now - alert.timestamp;
  const timeAgo =
    age < 60_000
      ? "just now"
      : age < 3_600_000
        ? `${Math.floor(age / 60_000)}m ago`
        : age < 86_400_000
          ? `${Math.floor(age / 3_600_000)}h ago`
          : `${Math.floor(age / 86_400_000)}d ago`;

  return (
    <div
      onClick={() => !alert.read && onRead(alert.id)}
      style={{
        padding: "12px 14px",
        borderRadius: "8px",
        background: alert.read ? "transparent" : style.bg,
        border: `1px solid ${alert.read ? "var(--border)" : style.border}`,
        cursor: alert.read ? "default" : "pointer",
        position: "relative",
        transition: "background 0.2s",
      }}
    >
      {/* Unread dot */}
      {!alert.read && (
        <span
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: style.color,
          }}
        />
      )}

      {/* Dismiss button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(alert.id);
        }}
        style={{
          position: "absolute",
          top: 6,
          right: alert.read ? 6 : 22,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--muted)",
          padding: "2px",
          opacity: 0.5,
        }}
        aria-label="Dismiss"
      >
        <IconX />
      </button>

      <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
        <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>
          {style.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "3px",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--text)",
              }}
            >
              {alert.title}
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                padding: "1px 6px",
                borderRadius: "4px",
                background: "var(--surface-subtle, rgba(255,255,255,0.05))",
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {CATEGORY_LABELS[alert.category]}
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "var(--muted)",
              lineHeight: 1.4,
            }}
          >
            {alert.message}
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "6px",
            }}
          >
            <span
              style={{ fontSize: "11px", color: "var(--muted)", opacity: 0.6 }}
            >
              {timeAgo}
            </span>
            {alert.action && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  alert.action?.onClick();
                }}
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: style.color,
                  background: "none",
                  border: `1px solid ${style.border}`,
                  borderRadius: "4px",
                  padding: "2px 8px",
                  cursor: "pointer",
                }}
              >
                {alert.action.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────────── */

const NotificationCenter: React.FC = () => {
  const { t } = useTranslation();
  const {
    alerts,
    unreadCount,
    markAsRead,
    markAllRead,
    dismissAlert,
    clearAll,
  } = useAlertStore();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((v) => !v);
  }, []);

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={handleToggle}
        aria-label={t("notifications.title", "Notifications")}
        style={{
          position: "relative",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text)",
          padding: "6px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <IconBell />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              minWidth: 16,
              height: 16,
              borderRadius: "8px",
              background: "#ef4444",
              color: "white",
              fontSize: "10px",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "380px",
            maxHeight: "480px",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            boxShadow: "0 12px 40px -10px var(--shadow-color, rgba(0,0,0,0.3))",
            zIndex: 1000,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "var(--text)",
              }}
            >
              {t("notifications.title", "Notifications")}
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--muted)",
                    fontWeight: 500,
                    marginLeft: "6px",
                  }}
                >
                  ({unreadCount} new)
                </span>
              )}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "11px",
                    color: "var(--accent, #6366f1)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Mark all read
                </button>
              )}
              {alerts.length > 0 && (
                <button
                  onClick={clearAll}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "11px",
                    color: "var(--muted)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Alert list */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {alerts.length === 0 ? (
              <div
                style={{
                  padding: "40px 16px",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: "13px",
                }}
              >
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>🔔</div>
                {t("notifications.empty", "No notifications yet")}
              </div>
            ) : (
              alerts.map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onRead={markAsRead}
                  onDismiss={dismissAlert}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
