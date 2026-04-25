export type PersistentNotificationType =
  | "tx_confirmed"
  | "tx_failed"
  | "stream_started"
  | "stream_completed"
  | "payroll_disbursed";

export type LegacyNotificationType =
  | "stream_created"
  | "stream_funded"
  | "withdrawal_available"
  | "stream_cancelled";

export type NotificationCenterType =
  | PersistentNotificationType
  | LegacyNotificationType;

export interface PersistedNotification {
  id: string;
  type: PersistentNotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  dedupeKey?: string;
}

export interface NotificationStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const NOTIFICATION_STORAGE_PREFIX = "quipay.notification_center.v2";
export const NOTIFICATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_PERSISTED_NOTIFICATIONS = 50;

export const normalizeNotificationType = (
  type: NotificationCenterType,
): PersistentNotificationType => {
  switch (type) {
    case "stream_created":
      return "stream_started";
    case "stream_funded":
      return "payroll_disbursed";
    case "withdrawal_available":
      return "tx_confirmed";
    case "stream_cancelled":
      return "tx_failed";
    default:
      return type;
  }
};

export const getNotificationStorageKey = (walletAddress?: string): string =>
  `${NOTIFICATION_STORAGE_PREFIX}:${walletAddress || "guest"}`;

export const purgeExpiredNotifications = (
  notifications: PersistedNotification[],
  now = Date.now(),
): PersistedNotification[] =>
  notifications
    .filter((item) => {
      const timestamp = Date.parse(item.timestamp);
      return Number.isFinite(timestamp) && now - timestamp <= NOTIFICATION_RETENTION_MS;
    })
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, MAX_PERSISTED_NOTIFICATIONS);

const isPersistedNotification = (
  value: unknown,
): value is PersistedNotification => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PersistedNotification>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.timestamp === "string" &&
    typeof candidate.read === "boolean" &&
    typeof candidate.type === "string"
  );
};

export const loadPersistedNotifications = (
  storage: NotificationStorageLike | null | undefined,
  walletAddress?: string,
  now = Date.now(),
): PersistedNotification[] => {
  if (!storage) return [];

  try {
    const raw = storage.getItem(getNotificationStorageKey(walletAddress));
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return purgeExpiredNotifications(
      parsed
        .filter(isPersistedNotification)
        .map((item) => ({
          ...item,
          type: normalizeNotificationType(item.type),
        })),
      now,
    );
  } catch {
    return [];
  }
};

export const persistNotifications = (
  storage: NotificationStorageLike | null | undefined,
  walletAddress: string | undefined,
  notifications: PersistedNotification[],
  now = Date.now(),
): PersistedNotification[] => {
  if (!storage) return purgeExpiredNotifications(notifications, now);

  const next = purgeExpiredNotifications(notifications, now);
  const key = getNotificationStorageKey(walletAddress);

  if (next.length === 0) {
    storage.removeItem(key);
    return next;
  }

  storage.setItem(key, JSON.stringify(next));
  return next;
};
