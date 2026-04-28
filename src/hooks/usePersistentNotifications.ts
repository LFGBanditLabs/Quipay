import { useState, useEffect, useCallback, useMemo } from "react";

/**
 * Persisted notification structure as per requirements.
 */
export type NotificationType =
  | "tx_confirmed"
  | "tx_failed"
  | "stream_started"
  | "stream_completed"
  | "payroll_disbursed";

export interface PersistentNotification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: number;
  read: boolean;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Hook to manage persistent notifications scoped by wallet address.
 */
export function usePersistentNotifications(walletAddress?: string) {
  const storageKey = useMemo(
    () => (walletAddress ? `notifications_${walletAddress}` : null),
    [walletAddress],
  );

  const [notifications, setNotifications] = useState<PersistentNotification[]>(
    [],
  );

  // Load and filter on mount or address change
  useEffect(() => {
    if (!storageKey) {
      setNotifications([]);
      return;
    }

    const loadNotifications = () => {
      try {
        const stored = localStorage.getItem(storageKey);
        if (!stored) {
          setNotifications([]);
          return;
        }

        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) {
          setNotifications([]);
          return;
        }

        const now = Date.now();
        const valid = parsed.filter((n: PersistentNotification) => {
          return (
            typeof n.timestamp === "number" && now - n.timestamp < SEVEN_DAYS_MS
          );
        });

        setNotifications(valid);
      } catch (error) {
        console.error("Failed to load notifications from localStorage", error);
        setNotifications([]);
      }
    };

    loadNotifications();
  }, [storageKey]);

  // Persist to localStorage on change
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(notifications));
    }
  }, [notifications, storageKey]);

  const addNotification = useCallback(
    (type: NotificationType, message: string) => {
      const newNotification: PersistentNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type,
        message,
        timestamp: Date.now(),
        read: false,
      };

      setNotifications((prev) => {
        const now = Date.now();
        // Add new and filter old in one go
        const filtered = prev.filter((n) => now - n.timestamp < SEVEN_DAYS_MS);
        return [newNotification, ...filtered];
      });
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
