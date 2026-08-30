import React, {
  createContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import "./NotificationProvider.css";
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
import {
  type StreamEvent,
  mapEventToNotification,
} from "../lib/notificationRules";

export type NotificationType =
  | "primary"
  | "secondary"
  | "success"
  | "error"
  | "warning"
  | "info";

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface ToastNotification {
  id: string;
  message: string;
  type: NotificationType;
  isVisible: boolean;
  action?: NotificationAction;
}

export interface StreamNotificationOptions {
  title?: string;
  message?: string;
  dedupeKey?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationContextType {
  // Toast notifications & overloaded event addition
  addNotification: {
    (
      message: string,
      type?: NotificationType,
      action?: NotificationAction,
    ): void;
    (event: StreamEvent | PersistedNotification): void;
  };
  addStreamNotification: (
    type: NotificationCenterType,
    options?: StreamNotificationOptions,
  ) => void;
  addEventNotification: (event: StreamEvent) => void;

  // Persisted notifications array & counts
  notifications: PersistedNotification[];
  streamNotifications: PersistedNotification[];
  unreadCount: number;

  // Actions
  markAsRead: (id: string) => void;
  markNotificationAsRead: (id: string) => void;
  markAllAsRead: () => void;
  markAllNotificationsAsRead: () => void;
  clearNotifications: () => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

const streamNotificationDefaults: Record<
  PersistentNotificationType,
  { title: string; message: string; actionUrl?: string }
> = {
  tx_confirmed: {
    title: "Transaction confirmed",
    message: "The transaction was confirmed successfully.",
    actionUrl: "/dashboard",
  },
  tx_failed: {
    title: "Transaction failed",
    message: "The transaction could not be completed.",
    actionUrl: "/dashboard",
  },
  stream_started: {
    title: "Stream started",
    message: "A payroll stream was started successfully.",
    actionUrl: "/dashboard",
  },
  stream_completed: {
    title: "Stream completed",
    message: "A payroll stream has reached completion.",
    actionUrl: "/dashboard",
  },
  payroll_disbursed: {
    title: "Payroll disbursed",
    message: "Payroll funds were disbursed successfully.",
    actionUrl: "/treasury",
  },
  "stream.started": {
    title: "Stream started",
    message: "A payroll stream was started successfully.",
    actionUrl: "/dashboard",
  },
  "stream.paused": {
    title: "Stream paused",
    message: "A payroll stream was paused.",
    actionUrl: "/dashboard",
  },
  "stream.resumed": {
    title: "Stream resumed",
    message: "A payroll stream was resumed.",
    actionUrl: "/dashboard",
  },
  "stream.cancelled": {
    title: "Stream cancelled",
    message: "A payroll stream was cancelled.",
    actionUrl: "/dashboard",
  },
  "earnings.milestone": {
    title: "Earnings milestone",
    message: "You've reached an earnings milestone!",
    actionUrl: "/dashboard",
  },
  "vault.low_balance": {
    title: "Vault balance low",
    message: "Vault balance is below 2 weeks of total burn rate",
    actionUrl: "/treasury",
  },
  "stream.ending_soon": {
    title: "Stream ending soon",
    message: "A payroll stream is ending soon.",
    actionUrl: "/dashboard",
  },
  "worker.joined": {
    title: "Employee joined",
    message: "A worker joined your organization.",
    actionUrl: "/address-book",
  },
  "deposit.confirmed": {
    title: "Deposit confirmed",
    message: "Funds were deposited into the payroll vault.",
    actionUrl: "/treasury",
  },
  "withdrawal.completed": {
    title: "Withdrawal completed",
    message: "Withdrawal completed successfully.",
    actionUrl: "/withdraw",
  },
  "batch.completed": {
    title: "Batch import completed",
    message: "Bulk payroll streams created successfully.",
    actionUrl: "/dashboard",
  },
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { address } = useWallet();
  const [toastList, setToastList] = useState<ToastNotification[]>([]);
  const [persistedList, setPersistedList] = useState<PersistedNotification[]>(
    [],
  );

  const addToast = useCallback(
    (
      message: string,
      type: NotificationType = "info",
      action?: NotificationAction,
    ) => {
      const newToast: ToastNotification = {
        id: `${type}-${Date.now().toString()}-${Math.random().toString(36).slice(2, 6)}`,
        message,
        type,
        isVisible: true,
        action,
      };
      setToastList((prev) => [...prev, newToast]);

      const duration = action ? 8000 : 2500;
      const removeAfter = action ? 10000 : 5000;

      setTimeout(() => {
        setToastList((prev) =>
          prev.map((n) =>
            n.id === newToast.id ? { ...n, isVisible: false } : n,
          ),
        );
      }, duration);

      setTimeout(() => {
        setToastList((prev) => prev.filter((n) => n.id !== newToast.id));
      }, removeAfter);
    },
    [],
  );

  const addStreamNotification = useCallback(
    (type: NotificationCenterType, options?: StreamNotificationOptions) => {
      const normalizedType = normalizeNotificationType(type);
      const defaults = streamNotificationDefaults[normalizedType] || {
        title: "Notification",
        message: "You have a new update",
        actionUrl: "/dashboard",
      };
      const timestamp = Date.now();
      const dedupeKey = options?.dedupeKey;

      const newNotification: PersistedNotification = {
        id: `${normalizedType}-${Date.now().toString()}-${Math.random().toString(16).slice(2, 8)}`,
        type: normalizedType,
        title: options?.title ?? defaults.title,
        message: options?.message ?? defaults.message,
        timestamp,
        read: false,
        dedupeKey,
        actionUrl: options?.actionUrl ?? defaults.actionUrl,
        metadata: options?.metadata,
      };

      setPersistedList((prev) => {
        if (dedupeKey && prev.some((item) => item.dedupeKey === dedupeKey)) {
          return prev;
        }
        return [newNotification, ...prev].slice(0, MAX_PERSISTED_NOTIFICATIONS);
      });
    },
    [],
  );

  const addEventNotification = useCallback(
    (event: StreamEvent) => {
      const mapped = mapEventToNotification(event, {
        currentUserAddress: address,
      });

      const newNotification: PersistedNotification = {
        id: mapped.id,
        type: mapped.type,
        title: mapped.title,
        message: mapped.message,
        timestamp: mapped.timestamp,
        read: false,
        actionUrl: mapped.actionUrl,
        dedupeKey: mapped.dedupeKey,
        metadata: mapped.metadata,
      };

      setPersistedList((prev) => {
        if (
          mapped.dedupeKey &&
          prev.some((item) => item.dedupeKey === mapped.dedupeKey)
        ) {
          return prev;
        }
        return [newNotification, ...prev].slice(0, MAX_PERSISTED_NOTIFICATIONS);
      });

      // Also trigger a toast notification for high-priority real-time events
      addToast(mapped.message, "info");
    },
    [address, addToast],
  );

  const addNotification = useCallback(
    (
      param: string | StreamEvent | PersistedNotification,
      type: NotificationType = "info",
      action?: NotificationAction,
    ) => {
      if (typeof param === "string") {
        addToast(param, type, action);
      } else if (typeof param === "object" && param !== null) {
        if ("title" in param && "message" in param) {
          // Already a persisted notification format
          setPersistedList((prev) => {
            if (
              param.dedupeKey &&
              prev.some((item) => item.dedupeKey === param.dedupeKey)
            ) {
              return prev;
            }
            return [
              param as PersistedNotification,
              ...prev,
            ].slice(0, MAX_PERSISTED_NOTIFICATIONS);
          });
          addToast(param.message, "info");
        } else if ("type" in param) {
          // StreamEvent format
          addEventNotification(param as StreamEvent);
        }
      }
    },
    [addToast, addEventNotification],
  ) as NotificationContextType["addNotification"];

  const markAsRead = useCallback((id: string) => {
    setPersistedList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setPersistedList((prev) => prev.map((item) => ({ ...item, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setPersistedList([]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setPersistedList((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const unreadCount = useMemo(
    () => persistedList.filter((item) => !item.read).length,
    [persistedList],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPersistedList(loadPersistedNotifications(window.localStorage, address));
  }, [address]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    persistNotifications(window.localStorage, address, persistedList);
  }, [address, persistedList]);

  const contextValue = useMemo(
    () => ({
      addNotification,
      addStreamNotification,
      addEventNotification,
      notifications: persistedList,
      streamNotifications: persistedList,
      unreadCount,
      markAsRead,
      markNotificationAsRead: markAsRead,
      markAllAsRead,
      markAllNotificationsAsRead: markAllAsRead,
      clearNotifications,
      removeNotification,
    }),
    [
      addNotification,
      addStreamNotification,
      addEventNotification,
      persistedList,
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      removeNotification,
    ],
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <div className="notification-container">
        {toastList.map((notification) => (
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
  PersistedNotification as StreamNotification,
  NotificationCenterType as StreamNotificationType,
};
