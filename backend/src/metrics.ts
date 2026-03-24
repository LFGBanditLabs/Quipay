import { Registry, Counter, Gauge, Histogram } from "prom-client";

const circuitBreakerState = new Gauge({
  name: "circuit_breaker_state",
  help: "Current state of the circuit breaker (0: closed, 1: open, 2: half-open)",
  labelNames: ["name"],
});

const circuitBreakerFailures = new Counter({
  name: "circuit_breaker_failures_total",
  help: "Total number of circuit breaker failures",
  labelNames: ["name", "error"],
});

const circuitBreakerSuccesses = new Counter({
  name: "circuit_breaker_successes_total",
  help: "Total number of circuit breaker successes",
  labelNames: ["name"],
});

const circuitBreakerFallbacks = new Counter({
  name: "circuit_breaker_fallbacks_total",
  help: "Total number of circuit breaker fallbacks triggered",
  labelNames: ["name"],
});

export class MetricsManager {
  public register: Registry;
  public processedTransactions: Counter;
  public successRate: Gauge;
  public transactionLatency: Histogram;

  constructor() {
    this.register = new Registry();

    this.processedTransactions = new Counter({
      name: "quipay_processed_transactions_total",
      help: "Total number of processed transactions",
      labelNames: ["status"],
      registers: [this.register],
    });

    this.successRate = new Gauge({
      name: "quipay_transaction_success_rate",
      help: "Transaction success rate (0-1)",
      registers: [this.register],
    });

    this.transactionLatency = new Histogram({
      name: "quipay_transaction_latency_seconds",
      help: "Latency of transaction processing in seconds",
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    // Register circuit breaker metrics
    this.register.registerMetric(circuitBreakerState);
    this.register.registerMetric(circuitBreakerFailures);
    this.register.registerMetric(circuitBreakerSuccesses);
    this.register.registerMetric(circuitBreakerFallbacks);
  }

  public trackTransaction(
    status: "success" | "failure",
    latencySeconds: number,
  ) {
    this.processedTransactions.inc({ status });
    this.transactionLatency.observe(latencySeconds);

    // Simple mock success rate calculation
    // In a real scenario, this would be calculated over a window
  }

  public setSuccessRate(rate: number) {
    this.successRate.set(rate);
  }
}

export const metricsManager = new MetricsManager();
export {
  circuitBreakerState,
  circuitBreakerFailures,
  circuitBreakerSuccesses,
  circuitBreakerFallbacks,
};
