/* eslint-disable react-refresh/only-export-components */
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { useNotification } from "../hooks/useNotification";
import type { PersistentNotificationType } from "../providers/notificationStorage";

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
  action?: {
    label: string;
    onClick: () => void;
  };
  autoDismissMs?: number;
}

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
    this.listeners.forEach((listener) => listener());
  }

  getAlerts() {
    return this.alerts;
  }

  addAlert(alert: Omit<ProtocolAlert, "id" | "timestamp" | "read">) {
    const recent = this.alerts.find(
      (item) => item.title === alert.title && Date.now() - item.timestamp < 60_000,
    );
    if (recent) return recent.id;

    const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next: ProtocolAlert = {
      ...alert,
      id,
      timestamp: Date.now(),
      read: false,
    };

    this.alerts = [next, ...this.alerts].slice(0, this.maxAlerts);
    this.notify();

    if (alert.autoDismissMs) {
      setTimeout(() => this.dismissAlert(id), alert.autoDismissMs);
    }

    return id;
  }

  markAsRead(id: string) {
    this.alerts = this.alerts.map((alert) =>
      alert.id === id ? { ...alert, read: true } : alert,
    );
    this.notify();
  }

  markAllRead() {
    this.alerts = this.alerts.map((alert) => ({ ...alert, read: true }));
    this.notify();
  }

  dismissAlert(id: string) {
    this.alerts = this.alerts.filter((alert) => alert.id !== id);
    this.notify();
  }

  clearAll() {
    this.alerts = [];
    this.notify();
  }

  getUnreadCount() {
    return this.alerts.filter((alert) => !alert.read).length;
  }
}

export const alertStore = new AlertStore();

export function useAlertStore() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    return alertStore.subscribe(() => forceRender((count) => count + 1));
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

type UnifiedNotification = {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  accent: string;
  label: string;
  icon: string;
  onOpen?: () => void;
  onDismiss?: () => void;
};

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

const ALERT_META: Record<
  AlertSeverity,
  { accent: string; label: string; icon: string }
> = {
  critical: { accent: "var(--token-color-error-500)", label: "Critical", icon: "!" },
  warning: { accent: "var(--token-color-warning-500)", label: "Warning", icon: "!" },
  info: { accent: "var(--token-color-accent)", label: "Info", icon: "i" },
  success: { accent: "var(--token-color-success-500)", label: "Success", icon: "OK" },
};

const PERSISTED_META: Record<
  PersistentNotificationType,
  { accent: string; label: string; icon: string }
> = {
  tx_confirmed: {
    accent: "var(--token-color-success-500)",
    label: "Confirmed",
    icon: "OK",
  },
  tx_failed: {
    accent: "var(--token-color-error-500)",
    label: "Failed",
    icon: "!",
  },
  stream_started: {
    accent: "var(--token-color-accent)",
    label: "Started",
    icon: "S",
  },
  stream_completed: {
    accent: "var(--token-color-success-500)",
    label: "Completed",
    icon: "DONE",
  },
  payroll_disbursed: {
    accent: "var(--token-color-warning-500)",
    label: "Payroll",
    icon: "$",
  },
};

const formatAge = (timestamp: number) => {
  const age = Date.now() - timestamp;
  if (age < 60_000) return "just now";
  if (age < 3_600_000) return `${Math.floor(age / 60_000)}m ago`;
  if (age < 86_400_000) return `${Math.floor(age / 3_600_000)}h ago`;
  return `${Math.floor(age / 86_400_000)}d ago`;
};

