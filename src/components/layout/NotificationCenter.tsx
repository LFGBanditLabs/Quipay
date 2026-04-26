import { useEffect, useMemo, useRef, useState } from "react";
import { useNotification } from "../../hooks/useNotification";

const MAX_VISIBLE_NOTIFICATIONS = 8;

const typeStyles: Record<
  string,
  { pillClassName: string; label: string; icon: string }
> = {
  stream_created: {
    pillClassName:
      "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
    label: "Created",
    icon: "OK",
  },
  stream_funded: {
    pillClassName: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
    label: "Funded",
    icon: "$",
  },
  withdrawal_available: {
    pillClassName: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    label: "Withdraw",
    icon: "WD",
  },
  stream_cancelled: {
    pillClassName: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
    label: "Cancelled",
    icon: "!",
  },
  stream_completed: {
    pillClassName:
      "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
    label: "Completed",
    icon: "DONE",
  },
};

const formatTimestamp = (isoTimestamp: string): string => {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const NotificationCenter: React.FC = () => {
  const {
    streamNotifications,
    unreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
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
  }, []);

  const visibleNotifications = useMemo(
    () => streamNotifications.slice(0, MAX_VISIBLE_NOTIFICATIONS),
    [streamNotifications],
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative min-h-11 min-w-11 rounded-lg p-2 text-[var(--muted)] transition-all duration-200 hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-[70] w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div className="text-sm font-semibold text-[var(--text)]">
              Notifications
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllNotificationsAsRead}
                className="text-xs font-medium text-[var(--accent)] transition-opacity hover:opacity-80"
              >
                Mark all read
              </button>
            )}
          </div>

          {visibleNotifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">
              No notifications yet.
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {visibleNotifications.map((notification) => {
                const typeStyle = typeStyles[notification.type] ?? {
                  pillClassName:
                    "bg-[var(--surface-subtle)] text-[var(--muted)] border border-[var(--border)]",
                  label: "Update",
                  icon: "*",
                };

                return (
                  <button
                    key={notification.id}
                    onClick={() => markNotificationAsRead(notification.id)}
                    className={`w-full border-b border-[var(--border)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--surface-subtle)] ${!notification.read ? "bg-[var(--surface-subtle)]/40" : ""}`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${typeStyle.pillClassName}`}
                      >
                        <span aria-hidden="true">{typeStyle.icon}</span>
                        <span>{typeStyle.label}</span>
                      </div>
                      <time className="text-xs text-[var(--muted)]">
                        {formatTimestamp(notification.timestamp)}
                      </time>
                    </div>
                    <p className="text-sm font-medium text-[var(--text)]">
                      {notification.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {notification.message}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
