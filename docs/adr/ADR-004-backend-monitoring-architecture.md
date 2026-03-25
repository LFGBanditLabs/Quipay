# ADR-004: Backend Monitoring Architecture

## Status

Accepted

## Context

Quipay's smart contracts handle on-chain payment streaming, but employers need off-chain monitoring and alerting for:

- **Treasury Solvency**: Detecting when funds are running low before streams fail
- **Runway Projections**: Calculating how many days until treasury exhaustion
- **Proactive Alerts**: Notifying employers before insolvency occurs
- **Historical Analytics**: Tracking treasury health over time
- **Event Processing**: Reacting to on-chain events (withdrawals, new streams)

Key requirements:

1. **Accuracy**: Monitoring must reflect actual on-chain state
2. **Timeliness**: Alerts must fire before funds run out
3. **Reliability**: System must handle RPC failures and network issues
4. **Scalability**: Support multiple employers with different alert thresholds
5. **Auditability**: All monitoring events must be logged for compliance

We evaluated several architectural approaches:

### Option 1: Pure On-Chain Monitoring

Implement monitoring logic entirely in smart contracts with on-chain alerts.

**Pros:**

- Guaranteed consistency with on-chain state
- No off-chain infrastructure required

**Cons:**

- High gas costs for periodic checks
- Limited notification options (no email/Slack/Discord)
- Cannot perform complex analytics or historical queries
- Difficult to customize per employer

### Option 2: Centralized Backend Service

Single Node.js service that polls blockchain and manages all monitoring.

**Pros:**

- Simple deployment and management
- Easy to implement complex logic

**Cons:**

- Single point of failure
- Difficult to scale horizontally
- No protection against concurrent execution

### Option 3: Event-Driven Microservices

Separate services for event listening, monitoring, alerting, and analytics.

**Pros:**

- Highly scalable and fault-tolerant
- Clear separation of concerns

**Cons:**

- Complex deployment (Kafka, multiple services)
- Overkill for current scale
- Higher operational overhead

## Decision

We will implement a **modular backend service** with the following architecture:

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Stellar Blockchain                       │
│  • PayrollStream contract events                            │
│  • PayrollVault balance changes                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Stellar Listener                          │
│  • Polls Soroban RPC for contract events                    │
│  • Circuit breaker for RPC failures                         │
│  • Parses events and triggers webhooks                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Treasury Monitor                          │
│  • Periodic health checks (every 5 minutes)                 │
│  • Calculates burn rate from active streams                 │
│  • Computes runway days and exhaustion date                 │
│  • Fires alerts when runway < threshold                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                       │
│  • Stores stream state (synced from blockchain)             │
│  • Logs monitoring events and alerts                        │
│  • Enables historical analytics                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Notification System                       │
│  • Webhook delivery (Discord, Slack, custom)                │
│  • Email alerts (future)                                    │
│  • SMS alerts (future)                                      │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

#### 1. Burn Rate Calculation

Instead of simple balance/liability ratios, we calculate accurate daily burn rates:

```typescript
export const calculateDailyBurnRate = (streams: Stream[]): number => {
  const now = Math.floor(Date.now() / 1000);
  let totalDailyBurn = 0;

  for (const stream of streams) {
    const remaining = stream.total_amount - stream.withdrawn_amount;
    if (remaining <= 0) continue;

    const remainingSeconds = Math.max(0, stream.end_ts - now);
    if (remainingSeconds === 0) continue;

    const remainingDays = remainingSeconds / 86400;
    const dailyRate = remaining / remainingDays;
    totalDailyBurn += dailyRate;
  }

  return totalDailyBurn;
};
```

This accounts for:

- Streams ending at different times
- Partially withdrawn streams
- Varying payment rates across streams

#### 2. Runway Projection

```typescript
export const calculateRunwayDays = (
  balance: number,
  dailyBurnRate: number,
): number | null => {
  if (dailyBurnRate <= 0) return null; // Unlimited runway
  return balance / dailyBurnRate;
};
```

Returns `null` for employers with no active streams (unlimited runway).

#### 3. Advisory Locking

Prevents concurrent monitor cycles using PostgreSQL advisory locks:

```typescript
await withAdvisoryLock(LOCK_ID_MONITOR, async () => {
  // Only one monitor cycle runs at a time
  const statuses = await computeTreasuryStatus();
  // ... process statuses
});
```

#### 4. Circuit Breaker Pattern

