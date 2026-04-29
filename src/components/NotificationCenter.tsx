import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useWallet } from "../hooks/useWallet";
import {
  usePersistentNotifications,
  PersistentNotification,
  NotificationType,
} from "../hooks/usePersistentNotifications";
import { Bell, Check, AlertCircle, CheckCircle2, Play, LayoutList } from "lucide-react";

/* ── UI Constants ── */

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: React.ReactNode; label: string; color: string }
> = {
  tx_confirmed: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    label: "Confirmed",
    color: "var(--token-color-success-500)",
  },
  tx_failed: {
    icon: <AlertCircle className="w-4 h-4" />,
    label: "Failed",
    color: "var(--token-color-error-500)",
  },
  stream_started: {
    icon: <Play className="w-4 h-4" />,
    label: "Stream Started",
    color: "var(--token-color-accent)",
  },
  stream_completed: {
    icon: <Check className="w-4 h-4" />,
    label: "Stream Completed",
    color: "var(--token-color-success-500)",
  },
  payroll_disbursed: {
    icon: <LayoutList className="w-4 h-4" />,
    label: "Payroll Disbursed",
    color: "var(--token-color-warning-500)",
  },
};

/* ── Utility ── */

const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

/* ── Components ── */

const NotificationItem: React.FC<{
  notification: PersistentNotification;
  onRead: (id: string) => void;
}> = ({ notification, onRead }) => {
  const config = TYPE_CONFIG[notification.type as NotificationType];

  return (
    <div
      role="listitem"
      onClick={() => !notification.read && onRead(notification.id)}
      className={`relative flex gap-1 p-4 border-b border-border transition-colors cursor-pointer hover:bg-surface-subtle/50 ${
        !notification.read ? "bg-surface-subtle/30" : ""
      }`}
    >
      <div
        className="mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-surface-subtle text-muted"
        style={{ color: config.color }}
      >
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            {config.label}
          </span>
          <span className="text-[10px] text-muted whitespace-nowrap">
            {formatTimeAgo(notification.timestamp)}
          </span>
        </div>
        <p className="text-sm font-medium text-text leading-snug break-words">
          {notification.message}
        </p>
      </div>
      {!notification.read && (
        <div
          className="absolute top-4 right-4 w-2 h-2 rounded-full bg-accent animate-pulse"
          title="Unread"
        />
      )}
    </div>
  );
};

const NotificationCenter: React.FC = () => {
  const { t } = useTranslation();
  const { address } = useWallet();
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    usePersistentNotifications(address);

  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Toggle panel
  const togglePanel = useCallback(() => {
    setIsOpen((prev: boolean) => !prev);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={togglePanel}
        aria-label={t("notifications.aria_bell", "Notification Center")}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className="relative group min-h-11 min-w-11 flex items-center justify-center rounded-xl p-2 text-muted transition-all hover:bg-surface-subtle hover:text-text focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <Bell
          className={`w-5 h-5 transition-transform ${isOpen ? "scale-110" : ""}`}
        />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-500 px-1 text-[10px] font-bold text-white shadow-sm ring-1 ring-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          role="status"
          aria-live="polite"
          className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[500px] flex flex-col rounded-2xl border border-border bg-surface shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-subtle/20 rounded-t-2xl">
            <h3 className="text-sm font-bold text-text">
              {t("notifications.title", "Notifications")}
              {unreadCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-surface text-[10px] font-bold text-muted">
                  {unreadCount} UNREAD
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-semibold text-accent hover:underline focus:outline-none"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-surface-subtle flex items-center justify-center mb-3">
                  <Bell className="w-6 h-6 text-muted/40" />
                </div>
                <p className="text-sm font-medium text-muted">
                  {t("notifications.empty", "No notifications found")}
                </p>
                <p className="text-xs text-muted/60 mt-1">
                  We'll notify you here when anything important happens.
                </p>
              </div>
            ) : (
              <div role="list" className="divide-y divide-border">
                {notifications.map((notif) => (
                  <NotificationItem
                    key={notif.id}
                    notification={notif}
                    onRead={markAsRead}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-surface-subtle/10 border-t border-border rounded-b-2xl text-center">
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted/40">
              Auto-clears after 7 days
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
