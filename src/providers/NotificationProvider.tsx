import React, {
  createContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import "./NotificationProvider.css"; // Import CSS for sliding effect
import { useWallet } from "../hooks/useWallet";
import {
  type NotificationCenterType,
  type PersistedNotification,
  type PersistentNotificationType,
  loadPersistedNotifications,
  persistNotifications,
  normalizeNotificationType,
  MAX_PERSISTED_NOTIFICATIONS,
} from "./notificationStorage";

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

interface ToastNotification {
  id: string;
  message: string;
  type: NotificationType;
  isVisible: boolean;
  action?: NotificationAction;
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
    type: NotificationCenterType,
    options?: StreamNotificationOptions,
  ) => void;
  streamNotifications: PersistedNotification[];
  unreadCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

const streamNotificationDefaults: Record<
  PersistentNotificationType,
  { title: string; message: string }
> = {
  tx_confirmed: {
    title: "Transaction confirmed",
    message: "The transaction was confirmed successfully.",
  },
  tx_failed: {
    title: "Transaction failed",
    message: "The transaction could not be completed.",
  },
  stream_started: {
    title: "Stream started",
    message: "A payroll stream was started successfully.",
  },
  stream_completed: {
    title: "Stream completed",
    message: "A payroll stream has reached completion.",
  },
  payroll_disbursed: {
    title: "Payroll disbursed",
    message: "Payroll funds were disbursed successfully.",
  },
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { address } = useWallet();
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);
  const [streamNotifications, setStreamNotifications] = useState<
    PersistedNotification[]
  >([]);

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
    (type: NotificationCenterType, options?: StreamNotificationOptions) => {
      const normalizedType = normalizeNotificationType(type);
      const defaults = streamNotificationDefaults[normalizedType];
      const timestamp = new Date().toISOString();
      const dedupeKey = options?.dedupeKey;

      const newNotification: PersistedNotification = {
        id: `${normalizedType}-${Date.now().toString()}-${Math.random().toString(16).slice(2, 8)}`,
        type: normalizedType,
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
        return [newNotification, ...prev].slice(0, MAX_PERSISTED_NOTIFICATIONS);
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
    const timeoutId = window.setTimeout(() => {
      setStreamNotifications(
        loadPersistedNotifications(window.localStorage, address),
      );
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [address]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    persistNotifications(window.localStorage, address, streamNotifications);
  }, [address, streamNotifications]);

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
  PersistedNotification as StreamNotification,
  NotificationCenterType as StreamNotificationType,
};
