import CircuitBreaker from "opossum";
import { metricsManager } from "../metrics";

type BreakerEntry = { breaker: any; action: (...args: any[]) => Promise<any> };
type BreakerMap = Map<string, BreakerEntry>;

const breakers: BreakerMap = new Map();

type BreakerOptions = {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  rollingCountTimeout?: number;
  volumeThreshold?: number;
};

const baseOptions = {
  timeout: parseInt(process.env.CB_TIMEOUT_MS || "8000", 10),
  errorThresholdPercentage: parseInt(
    process.env.CB_ERROR_THRESHOLD_PERCENT || "50",
    10,
  ),
  resetTimeout: parseInt(process.env.CB_RESET_TIMEOUT_MS || "10000", 10),
  rollingCountTimeout: parseInt(
    process.env.CB_ROLLING_WINDOW_MS || "10000",
    10,
  ),
  volumeThreshold: parseInt(process.env.CB_VOLUME_THRESHOLD || "5", 10),
};

function attachMetrics(service: string, breaker: any) {
  metricsManager.setCircuitState(service, 0);

  breaker.on("open", () => {
    metricsManager.setCircuitState(service, 1);
    metricsManager.incCircuitEvent(service, "open");
  });
  breaker.on("halfOpen", () => {
    metricsManager.setCircuitState(service, 0.5);
    metricsManager.incCircuitEvent(service, "half_open");
  });
  breaker.on("close", () => {
    metricsManager.setCircuitState(service, 0);
    metricsManager.incCircuitEvent(service, "close");
  });
  breaker.on("success", (res: unknown, latencyMs: number) => {
    metricsManager.incCircuitEvent(service, "success");
    metricsManager.observeCircuitLatency(service, latencyMs / 1000);
  });
  breaker.on("failure", () => {
    metricsManager.incCircuitEvent(service, "failure");
  });
  breaker.on("timeout", () => {
    metricsManager.incCircuitEvent(service, "timeout");
  });
  breaker.on("reject", () => {
    metricsManager.incCircuitEvent(service, "reject");
  });
  breaker.on("fallback", () => {
    metricsManager.incCircuitEvent(service, "fallback");
  });
}

export function getOrCreateBreaker<T extends (...args: any[]) => Promise<any>>(
  service: string,
  action: T,
  opts?: Partial<BreakerOptions>,
): any {
  const key = service;
  if (breakers.has(key)) {
    const entry = breakers.get(key)!;
    if (entry.action !== action) {
      try {
        entry.breaker.shutdown && entry.breaker.shutdown();
      } catch {
        // ignore errors while shutting down old breaker
      }
      const newBreaker = new CircuitBreaker(action as any, {
        ...baseOptions,
        ...opts,
      } as any);
      attachMetrics(service, newBreaker);
      const newEntry: BreakerEntry = { breaker: newBreaker, action };
      breakers.set(key, newEntry);
      return newBreaker;
    }
    return entry.breaker;
  }
  const breaker = new CircuitBreaker(action as any, {
    ...baseOptions,
    ...opts,
  } as any);
  attachMetrics(service, breaker);
  breakers.set(key, { breaker, action });
  return breaker as any;
}

export async function executeWithBreaker<T>(
  service: string,
  action: (...args: any[]) => Promise<T>,
  args: any[] = [],
  fallback?: () => Promise<T>,
  opts?: Partial<BreakerOptions>,
): Promise<T> {
  const breaker = getOrCreateBreaker(service, action as any, opts);
  if (fallback) {
    breaker.fallback(fallback as any);
  }
  return breaker.fire(...args) as Promise<T>;
}

export function classifyServiceFromUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("openai.com")) return "openai";
    if (u.hostname.includes("discord.com")) return "discord";
    if (u.hostname.includes("hooks.slack.com")) return "slack";
    if (u.hostname.includes("stellar.org")) return "stellar";
    return "http_external";
  } catch {
    return "http_external";
  }
}
