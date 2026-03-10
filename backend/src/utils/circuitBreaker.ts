import CircuitBreaker from "opossum";
import {
  circuitBreakerState,
  circuitBreakerFailures,
  circuitBreakerSuccesses,
  circuitBreakerFallbacks,
} from "../metrics";

export interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  name: string;
}

/**
 * Creates and configures a circuit breaker for an external service call.
 */
export function createCircuitBreaker<T, Args extends any[]>(
  action: (...args: Args) => Promise<T>,
  options: CircuitBreakerOptions,
): CircuitBreaker<Args, T> {
  const breaker = new CircuitBreaker(action, {
    timeout: options.timeout || 10000,
    errorThresholdPercentage: options.errorThresholdPercentage || 50,
    resetTimeout: options.resetTimeout || 30000,
  });

  const { name } = options;

  // Initialize state metric
  circuitBreakerState.set({ name }, 0); // Closed by default

  breaker.on("open", () => {
    circuitBreakerState.set({ name }, 1);
    console.warn(`[CircuitBreaker] 🔴 Circuit breaker for '${name}' is OPEN`);
  });

  breaker.on("close", () => {
    circuitBreakerState.set({ name }, 0);
    console.log(`[CircuitBreaker] 🟢 Circuit breaker for '${name}' is CLOSED`);
  });

  breaker.on("halfOpen", () => {
    circuitBreakerState.set({ name }, 2);
    console.log(
      `[CircuitBreaker] 🟡 Circuit breaker for '${name}' is HALF-OPEN`,
    );
  });

  breaker.on("failure", (error: any) => {
    circuitBreakerFailures.inc({ name, error: error.message || "Unknown" });
    console.error(`[CircuitBreaker] ❌ Failure in '${name}':`, error.message);
  });

  breaker.on("success", () => {
    circuitBreakerSuccesses.inc({ name });
  });

  breaker.on("fallback", () => {
    circuitBreakerFallbacks.inc({ name });
    console.warn(`[CircuitBreaker] ⚠️ Fallback triggered for '${name}'`);
  });

  return breaker;
}
