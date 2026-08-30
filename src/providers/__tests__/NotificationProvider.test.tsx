import React, { act } from "react";
import renderer from "react-test-renderer";
import {
  NotificationProvider,
  useNotification,
} from "../../providers/NotificationProvider";
import { useNotifications } from "../../hooks/useNotifications";

// Mock useWallet
jest.mock("../../hooks/useWallet", () => ({
  useWallet: () => ({
    address: "GTESTWALLET123",
  }),
}));

// Mock useAuth
jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    authenticated: false,
    getAccessToken: async () => null,
  }),
}));

const ConsumerComponent: React.FC<{
  onHookResult: (result: ReturnType<typeof useNotifications>) => void;
}> = ({ onHookResult }) => {
  const hook = useNotifications();
  onHookResult(hook);
  return (
    <div>
      <span data-testid="unread">{hook.unreadCount}</span>
      <span data-testid="total">{hook.notifications.length}</span>
    </div>
  );
};

describe("NotificationProvider & useNotifications", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("adds, stores, and marks notifications as read", async () => {
    let currentHook!: ReturnType<typeof useNotifications>;

    let testRenderer!: renderer.ReactTestRenderer;
    await act(async () => {
      testRenderer = renderer.create(
        <NotificationProvider>
          <ConsumerComponent onHookResult={(r) => (currentHook = r)} />
        </NotificationProvider>,
      );
    });

    expect(currentHook.unreadCount).toBe(0);
    expect(currentHook.notifications).toHaveLength(0);

    // Add a stream event notification
    await act(async () => {
      currentHook.addNotification({
        type: "stream.started",
        streamId: "123",
        employerAddress: "GEMPLOYER",
        workerAddress: "GTESTWALLET123",
        amount: "5000",
        token: "USDC",
        timestamp: Date.now(),
      });
    });

    expect(currentHook.notifications).toHaveLength(1);
    expect(currentHook.unreadCount).toBe(1);
    expect(currentHook.notifications[0].title).toBe("Stream Started");

    const notifId = currentHook.notifications[0].id;

    // Mark as read
    await act(async () => {
      currentHook.markAsRead(notifId);
    });

    expect(currentHook.unreadCount).toBe(0);
    expect(currentHook.notifications[0].read).toBe(true);

    // Add milestone event
    await act(async () => {
      currentHook.addNotification({
        type: "earnings.milestone",
        amount: 1000,
        token: "USDC",
        timestamp: Date.now(),
      });
    });

    expect(currentHook.unreadCount).toBe(1);
    expect(currentHook.notifications).toHaveLength(2);

    // Mark all as read
    await act(async () => {
      currentHook.markAllAsRead();
    });

    expect(currentHook.unreadCount).toBe(0);

    // Clear notifications
    await act(async () => {
      currentHook.clearNotifications();
    });

    expect(currentHook.notifications).toHaveLength(0);
  });

  it("handles toast strings and stream notifications concurrently", async () => {
    let currentHook!: ReturnType<typeof useNotifications>;

    await act(async () => {
      renderer.create(
        <NotificationProvider>
          <ConsumerComponent onHookResult={(r) => (currentHook = r)} />
        </NotificationProvider>,
      );
    });

    await act(async () => {
      currentHook.addNotification("Plain toast message", "success");
    });

    // Toast message is transient, persistent notifications shouldn't have duplicate errors
    expect(currentHook.notifications).toHaveLength(0);
  });
});
