import { horizonUrl } from "../contracts/util";

export type HorizonStatus = "online" | "degraded" | "offline";
export type CongestionLevel = "low" | "medium" | "high";

export interface NetworkStatus {
  status: HorizonStatus;
  latency: number;
  congestion: CongestionLevel;
  minFee: number;
}

/**
 * Checks the health of the Horizon server and current network congestion.
 */
export async function getNetworkStatus(): Promise<NetworkStatus> {
  const startTime = Date.now();

  try {
    // 1. Check Horizon Health (Root endpoint)
    const rootResponse = await fetch(horizonUrl);
    const latency = Date.now() - startTime;

    if (!rootResponse.ok) {
      return { status: "offline", latency, congestion: "low", minFee: 0 };
    }

    // 2. Check Fee Stats (Congestion)
    const feeResponse = await fetch(`${horizonUrl}/fee_stats`);
    if (!feeResponse.ok) {
      return {
        status: latency > 1000 ? "degraded" : "online",
        latency,
        congestion: "low",
        minFee: 0,
      };
    }

    const feeData = await feeResponse.json();
    const minFee = Number(feeData.fee_charged?.min || 100);

    // Thresholds: > 500 stroops = high, > 200 stroops = medium
    let congestion: CongestionLevel = "low";
    if (minFee > 500) congestion = "high";
    else if (minFee > 200) congestion = "medium";

    return {
      status: latency > 2000 ? "degraded" : "online",
      latency,
      congestion,
      minFee,
    };
  } catch (error) {
    console.error("Failed to fetch network status:", error);
    return {
      status: "offline",
      latency: Date.now() - startTime,
      congestion: "low",
      minFee: 0,
    };
  }
}
