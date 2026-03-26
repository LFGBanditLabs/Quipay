# Load testing suite

This directory contains Artillery scenarios for backend API performance testing.

## Scenarios

- `create-streams.yml`: simulates 50 concurrent users creating streams (write workload)
- `query-balances.yml`: simulates 100 concurrent users querying balances (read workload)

## Metrics captured

Artillery reports:

- p50 / p95 / p99 latency
- requests per second
- error rate (via non-2xx response counts)

## Threshold targets

- Read endpoints: p99 < 500ms (`query-balances.yml`)
- Write endpoints: p99 < 2s (`create-streams.yml`)

Thresholds are enforced through Artillery's `ensure` plugin and will fail the run if breached.

## Run

From repository root:

```bash
npm run test:load
```

## Endpoint overrides

Use Artillery CLI overrides to target specific backend routes:

- Base URL override with `-t`
- Path override with `--overrides`

Example:

```bash
artillery run tests/load/create-streams.yml \
  -t http://localhost:3001 \
  --overrides '{"scenarios":[{"name":"create-stream","flow":[{"post":{"url":"/streams","json":{}}}]}]}'
```
