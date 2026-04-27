import { useState, useEffect } from "react";
import renderer, { act } from "react-test-renderer";
import { usePersistentNotifications } from "../usePersistentNotifications";

// Test-only component to exercise the hook
const TestComponent = ({ walletAddress, onHookValue }: { walletAddress?: string; onHookValue: (value: any) => void }) => {
  const hookValue = usePersistentNotifications(walletAddress);
  useEffect(() => {
    onHookValue(hookValue);
  }, [hookValue, onHookValue]);
  return null;
};

describe("usePersistentNotifications hook", () => {
  const walletAddress = "GTESTADDRESS";
  const storageKey = `notifications_${walletAddress}`;

  beforeEach(() => {
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("loads empty notifications when no data in localStorage", () => {
    let hookValue: any;
    act(() => {
      renderer.create(<TestComponent walletAddress={walletAddress} onHookValue={(v) => (hookValue = v)} />);
    });
    expect(hookValue.notifications).toEqual([]);
    expect(hookValue.unreadCount).toBe(0);
  });

  it("persists and adds notifications to localStorage", () => {
    let hookValue: any;
    const testRenderer = renderer.create(<TestComponent walletAddress={walletAddress} onHookValue={(v) => (hookValue = v)} />);

    act(() => {
      hookValue.addNotification("tx_confirmed", "Test Message");
    });

    expect(hookValue.notifications.length).toBe(1);
    expect(hookValue.notifications[0].message).toBe("Test Message");
    expect(hookValue.unreadCount).toBe(1);

    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
    expect(stored.length).toBe(1);
    expect(stored[0].message).toBe("Test Message");
  });

  it("marks notifications as read", () => {
    let hookValue: any;
    renderer.create(<TestComponent walletAddress={walletAddress} onHookValue={(v) => (hookValue = v)} />);

    act(() => {
      hookValue.addNotification("tx_confirmed", "Test Message");
    });

    const id = hookValue.notifications[0].id;
    act(() => {
      hookValue.markAsRead(id);
    });

    expect(hookValue.notifications[0].read).toBe(true);
    expect(hookValue.unreadCount).toBe(0);
  });

  it("marks all notifications as read", () => {
    let hookValue: any;
    renderer.create(<TestComponent walletAddress={walletAddress} onHookValue={(v) => (hookValue = v)} />);

    act(() => {
      hookValue.addNotification("tx_confirmed", "Msg 1");
      hookValue.addNotification("tx_failed", "Msg 2");
    });

    expect(hookValue.unreadCount).toBe(2);

    act(() => {
      hookValue.markAllAsRead();
    });

    expect(hookValue.unreadCount).toBe(0);
    expect(hookValue.notifications.every((n: any) => n.read)).toBe(true);
  });

  it("automatically removes notifications older than 7 days", () => {
    const now = Date.now();
    const oldTimestamp = now - (8 * 24 * 60 * 60 * 1000); // 8 days ago
    const recentTimestamp = now - (1 * 24 * 60 * 60 * 1000); // 1 day ago

    const initialData = [
      { id: "old", type: "tx_confirmed", message: "Old", timestamp: oldTimestamp, read: false },
      { id: "recent", type: "tx_confirmed", message: "Recent", timestamp: recentTimestamp, read: false }
    ];

    localStorage.setItem(storageKey, JSON.stringify(initialData));

    let hookValue: any;
    act(() => {
      renderer.create(<TestComponent walletAddress={walletAddress} onHookValue={(v) => (hookValue = v)} />);
    });

    // Should only have 'recent'
    expect(hookValue.notifications.length).toBe(1);
    expect(hookValue.notifications[0].id).toBe("recent");
  });

  it("filters old notifications when adding a new one", () => {
    let hookValue: any;
    renderer.create(<TestComponent walletAddress={walletAddress} onHookValue={(v) => (hookValue = v)} />);

    const now = Date.now();
    const oldTimestamp = now - (8 * 24 * 60 * 60 * 1000);

    act(() => {
      // Manually push an old notification into state (bypass addNotification for setup if needed, 
      // but addNotification also filters, so let's test that)
      // Actually, we can just mock Date.now()
    });

    jest.setSystemTime(now); // Set current time
    act(() => {
      hookValue.addNotification("tx_confirmed", "Recent 1");
    });

    jest.advanceTimersByTime(8 * 24 * 60 * 60 * 1000); // Advance 8 days
    
    act(() => {
      hookValue.addNotification("tx_confirmed", "Recent 2");
    });

    // Recent 1 should be gone now because 8 days passed and we added another
    expect(hookValue.notifications.length).toBe(1);
    expect(hookValue.notifications[0].message).toBe("Recent 2");
  });

  it("resets notifications when wallet address changes", () => {
    let hookValue: any;
    const testRenderer = renderer.create(<TestComponent walletAddress={walletAddress} onHookValue={(v) => (hookValue = v)} />);

    act(() => {
      hookValue.addNotification("tx_confirmed", "Wallet 1 Notif");
    });

    expect(hookValue.notifications.length).toBe(1);

    act(() => {
      testRenderer.update(<TestComponent walletAddress="GNEWADDRESS" onHookValue={(v) => (hookValue = v)} />);
    });

    expect(hookValue.notifications).toEqual([]);
  });
});
