# Quipay – Prometheus Monitoring

## Alert rules.

`alert_rules.yml` contains Prometheus alerting rules for the backend service.
Load them by referencing the file in your `prometheus.yml`:

```yaml
# prometheus.yml
rule_files:
  - /path/to/quipay/monitoring/alert_rules.yml

scrape_configs:
  - job_name: quipay-backend
    static_configs:
      - targets: ["localhost:3000"] # adjust to your backend host:port
```

## Connecting Alertmanager

1. **Start Alertmanager** with a receiver configuration. Minimal example
   (`alertmanager.yml`):

   ```yaml
   global:
     resolve_timeout: 5m

   route:
     receiver: default

   receivers:
     - name: default
       slack_configs:
         - api_url: "<SLACK_WEBHOOK_URL>"
           channel: "#quipay-alerts"
           text: "{{ range .Alerts }}{{ .Annotations.description }}\n{{ end }}"
   ```

2. **Wire Prometheus to Alertmanager** by adding to `prometheus.yml`:

   ```yaml
   alerting:
     alertmanagers:
       - static_configs:
           - targets: ["localhost:9093"] # Alertmanager default port
   ```

3. **Reload Prometheus** (`SIGHUP` or `/-/reload` HTTP endpoint).

## Implemented alerts

| Alert                       | Severity | Condition                           |
| --------------------------- | -------- | ----------------------------------- |
| `HighTransactionErrorRate`  | warning  | failure rate > 5 % over 5 min       |
| `SchedulerJobFailures`      | warning  | circuit-breaker failures > 3 / hour |
| `CircuitBreakerOpen`        | critical | any circuit breaker open ≥ 1 min    |
| `HighTransactionLatency`    | warning  | P95 latency > 5 s over 5 min        |
| `LowTransactionSuccessRate` | warning  | success-rate gauge < 95 % for 5 min |

### Treasury runway alert (pending metric)

A `TreasuryRunwayLow` rule is included in `alert_rules.yml` but commented out.
To enable it, expose a new Prometheus gauge from
`backend/src/monitor/monitor.ts`:

```ts
// In metrics.ts – add:
export const employerRunwayDays = new client.Gauge({
  name: "quipay_employer_runway_days",
  help: "Estimated treasury runway in days per employer",
  labelNames: ["employer"],
});

// In monitor.ts – set after computeTreasuryStatus():
metricsManager.employerRunwayDays.set(
  { employer: status.employerId },
  status.runwayDays,
);
```

Then uncomment the `TreasuryRunwayLow` block in `alert_rules.yml`.

> **Note:** The application-level notifier (`backend/src/notifier/notifier.ts`).
> already fires a `treasury_low_runway` event via Slack / webhook when runway
> drops below `TREASURY_RUNWAY_ALERT_DAYS` (default 7 days). The Prometheus
> rule provides a secondary, infrastructure-level safety net.
