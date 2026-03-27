import { Registry, Counter, Gauge, Histogram } from "prom-client";

export interface DbPoolMetricSnapshot {
  total: number;
  active: number;
  idle: number;
  waiting: number;
  max: number;
  min: number;
}

let dbPoolMetricProvider: (() => DbPoolMetricSnapshot | null) | null = null;

export function setDbPoolMetricsProvider(
  provider: (() => DbPoolMetricSnapshot | null) | null,
) {
  dbPoolMetricProvider = provider;
}

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

const dbPoolTotalConnections = new Gauge({
  name: "quipay_db_pool_total_connections",
  help: "Total PostgreSQL connections currently opened by the pool",
  collect() {
    this.set(dbPoolMetricProvider?.()?.total ?? 0);
  },
});

const dbPoolActiveConnections = new Gauge({
  name: "quipay_db_pool_active_connections",
  help: "Active PostgreSQL connections currently checked out from the pool",
  collect() {
    this.set(dbPoolMetricProvider?.()?.active ?? 0);
  },
});

const dbPoolIdleConnections = new Gauge({
  name: "quipay_db_pool_idle_connections",
  help: "Idle PostgreSQL connections currently available in the pool",
  collect() {
    this.set(dbPoolMetricProvider?.()?.idle ?? 0);
  },
});

const dbPoolWaitingClients = new Gauge({
  name: "quipay_db_pool_waiting_clients",
  help: "Requests currently waiting for a PostgreSQL connection from the pool",
  collect() {
    this.set(dbPoolMetricProvider?.()?.waiting ?? 0);
  },
});

const dbPoolMaxConnections = new Gauge({
  name: "quipay_db_pool_max_connections",
  help: "Configured upper bound for PostgreSQL pool connections",
  collect() {
    this.set(dbPoolMetricProvider?.()?.max ?? 0);
  },
});

const dbPoolMinConnections = new Gauge({
  name: "quipay_db_pool_min_connections",
  help: "Configured lower bound for PostgreSQL pool connections",
  collect() {
    this.set(dbPoolMetricProvider?.()?.min ?? 0);
  },
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
    this.register.registerMetric(dbPoolTotalConnections);
    this.register.registerMetric(dbPoolActiveConnections);
    this.register.registerMetric(dbPoolIdleConnections);
    this.register.registerMetric(dbPoolWaitingClients);
    this.register.registerMetric(dbPoolMaxConnections);
    this.register.registerMetric(dbPoolMinConnections);
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

  public async snapshot(): Promise<string> {
    return this.register.metrics();
  }
}

export const metricsManager = new MetricsManager();
export {
  circuitBreakerState,
  circuitBreakerFailures,
  circuitBreakerSuccesses,
  circuitBreakerFallbacks,
};
