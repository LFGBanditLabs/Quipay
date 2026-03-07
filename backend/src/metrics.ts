import { Registry, Counter, Gauge, Histogram } from "prom-client";

class MetricsManager {
  public register: Registry;
  public processedTransactions: Counter;
  public successRate: Gauge;
  public transactionLatency: Histogram;
  public circuitBreakerState: Gauge;
  public circuitBreakerEvents: Counter;
  public circuitBreakerLatency: Histogram;

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

    this.circuitBreakerState = new Gauge({
      name: "quipay_circuit_breaker_state",
      help: "Circuit breaker state (0=closed,0.5=half-open,1=open)",
      labelNames: ["service"],
      registers: [this.register],
    });

    this.circuitBreakerEvents = new Counter({
      name: "quipay_circuit_breaker_events_total",
      help: "Circuit breaker events",
      labelNames: ["service", "event"],
      registers: [this.register],
    });

    this.circuitBreakerLatency = new Histogram({
      name: "quipay_circuit_breaker_latency_seconds",
      help: "Latency of protected calls",
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.register],
    });
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

  public setCircuitState(service: string, state: number) {
    this.circuitBreakerState.labels(service).set(state);
  }

  public incCircuitEvent(service: string, event: string) {
    this.circuitBreakerEvents.inc({ service, event });
  }

  public observeCircuitLatency(service: string, seconds: number) {
    this.circuitBreakerLatency.observe(seconds);
  }
}

export const metricsManager = new MetricsManager();
