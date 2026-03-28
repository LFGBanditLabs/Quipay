/**
 * useNetworkAlerts.ts
 * ───────────────────
 * Monitors network status changes and pushes alerts to the
 * NotificationCenter when the network degrades, goes offline,
 * or recovers. Also alerts on network congestion changes.
 */

import { useEffect, useRef } from "react";
import { useNetworkStatus } from "../providers/NetworkStatusProvider";
import { alertStore } from "../components/NotificationCenter";
import type { HorizonStatus, CongestionLevel } from "../util/networkStatus";

export function useNetworkAlerts() {
  const { status, congestion, horizonHealth, sorobanHealth } =
    useNetworkStatus();
  const prevStatusRef = useRef<HorizonStatus>(status);
  const prevCongestionRef = useRef<CongestionLevel>(congestion);
  const isFirstRun = useRef(true);

  useEffect(() => {
    // Skip the first render (don't alert on mount)
    if (isFirstRun.current) {
      isFirstRun.current = false;
      prevStatusRef.current = status;
      prevCongestionRef.current = congestion;
      return;
    }

    const prevStatus = prevStatusRef.current;
    const prevCongestion = prevCongestionRef.current;

    // Status degradation
    if (status === "offline" && prevStatus !== "offline") {
      alertStore.addAlert({
        title: "Network Offline",
        message:
          "Stellar RPC nodes are unreachable. Transactions cannot be submitted until connectivity is restored.",
        severity: "critical",
        category: "network",
      });
    } else if (status === "degraded" && prevStatus === "online") {
      alertStore.addAlert({
        title: "Network Degraded",
        message: `RPC latency is elevated. ${horizonHealth.status === "offline" ? "Horizon is offline. " : ""}${sorobanHealth.status === "offline" ? "Soroban RPC is offline. " : ""}Transactions may be slow.`,
        severity: "warning",
        category: "network",
        autoDismissMs: 30_000,
      });
    }

    // Recovery
    if (
      status === "online" &&
      (prevStatus === "offline" || prevStatus === "degraded")
    ) {
      alertStore.addAlert({
        title: "Network Recovered",
        message:
          "Stellar RPC nodes are back online. You can resume transactions.",
        severity: "success",
        category: "network",
        autoDismissMs: 10_000,
      });
    }

    // Congestion changes
    if (congestion === "high" && prevCongestion !== "high") {
      alertStore.addAlert({
        title: "High Network Congestion",
        message:
          "The Stellar network is heavily congested. Transactions may require higher fees and take longer to confirm.",
        severity: "warning",
        category: "network",
        autoDismissMs: 60_000,
      });
    } else if (congestion === "low" && prevCongestion === "high") {
      alertStore.addAlert({
        title: "Congestion Cleared",
        message: "Network congestion has returned to normal levels.",
        severity: "info",
        category: "network",
        autoDismissMs: 10_000,
      });
    }

    prevStatusRef.current = status;
    prevCongestionRef.current = congestion;
  }, [status, congestion, horizonHealth.status, sorobanHealth.status]);
}
