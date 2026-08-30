export type PersistentNotificationType =
  | "tx_confirmed"
  | "tx_failed"
  | "stream_started"
  | "stream_completed"
  | "payroll_disbursed"
  | "stream.started"
  | "stream.paused"
  | "stream.resumed"
  | "stream.cancelled"
  | "earnings.milestone"
  | "vault.low_balance"
  | "stream.ending_soon"
  | "worker.joined"
  | "deposit.confirmed"
  | "withdrawal.completed"
  | "batch.completed";

export type LegacyNotificationType =
  | "stream_created"
  | "stream_funded"
  | "withdrawal_available"
  | "stream_cancelled"
  | "stream_paused"
  | "stream_resumed"
  | "earnings_milestone"
  | "vault_low_balance"
  | "stream_ending_soon"
  | "worker_joined"
  | "deposit_confirmed"
  | "withdrawal_completed";

export type NotificationCenterType =
  | PersistentNotificationType
  | LegacyNotificationType;

export interface PersistedNotification {
  id: string;
  type: PersistentNotificationType;
  title: string;
  message: string;
  timestamp: string | number;
  read: boolean;
  dedupeKey?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
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

const parseNotificationTimestamp = (timestamp: string | number): number => {
  if (typeof timestamp === "number") {
    return timestamp > 1e11 ? timestamp : timestamp * 1000;
  }
  return Date.parse(timestamp);
};

export const purgeExpiredNotifications = (
  notifications: PersistedNotification[],
  now = Date.now(),
): PersistedNotification[] =>
  notifications
    .filter((item) => {
      const timestamp = parseNotificationTimestamp(item.timestamp);
      return (
        Number.isFinite(timestamp) &&
        now - timestamp <= NOTIFICATION_RETENTION_MS
      );
    })
    .sort((left, right) => {
      const rightTime = parseNotificationTimestamp(right.timestamp);
      const leftTime = parseNotificationTimestamp(left.timestamp);
      return rightTime - leftTime;
    })
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
    (typeof candidate.timestamp === "string" ||
      typeof candidate.timestamp === "number") &&
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
      parsed.filter(isPersistedNotification).map((item) => ({
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
