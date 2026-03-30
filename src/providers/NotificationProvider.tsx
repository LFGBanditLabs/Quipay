import React, {
  createContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import "./NotificationProvider.css"; // Import CSS for sliding effect

type NotificationType =
  | "primary"
  | "secondary"
  | "success"
  | "error"
  | "warning"
  | "info";
interface NotificationAction {
  label: string;
  onClick: () => void;
}

type StreamNotificationType =
  | "stream_created"
  | "stream_funded"
  | "withdrawal_available"
  | "stream_cancelled"
  | "stream_completed";

interface ToastNotification {
  id: string;
  message: string;
  type: NotificationType;
  isVisible: boolean;
  action?: NotificationAction;
}

interface StreamNotification {
  id: string;
  type: StreamNotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  dedupeKey?: string;
}

interface StreamNotificationOptions {
  title?: string;
  message?: string;
  dedupeKey?: string;
}

interface NotificationContextType {
  addNotification: (
    message: string,
    type: NotificationType,
    action?: NotificationAction,
  ) => void;
  addStreamNotification: (
    type: StreamNotificationType,
    options?: StreamNotificationOptions,
  ) => void;
  streamNotifications: StreamNotification[];
  unreadCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

const STREAM_NOTIFICATION_STORAGE_KEY =
  "quipay.notification_center.stream_events.v1";
const MAX_STREAM_NOTIFICATIONS = 50;

const streamNotificationDefaults: Record<
  StreamNotificationType,
  { title: string; message: string }
> = {
  stream_created: {
    title: "Stream created",
    message: "A new payroll stream was created successfully.",
  },
  stream_funded: {
    title: "Stream funded",
    message: "Funds were added to support active payroll streams.",
  },
  withdrawal_available: {
    title: "Withdrawal available",
    message: "A worker can now withdraw earned funds.",
  },
  stream_cancelled: {
    title: "Stream cancelled",
    message: "A payroll stream was cancelled.",
  },
  stream_completed: {
    title: "Stream completed",
    message: "A payroll stream has reached completion.",
  },
};

const isValidStreamNotificationType = (
  value: unknown,
): value is StreamNotificationType =>
  value === "stream_created" ||
  value === "stream_funded" ||
  value === "withdrawal_available" ||
  value === "stream_cancelled" ||
  value === "stream_completed";

const readStoredStreamNotifications = (): StreamNotification[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STREAM_NOTIFICATION_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((value): value is StreamNotification => {
        if (!value || typeof value !== "object") return false;
        const maybe = value as Partial<StreamNotification>;
        return (
          typeof maybe.id === "string" &&
          isValidStreamNotificationType(maybe.type) &&
          typeof maybe.title === "string" &&
          typeof maybe.message === "string" &&
          typeof maybe.timestamp === "string" &&
          typeof maybe.read === "boolean"
        );
      })
      .slice(0, MAX_STREAM_NOTIFICATIONS);
  } catch {
    return [];
  }
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);
  const [streamNotifications, setStreamNotifications] = useState<
    StreamNotification[]
  >(() => readStoredStreamNotifications());

  const addNotification = useCallback(
    (message: string, type: NotificationType, action?: NotificationAction) => {
      const newNotification: ToastNotification = {
        id: `${type}-${Date.now().toString()}`,
        message,
        type,
        isVisible: true,
        action,
      };
      setNotifications((prev) => [...prev, newNotification]);

      // If it has an action, we might want to keep it longer or require manual dismissal
      // But for now, let's just keep the existing timing or slightly longer if there's an action
      const duration = action ? 8000 : 2500;
      const removeAfter = action ? 10000 : 5000;

      setTimeout(() => {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === newNotification.id ? { ...n, isVisible: false } : n,
          ),
        );
      }, duration);

      setTimeout(() => {
        setNotifications((prev) =>
          prev.filter((n) => n.id !== newNotification.id),
        );
      }, removeAfter);
    },
    [],
  );

  const addStreamNotification = useCallback(
    (type: StreamNotificationType, options?: StreamNotificationOptions) => {
      const defaults = streamNotificationDefaults[type];
      const timestamp = new Date().toISOString();
      const dedupeKey = options?.dedupeKey;

      const newNotification: StreamNotification = {
        id: `${type}-${Date.now().toString()}-${Math.random().toString(16).slice(2, 8)}`,
        type,
        title: options?.title ?? defaults.title,
        message: options?.message ?? defaults.message,
        timestamp,
        read: false,
        dedupeKey,
      };

      setStreamNotifications((prev) => {
        if (dedupeKey && prev.some((item) => item.dedupeKey === dedupeKey)) {
          return prev;
        }
        return [newNotification, ...prev].slice(0, MAX_STREAM_NOTIFICATIONS);
      });
    },
    [],
  );

  const markNotificationAsRead = useCallback((id: string) => {
    setStreamNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setStreamNotifications((prev) =>
      prev.map((item) => ({ ...item, read: true })),
    );
  }, []);

  const unreadCount = useMemo(
    () => streamNotifications.filter((item) => !item.read).length,
    [streamNotifications],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      STREAM_NOTIFICATION_STORAGE_KEY,
      JSON.stringify(streamNotifications),
    );
  }, [streamNotifications]);

  const contextValue = useMemo(
    () => ({
      addNotification,
      addStreamNotification,
      streamNotifications,
      unreadCount,
      markNotificationAsRead,
      markAllNotificationsAsRead,
    }),
    [
      addNotification,
      addStreamNotification,
      streamNotifications,
      unreadCount,
      markNotificationAsRead,
      markAllNotificationsAsRead,
    ],
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <div className="notification-container">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`notification ${notification.type} ${notification.isVisible ? "slide-in" : "slide-out"}`}
          >
            <div className="notification-content">
              <p>{notification.message}</p>
              {notification.action && (
                <button
                  className="notification-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    notification.action?.onClick();
                    // Optionally dismiss after action
                  }}
                >
                  {notification.action.label}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export { NotificationContext };
export type {
  NotificationContextType,
  StreamNotification,
  StreamNotificationType,
};
