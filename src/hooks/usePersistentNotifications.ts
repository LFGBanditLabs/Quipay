import { useState, useEffect, useCallback, useMemo } from "react";
import {
  type PersistentNotificationType,
  type PersistedNotification,
  loadPersistedNotifications,
  persistNotifications,
} from "../providers/notificationStorage";

export type NotificationType = PersistentNotificationType;
export type PersistentNotification = PersistedNotification;

/**
 * Hook to manage persistent notifications scoped by wallet address.
 */
export function usePersistentNotifications(walletAddress?: string) {
  const [notifications, setNotifications] = useState<PersistedNotification[]>(
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    setNotifications(
      loadPersistedNotifications(window.localStorage, walletAddress),
    );
  }, [walletAddress]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    persistNotifications(window.localStorage, walletAddress, notifications);
  }, [walletAddress, notifications]);

  const addNotification = useCallback(
    (
      type: PersistentNotificationType,
      message: string,
      title = "Notification",
      actionUrl?: string,
    ) => {
      const newNotification: PersistedNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type,
        title,
        message,
        timestamp: Date.now(),
        read: false,
        actionUrl,
      };

      setNotifications((prev) => [newNotification, ...prev].slice(0, 50));
    },
    [],
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  };
}