const NotificationCenter = () => {
  const { t } = useTranslation();
  const {
    alerts,
    unreadCount: alertUnreadCount,
    markAsRead,
    markAllRead,
    dismissAlert,
  } = useAlertStore();
  const {
    streamNotifications,
    unreadCount: persistedUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<UnifiedNotification[]>(
    () =>
      [
        ...streamNotifications.map((notification) => {
          const meta = PERSISTED_META[notification.type];
          return {
            id: notification.id,
            title: notification.title,
            message: notification.message,
            timestamp: Date.parse(notification.timestamp),
            read: notification.read,
            accent: meta.accent,
            label: meta.label,
            icon: meta.icon,
            onOpen: () => {
              if (!notification.read) {
                markNotificationAsRead(notification.id);
              }
            },
          };
        }),
        ...alerts.map((alert) => {
          const meta = ALERT_META[alert.severity];
          return {
            id: alert.id,
            title: alert.title,
            message: alert.message,
            timestamp: alert.timestamp,
            read: alert.read,
            accent: meta.accent,
            label: meta.label,
            icon: meta.icon,
            onOpen: () => {
              if (!alert.read) {
                markAsRead(alert.id);
              }
              alert.action?.onClick();
            },
            onDismiss: () => dismissAlert(alert.id),
          };
        }),
      ].sort((left, right) => right.timestamp - left.timestamp),
    [
      alerts,
      dismissAlert,
      markAsRead,
      markNotificationAsRead,
      streamNotifications,
    ],
  );

  const totalUnread = alertUnreadCount + persistedUnreadCount;

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const focusListItem = useCallback((index: number) => {
    const nodes =
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        "[data-notification-item='true']",
      ) ?? [];
    if (nodes.length === 0) return;
    const safeIndex = Math.max(0, Math.min(index, nodes.length - 1));
    nodes[safeIndex]?.focus();
  }, []);

  const handleListKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const nodes =
        listRef.current?.querySelectorAll<HTMLButtonElement>(
          "[data-notification-item='true']",
        ) ?? [];
      if (nodes.length === 0) return;

      const activeIndex = Array.from(nodes).findIndex(
        (node) => node === document.activeElement,
      );

      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusListItem(activeIndex < 0 ? 0 : activeIndex + 1);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        focusListItem(activeIndex <= 0 ? 0 : activeIndex - 1);
      }
      if (event.key === "Home") {
        event.preventDefault();
        focusListItem(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        focusListItem(nodes.length - 1);
      }
    },
    [focusListItem],
  );

  const handleMarkAllRead = useCallback(() => {
    markAllNotificationsAsRead();
    markAllRead();
  }, [markAllNotificationsAsRead, markAllRead]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen((current) => !current)}
        aria-label={t("notifications.title", "Notifications")}
        aria-expanded={isOpen}
        style={{
          position: "relative",
          width: "40px",
          height: "40px",
          borderRadius: "999px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 4px 12px var(--shadow-color, rgba(0,0,0,0.15))",
          cursor: "pointer",
          color: "var(--text)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <IconBell />
        {totalUnread > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-2px",
              right: "-2px",
              minWidth: 18,
              height: 18,
              borderRadius: "999px",
              background: "var(--token-color-error-500)",
              color: "#fff",
              fontSize: "10px",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 5px",
            }}
          >
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 10px)",
            right: 0,
            width: "min(92vw, 380px)",
            maxHeight: "480px",
            overflow: "hidden",
            borderRadius: "16px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            boxShadow: "0 18px 40px -18px var(--shadow-color)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
          }}
          role="status"
          aria-live="polite"
        >
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div>
              <div
                style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}
              >
                {t("notifications.title", "Notifications")}
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {totalUnread > 0 ? `${totalUnread} unread` : "All caught up"}
              </div>
            </div>
            {totalUnread > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "var(--accent)",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div
            ref={listRef}
            onKeyDown={handleListKeyDown}
            style={{
              overflowY: "auto",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {items.length === 0 ? (
              <div
                style={{
                  padding: "36px 18px",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: "13px",
                }}
              >
                {t("notifications.empty", "No notifications yet")}
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    position: "relative",
                    border: "1px solid var(--border)",
                    borderLeft: `3px solid ${item.accent}`,
                    borderRadius: "12px",
                    background: item.read
                      ? "var(--surface)"
                      : "color-mix(in srgb, var(--surface) 92%, white 8%)",
                  }}
                >
                  <button
                    data-notification-item="true"
                    onClick={item.onOpen}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "12px 14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        marginBottom: "6px",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "11px",
                          fontWeight: 700,
                          color: item.accent,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        <span aria-hidden="true">{item.icon}</span>
                        <span>{item.label}</span>
                      </span>
                      <time style={{ fontSize: "11px", color: "var(--muted)" }}>
                        {formatAge(item.timestamp)}
                      </time>
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "var(--text)",
                        marginBottom: "4px",
                      }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        lineHeight: 1.45,
                        color: "var(--muted)",
                      }}
                    >
                      {item.message}
                    </div>
                  </button>
                  {!item.read && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        top: "12px",
                        right: item.onDismiss ? "36px" : "12px",
                        width: "8px",
                        height: "8px",
                        borderRadius: "999px",
                        background: item.accent,
                      }}
                    />
                  )}
                  {item.onDismiss && (
                    <button
                      onClick={item.onDismiss}
                      aria-label="Dismiss notification"
                      style={{
                        position: "absolute",
                        top: "8px",
                        right: "8px",
                        border: "none",
                        background: "none",
                        color: "var(--muted)",
                        cursor: "pointer",
                        padding: "4px",
                      }}
                    >
                      <IconX />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
