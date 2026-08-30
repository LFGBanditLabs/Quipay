import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useNotifications } from "../hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";

export const NotificationCenter: React.FC = () => {
  const { t } = useTranslation();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    removeNotification,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const togglePanel = useCallback(() => setIsOpen((prev) => !prev), []);
  const closePanel = useCallback(() => setIsOpen(false), []);

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
      {/* Bell trigger button */}
      <button
        ref={triggerRef}
        onClick={togglePanel}
        aria-label={t("notifications.aria_bell", "Notification Center")}
        aria-haspopup="dialog"
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
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black text-black shadow ring-1 ring-black animate-pulse"
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
          role="dialog"
          aria-label={t("notifications.title", "Notifications")}
          className="absolute right-0 z-[100] mt-2 flex max-h-[500px] w-80 sm:w-96 flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#111] shadow-[0_24px_64px_rgba(0,0,0,0.8)] backdrop-blur-xl"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-4 py-3.5 bg-neutral-900/50">
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-bold text-white">
                {t("notifications.title", "Notifications")}
              </h3>
              {unreadCount > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-black text-black"
                  style={{ backgroundColor: "#facc15" }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-[11px] font-semibold text-yellow-400 hover:text-yellow-300 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearNotifications}
                  className="flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-red-400 transition-colors ml-1"
                  title="Clear all notifications"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05]">
                  <Bell className="h-6 w-6 text-neutral-600" />
                </div>
                <p className="text-[14px] font-semibold text-neutral-400">
                  {t("notifications.empty", "No notifications yet")}
                </p>
                <p className="mt-1 text-[12px] text-neutral-600 max-w-[220px]">
                  Real-time payroll updates, stream alerts, and earnings milestones will appear here.
                </p>
              </div>
            ) : (
              <div role="list">
                {notifications.map((notif) => (
                  <NotificationItem
                    key={notif.id}
                    notification={notif}
                    onRead={markAsRead}
                    onRemove={removeNotification}
                    onClosePanel={closePanel}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="shrink-0 border-t border-white/[0.06] bg-neutral-950/60 px-4 py-2.5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                Auto-saved · Persists on refresh
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
