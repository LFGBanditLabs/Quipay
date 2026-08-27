import { useContext, useCallback, useEffect } from "react";
import { io } from "socket.io-client";
import {
  NotificationContext,
  NotificationContextType,
} from "../providers/NotificationProvider";
import { useAuth } from "./useAuth";
import { useWallet } from "./useWallet";
import {
  type StreamEvent,
  checkAndTriggerMilestones,
  isVaultBalanceLow,
  DEFAULT_MILESTONE_THRESHOLDS,
} from "../lib/notificationRules";

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }

  const { address } = useWallet();
  const { authenticated, getAccessToken } = useAuth();
  const { addEventNotification } = context;

  // Listen to WebSocket stream events
  useEffect(() => {
    const WS_URL = import.meta.env.PUBLIC_BACKEND_URL;
    if (!address || !WS_URL || !authenticated) return;

    let socket: ReturnType<typeof io> | null = null;
    let isCancelled = false;

    const connectSocket = async () => {
      try {
        const token = await getAccessToken();
        if (!token || isCancelled) return;

        socket = io(WS_URL, {
          path: "/socket.io",
          query: { token },
        });

        const handleStreamEvent = (event: StreamEvent) => {
          if (!event || !event.type) return;

          // Check if the event is relevant to current user
          const isForWorker =
            event.workerAddress &&
            event.workerAddress.toLowerCase() === address.toLowerCase();
          const isForEmployer =
            event.employerAddress &&
            event.employerAddress.toLowerCase() === address.toLowerCase();

          if (isForWorker || isForEmployer || (!event.workerAddress && !event.employerAddress)) {
            addEventNotification(event);
          }
        };

        // Socket event listeners for stream lifecycle events
        socket.on("stream:event", handleStreamEvent);
        socket.on("stream.started", (payload: StreamEvent) =>
          handleStreamEvent({ ...payload, type: "stream.started" }),
        );
        socket.on("stream.paused", (payload: StreamEvent) =>
          handleStreamEvent({ ...payload, type: "stream.paused" }),
        );
        socket.on("stream.resumed", (payload: StreamEvent) =>
          handleStreamEvent({ ...payload, type: "stream.resumed" }),
        );
        socket.on("stream.cancelled", (payload: StreamEvent) =>
          handleStreamEvent({ ...payload, type: "stream.cancelled" }),
        );
        socket.on("earnings.milestone", (payload: StreamEvent) =>
          handleStreamEvent({ ...payload, type: "earnings.milestone" }),
        );
        socket.on("vault.low_balance", (payload: StreamEvent) =>
          handleStreamEvent({ ...payload, type: "vault.low_balance" }),
        );
        socket.on("stream.ending_soon", (payload: StreamEvent) =>
          handleStreamEvent({ ...payload, type: "stream.ending_soon" }),
        );
        socket.on("worker.joined", (payload: StreamEvent) =>
          handleStreamEvent({ ...payload, type: "worker.joined" }),
        );
        socket.on("deposit.confirmed", (payload: StreamEvent) =>
          handleStreamEvent({ ...payload, type: "deposit.confirmed" }),
        );
        socket.on("withdrawal.completed", (payload: StreamEvent) =>
          handleStreamEvent({ ...payload, type: "withdrawal.completed" }),
        );
        socket.on("batch.completed", (payload: StreamEvent) =>
          handleStreamEvent({ ...payload, type: "batch.completed" }),
        );
      } catch (err) {
        console.warn("Notification WebSocket connection skipped:", err);
      }
    };

    void connectSocket();

    return () => {
      isCancelled = true;
      socket?.disconnect();
    };
  }, [address, authenticated, getAccessToken, addEventNotification]);

  // Helper for components to trigger milestone checks on cumulative earnings
  const triggerMilestoneCheck = useCallback(
    (
      currentTotalEarned: number,
      token = "USDC",
      thresholds = DEFAULT_MILESTONE_THRESHOLDS,
    ) => {
      if (!address) return;
      const newlyCrossed = checkAndTriggerMilestones(
        address,
        currentTotalEarned,
        thresholds,
      );

      for (const threshold of newlyCrossed) {
        addEventNotification({
          type: "earnings.milestone",
          workerAddress: address,
          amount: threshold,
          token,
          timestamp: Date.now(),
          metadata: {
            dedupeKey: `milestone:${address}:${threshold}:${new Date().getFullYear()}-${new Date().getMonth() + 1}`,
          },
        });
      }
    },
    [address, addEventNotification],
  );

  // Helper for employers to check low vault balance
  const triggerLowBalanceCheck = useCallback(
    (availableBalance: number, monthlyBurnRate: number, token = "USDC") => {
      if (!address) return;
      if (isVaultBalanceLow(availableBalance, monthlyBurnRate)) {
        addEventNotification({
          type: "vault.low_balance",
          employerAddress: address,
          amount: availableBalance,
          token,
          timestamp: Date.now(),
          metadata: {
            dedupeKey: `vault_low:${address}:${Math.floor(Date.now() / (24 * 60 * 60 * 1000))}`, // Max once per day
          },
        });
      }
    },
    [address, addEventNotification],
  );

  return {
    ...context,
    triggerMilestoneCheck,
    triggerLowBalanceCheck,
  };
}

export type { NotificationContextType };
