import { horizonUrl, rpcUrl } from "../contracts/util";

export type HorizonStatus = "online" | "degraded" | "offline";
export type CongestionLevel = "low" | "medium" | "high";

export interface RpcNodeHealth {
  name: string;
  url: string;
  status: HorizonStatus;
  latency: number;
  lastChecked: number;
  error?: string;
}

export interface NetworkStatus {
  status: HorizonStatus;
  latency: number;
  congestion: CongestionLevel;
  minFee: number;
  horizonHealth: RpcNodeHealth;
  sorobanHealth: RpcNodeHealth;
  ledgerSequence?: number;
  protocolVersion?: number;
}

/**
 * Pings a single RPC endpoint and returns its health.
 */
async function checkNodeHealth(
  name: string,
  url: string,
  path: string = "",
): Promise<RpcNodeHealth> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${url}${path}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latency = Date.now() - start;

    if (!response.ok) {
      return {
        name,
        url,
        status: "offline",
        latency,
        lastChecked: Date.now(),
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return {
      name,
      url,
      status: latency > 2000 ? "degraded" : "online",
      latency,
      lastChecked: Date.now(),
    };
  } catch (error) {
    return {
      name,
      url,
      status: "offline",
      latency: Date.now() - start,
      lastChecked: Date.now(),
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

/**
 * Checks the health of both Horizon and Soroban RPC servers,
 * plus fee stats and congestion.
 */
export async function getNetworkStatus(): Promise<NetworkStatus> {
  const startTime = Date.now();

  const [horizonHealth, sorobanHealth] = await Promise.all([
    checkNodeHealth("Stellar Horizon", horizonUrl),
    checkNodeHealth(
      "Soroban RPC",
      rpcUrl,
      rpcUrl.endsWith("/rpc") ? "" : "/health",
    ),
  ]);

  if (
    horizonHealth.status === "offline" &&
    sorobanHealth.status === "offline"
  ) {
    return {
      status: "offline",
      latency: Date.now() - startTime,
      congestion: "low",
      minFee: 0,
      horizonHealth,
      sorobanHealth,
    };
  }

  const overallStatus: HorizonStatus =
    horizonHealth.status === "offline" || sorobanHealth.status === "offline"
      ? "degraded"
      : horizonHealth.status === "degraded" ||
          sorobanHealth.status === "degraded"
        ? "degraded"
        : "online";

  const latency = Math.max(horizonHealth.latency, sorobanHealth.latency);

  let minFee = 100;
  let congestion: CongestionLevel = "low";
  let ledgerSequence: number | undefined;
  let protocolVersion: number | undefined;

  if (horizonHealth.status !== "offline") {
    try {
      const [feeResponse, rootResponse] = await Promise.all([
        fetch(`${horizonUrl}/fee_stats`).catch(() => null),
        fetch(horizonUrl).catch(() => null),
      ]);

      if (feeResponse?.ok) {
        const feeData = await feeResponse.json();
        minFee = Number(feeData.fee_charged?.min || 100);
        if (minFee > 500) congestion = "high";
        else if (minFee > 200) congestion = "medium";
      }

      if (rootResponse?.ok) {
        const rootData = await rootResponse.json();
        ledgerSequence = rootData.history_latest_ledger;
        protocolVersion = rootData.current_protocol_version;
      }
    } catch {
      // fee/ledger fetch is best-effort
    }
  }

  return {
    status: overallStatus,
    latency,
    congestion,
    minFee,
    horizonHealth,
    sorobanHealth,
    ledgerSequence,
    protocolVersion,
  };
}
