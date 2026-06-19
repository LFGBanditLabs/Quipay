import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react";
import { useWallet } from "../hooks/useWallet";
import {
  usePersistentNotifications,
  type NotificationType,
  type PersistentNotification,
} from "../hooks/usePersistentNotifications";

/* ── UI Constants ── */

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: string; color: string; label: string }
> = {
  tx_confirmed: { icon: "✓", color: "#22c55e", label: "Confirmed" },
  tx_failed: { icon: "✕", color: "#ef4444", label: "Failed" },
  stream_started: { icon: "▶", color: "#facc15", label: "Stream Started" },
  stream_completed: { icon: "⏹", color: "#eab308", label: "Stream Completed" },
  payroll_disbursed: {
    icon: "💸",
    color: "#fde047",
    label: "Payroll Disbursed",
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

/* ── Notification item ── */

const NotificationItem: React.FC<{
  notification: PersistentNotification;
  onRead: (id: string) => void;
}> = ({ notification, onRead }) => {
  const config = TYPE_CONFIG[notification.type];

  return (
    <div
      role="listitem"
      onClick={() => !notification.read && onRead(notification.id)}
      className={`relative flex gap-3 px-4 py-3.5 border-b border-white/[0.06] transition-colors cursor-pointer hover:bg-white/[0.03] last:border-0 ${
        !notification.read ? "bg-yellow-400/[0.03]" : ""
      }`}
    >
      {/* Icon dot */}
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-[13px]"
        style={{ color: config.color }}
      >
        {config.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">
            {config.label}
          </span>
          <span className="text-[10px] text-neutral-700 whitespace-nowrap">
            {formatTimeAgo(notification.timestamp)}
          </span>
        </div>
        <p className="text-[13px] font-medium text-white leading-snug break-words">
          {notification.message}
        </p>
      </div>

      {!notification.read && (
        <div
          className="absolute right-4 top-4 h-2 w-2 rounded-full animate-pulse"
          style={{ backgroundColor: "#facc15" }}
          title="Unread"
        />
      )}
    </div>
  );
};

/* ── Main component ── */

const NotificationCenter: React.FC = () => {
  const { t } = useTranslation();
  const { address } = useWallet();
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    usePersistentNotifications(address);

  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const togglePanel = useCallback(() => setIsOpen((prev) => !prev), []);

  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left">
      {/* Bell button */}
      <button
        ref={triggerRef}
        onClick={togglePanel}
        aria-label={t("notifications.aria_bell", "Notification Center")}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
          isOpen
            ? "bg-white/[0.08] text-white"
            : "text-neutral-400 hover:bg-white/[0.06] hover:text-white"
        }`}
      >
        <Bell
          className={`h-[18px] w-[18px] transition-transform ${isOpen ? "scale-110" : ""}`}
        />
        {unreadCount > 0 && (
          <span
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black text-black shadow ring-1 ring-black"
            style={{ backgroundColor: "#facc15" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          ref={panelRef}
          role="status"
          aria-live="polite"
          className="absolute right-0 z-[100] mt-2 flex max-h-[480px] w-80 sm:w-96 flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#111] shadow-[0_24px_64px_rgba(0,0,0,0.7)]"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-4 py-3.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-bold text-white">
                {t("notifications.title", "Notifications")}
              </h3>
              {unreadCount > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-black text-black"
                  style={{ backgroundColor: "#facc15" }}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[12px] font-semibold hover:underline"
                style={{ color: "#facc15" }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05]">
                  <Bell className="h-6 w-6 text-neutral-700" />
                </div>
                <p className="text-[14px] font-semibold text-neutral-500">
                  {t("notifications.empty", "No notifications")}
                </p>
                <p className="mt-1 text-[12px] text-neutral-700">
                  We'll notify you when anything important happens.
                </p>
              </div>
            ) : (
              <div role="list">
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
          <div className="shrink-0 border-t border-white/[0.06] px-4 py-3 text-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-800">
              Auto-clears after 7 days
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
