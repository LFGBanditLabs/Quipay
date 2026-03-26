import { horizonUrl, rpcUrl } from "../contracts/util";

export type HorizonStatus = "online" | "degraded" | "offline";
export type CongestionLevel = "low" | "medium" | "high";

export interface NetworkStatus {
  status: HorizonStatus;
  latency: number;
  congestion: CongestionLevel;
  minFee: number;
  horizon: {
    status: HorizonStatus;
    latency: number;
  };
  sorobanRpc: {
    status: HorizonStatus;
    latency: number;
  };
  issues: string[];
}

/**
 * Checks the health of the Horizon server and current network congestion.
 */
export async function getNetworkStatus(): Promise<NetworkStatus> {
  const startTime = Date.now();
  const issues: string[] = [];

  try {
    // 1. Check Horizon Health (Root endpoint)
    const rootResponse = await fetch(horizonUrl);
    const horizonLatency = Date.now() - startTime;
    const horizonStatus: HorizonStatus = !rootResponse.ok
      ? "offline"
      : horizonLatency > 2000
        ? "degraded"
        : "online";

    if (!rootResponse.ok) {
      issues.push("Horizon endpoint unreachable");
    }

    // 2. Check Fee Stats (Congestion)
    const feeResponse = await fetch(`${horizonUrl}/fee_stats`);
    if (!feeResponse.ok) {
      issues.push("Could not fetch Horizon fee stats");
    }
    const feeData = feeResponse.ok ? await feeResponse.json() : {};
    const minFee = Number(feeData.fee_charged?.min || 100);

    // 3. Check Soroban RPC endpoint
    const rpcStart = Date.now();
    let sorobanStatus: HorizonStatus = "online";
    let sorobanLatency = 0;
    try {
      const rpcResponse = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "health",
          method: "getHealth",
        }),
      });
      sorobanLatency = Date.now() - rpcStart;
      if (!rpcResponse.ok) {
        sorobanStatus = "offline";
        issues.push("Soroban RPC endpoint unreachable");
      } else if (sorobanLatency > 2000) {
        sorobanStatus = "degraded";
        issues.push("Soroban RPC latency is elevated");
      }
    } catch {
      sorobanStatus = "offline";
      sorobanLatency = Date.now() - rpcStart;
      issues.push("Soroban RPC request failed");
    }

    // Thresholds: > 500 stroops = high, > 200 stroops = medium
    let congestion: CongestionLevel = "low";
    if (minFee > 500) congestion = "high";
    else if (minFee > 200) congestion = "medium";
    if (congestion === "high") {
      issues.push("Network congestion is high");
    }

    const status: HorizonStatus =
      horizonStatus === "offline" || sorobanStatus === "offline"
        ? "offline"
        : horizonStatus === "degraded" || sorobanStatus === "degraded"
          ? "degraded"
          : "online";

    return {
      status,
      latency: Math.max(horizonLatency, sorobanLatency),
      congestion,
      minFee,
      horizon: {
        status: horizonStatus,
        latency: horizonLatency,
      },
      sorobanRpc: {
        status: sorobanStatus,
        latency: sorobanLatency,
      },
      issues,
    };
  } catch (error) {
    console.error("Failed to fetch network status:", error);
    return {
      status: "offline",
      latency: Date.now() - startTime,
      congestion: "low",
      minFee: 0,
      horizon: {
        status: "offline",
        latency: Date.now() - startTime,
      },
      sorobanRpc: {
        status: "offline",
        latency: 0,
      },
      issues: ["Network health check failed"],
    };
  }
}
