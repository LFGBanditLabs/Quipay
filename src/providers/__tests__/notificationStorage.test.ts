import {
  getNotificationStorageKey,
  loadPersistedNotifications,
  normalizeNotificationType,
  persistNotifications,
  purgeExpiredNotifications,
  type NotificationStorageLike,
} from "../notificationStorage";

const createStorage = (): NotificationStorageLike & {
  snapshot: Record<string, string>;
} => {
  const snapshot: Record<string, string> = {};
  return {
    snapshot,
    getItem: (key) => snapshot[key] ?? null,
    setItem: (key, value) => {
      snapshot[key] = value;
    },
    removeItem: (key) => {
      delete snapshot[key];
    },
  };
};

describe("notificationStorage", () => {
  it("normalizes legacy notification types into persistent center types", () => {
    expect(normalizeNotificationType("stream_created")).toBe("stream_started");
    expect(normalizeNotificationType("stream_funded")).toBe(
      "payroll_disbursed",
    );
    expect(normalizeNotificationType("withdrawal_available")).toBe(
      "tx_confirmed",
    );
  });

  it("persists notifications per wallet address", () => {
    const storage = createStorage();
    const timestamp = new Date("2026-04-25T12:00:00.000Z").toISOString();

    persistNotifications(
      storage,
      "GABC123",
      [
        {
          id: "one",
          type: "stream_started",
          title: "Started",
          message: "A stream started",
          timestamp,
          read: false,
        },
      ],
      Date.parse(timestamp),
    );

    expect(storage.snapshot[getNotificationStorageKey("GABC123")]).toContain(
      "stream_started",
    );
    expect(loadPersistedNotifications(storage, "GABC123")).toHaveLength(1);
    expect(loadPersistedNotifications(storage, "GOTHER")).toHaveLength(0);
  });

  it("purges notifications older than seven days", () => {
    const now = Date.parse("2026-04-25T12:00:00.000Z");
    const freshTimestamp = new Date(
      now - 2 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const expiredTimestamp = new Date(
      now - 8 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const kept = purgeExpiredNotifications(
      [
        {
          id: "fresh",
          type: "tx_confirmed",
          title: "Fresh",
          message: "Still visible",
          timestamp: freshTimestamp,
          read: false,
        },
        {
          id: "expired",
          type: "tx_failed",
          title: "Expired",
          message: "Should be removed",
          timestamp: expiredTimestamp,
          read: true,
        },
      ],
      now,
    );

    expect(kept).toEqual([
      expect.objectContaining({
        id: "fresh",
      }),
    ]);
  });
});