Protects against RPC failures:

```typescript
const getLatestLedgerBreaker = createCircuitBreaker(
  server.getLatestLedger.bind(server),
  {
    name: "stellar_get_latest_ledger",
    timeout: 5000,
  },
);
```

Automatically stops making requests after repeated failures, preventing cascade failures.

#### 5. Comprehensive Audit Logging

All monitoring events are logged to both:

- **PostgreSQL**: Structured storage for queries and analytics
- **Audit System**: Compliance-grade logging with automatic redaction

```typescript
await auditLogger.logMonitorEvent({
  employer: status.employer,
  balance: status.balance,
  liabilities: status.liabilities,
  dailyBurnRate: status.daily_burn_rate,
  runwayDays: status.runway_days,
  alertSent: status.alert_sent,
  checkType: "routine",
});
```

### Configuration

Environment variables control monitoring behavior:

```bash
# Alert threshold (default: 7 days)
TREASURY_RUNWAY_ALERT_DAYS=7

# Monitor interval (default: 5 minutes)
MONITOR_INTERVAL_MS=300000

# Soroban RPC endpoint
PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org

# Database connection
DATABASE_URL=postgresql://user:pass@localhost:5432/quipay
```

## Consequences

### Positive

- **Accurate Projections**: Burn rate calculation accounts for stream timing and partial withdrawals
- **Proactive Alerts**: Employers receive warnings before funds run out (default: 7 days)
- **Reliable Operation**: Circuit breakers and advisory locks prevent failures
- **Historical Analytics**: PostgreSQL storage enables trend analysis and reporting
- **Flexible Notifications**: Webhook system supports Discord, Slack, and custom integrations
- **Audit Compliance**: All monitoring events are logged with automatic PII redaction
- **Scalable**: Can handle hundreds of employers with minimal resource usage

### Negative

- **Database Dependency**: Requires PostgreSQL for state storage and locking
- **Polling Overhead**: 5-minute polling interval may miss rapid balance changes
- **State Synchronization**: Database must stay in sync with blockchain state
- **Operational Complexity**: Requires monitoring the monitoring system

### Mitigations

- **Database Dependency**: Graceful degradation when DB is unavailable (logs warnings, continues operation)
- **Polling Overhead**: 5 minutes is sufficient for payroll use cases (streams last days/weeks)
- **State Sync**: Stellar Listener continuously syncs events; monitor recalculates from source of truth
- **Operational Complexity**: Health check endpoints and structured logging enable observability

## Examples

### Example 1: Low Runway Alert

```
Employer: GEMPLOYER...
Balance: 10,000 USDC
Active Streams: 3
Daily Burn Rate: 1,500 USDC/day
Runway: 6.67 days
Exhaustion Date: 2026-03-31T10:30:00Z

Alert: ⚠️ Treasury runway below threshold (6.67 days < 7 days)
```

### Example 2: Healthy Treasury

```
Employer: GEMPLOYER...
Balance: 50,000 USDC
Active Streams: 2
Daily Burn Rate: 500 USDC/day
Runway: 100 days
Exhaustion Date: 2026-07-03T10:30:00Z

Status: ✅ Treasury healthy (100 days runway)
```

### Example 3: No Active Streams

```
Employer: GEMPLOYER...
Balance: 5,000 USDC
Active Streams: 0
Daily Burn Rate: 0 USDC/day
Runway: null (unlimited)

Status: ✅ No active streams, unlimited runway
```

## Performance Characteristics

- **Monitor Cycle Time**: ~500ms for 100 employers (PostgreSQL queries + calculations)
- **Memory Usage**: ~50MB base + ~1KB per active stream
- **Database Load**: 1 query per employer per cycle (optimized with indexes)
- **RPC Calls**: 1 call per 5 minutes (getLatestLedger) + 1 per new event batch

## Related Decisions

- [ADR-002: Time-Based Stream Computation](./ADR-002-time-based-stream-computation.md) - Burn rate uses same time-based calculations
- [ADR-003: Automation Gateway Authorization Model](./ADR-003-automation-gateway-authorization.md) - Backend agents use gateway for automated actions

## References

- `backend/src/monitor/monitor.ts` - Treasury monitoring implementation
- `backend/src/stellarListener.ts` - Event listener with circuit breakers
- `backend/src/audit/auditLogger.ts` - Audit logging system
- `backend/src/notifier/notifier.ts` - Webhook notification delivery
