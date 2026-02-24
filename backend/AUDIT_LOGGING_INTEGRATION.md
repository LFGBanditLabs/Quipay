# Audit Logging System - Integration Guide

## Overview

The audit logging system is now integrated into the Quipay backend and will automatically log:

- ✅ All contract interactions via Express middleware
- ✅ All errors via error middleware
- ⏳ Stream creation (requires service integration)
- ⏳ Scheduler events (requires service integration)
- ⏳ Monitor events (requires service integration)

## What's Already Working

### 1. Automatic Contract Interaction Logging

The Express middleware automatically logs all requests that contain contract-related fields:

- `contractAddress`, `contract_address`, or `contract`
- `functionName`, `function_name`, `function`, or `method`

Example request that will be logged:

```json
POST /api/contract/call
{
  "contractAddress": "CCONTRACT...",
  "functionName": "transfer",
  "parameters": { "to": "GWORKER...", "amount": "100" },
  "employer": "GEMPLOYER..."
}
```

### 2. Automatic Error Logging

All Express errors are automatically logged with full context including:

- Error message and stack trace
- Request path and method
- Request body

### 3. Database Storage

All logs are stored in the `audit_logs` PostgreSQL table with:

- Indexed fields for fast queries
- JSONB context for flexible metadata
- Automatic timestamp tracking

## Next Steps: Service Integration

To complete the integration, add audit logging to your services:

### Integrate with Stream Creation Service

```typescript
import { getAuditLogger } from "./audit/init";

async function createStream(params: StreamParams) {
  const auditLogger = getAuditLogger();

  try {
    // Your stream creation logic
    const result = await stellarClient.createStream(params);

    // Log successful creation
    await auditLogger.logStreamCreation({
      employer: params.employer,
      worker: params.worker,
      token: params.token,
      amount: params.amount,
      duration: params.duration,
      streamId: result.streamId,
      transactionHash: result.txHash,
      blockNumber: result.ledger,
      success: true,
    });

    return result;
  } catch (error) {
    // Log failed creation
    await auditLogger.logStreamCreation({
      employer: params.employer,
      worker: params.worker,
      token: params.token,
      amount: params.amount,
      duration: params.duration,
      success: false,
      error: error as Error,
    });

    throw error;
  }
}
```

### Integrate with Scheduler Service

In `backend/src/scheduler/scheduler.ts`:

```typescript
import { getAuditLogger } from "../audit/init";

async function executeScheduledTask(schedule: PayrollSchedule) {
  const auditLogger = getAuditLogger();
  const startTime = Date.now();

  // Log task started
  await auditLogger.logSchedulerEvent({
    scheduleId: schedule.id,
    action: "task_started",
    taskName: `payroll-${schedule.id}`,
    employer: schedule.employer,
  });

  try {
    // Execute task
    await createStreamForSchedule(schedule);

    const executionTime = Date.now() - startTime;

    // Log task completed
    await auditLogger.logSchedulerEvent({
      scheduleId: schedule.id,
      action: "task_completed",
      taskName: `payroll-${schedule.id}`,
      employer: schedule.employer,
      executionTime,
    });
  } catch (error) {
    // Log task failed
    await auditLogger.logSchedulerEvent({
      scheduleId: schedule.id,
      action: "task_failed",
      taskName: `payroll-${schedule.id}`,
      employer: schedule.employer,
      error: error as Error,
    });

    throw error;
  }
}
```

### Integrate with Monitor Service

In `backend/src/monitor/monitor.ts`:

```typescript
import { getAuditLogger } from "../audit/init";

async function checkEmployerTreasury(employer: string) {
  const auditLogger = getAuditLogger();

  const balance = await getBalance(employer);
  const liabilities = await getLiabilities(employer);
  const dailyBurnRate = await calculateBurnRate(employer);
  const runwayDays = (balance - liabilities) / dailyBurnRate;

  const alertSent = runwayDays < RUNWAY_ALERT_THRESHOLD;

  if (alertSent) {
    await sendAlert(employer, runwayDays);
  }

  // Log monitoring check
  await auditLogger.logMonitorEvent({
    employer,
    balance,
    liabilities,
    dailyBurnRate,
    runwayDays,
    alertSent,
    checkType: "routine",
  });
}
```

## Querying Logs

### Via Code

```typescript
import { getAuditLogger } from "./audit/init";

const auditLogger = getAuditLogger();

// Query error logs for an employer
const errorLogs = await auditLogger.query({
  employer: "GEMPLOYER...",
  logLevel: "ERROR",
  startDate: new Date("2024-02-01"),
  endDate: new Date("2024-02-28"),
});

// Export logs
const jsonExport = await auditLogger.export("GEMPLOYER...", {
  format: "json",
  startDate: new Date("2024-02-01"),
});
```

### Via SQL

```sql
-- Get all error logs for an employer
SELECT * FROM audit_logs
WHERE employer = 'GEMPLOYER...'
  AND log_level = 'ERROR'
ORDER BY timestamp DESC
LIMIT 100;

-- Get stream creation logs
SELECT * FROM audit_logs
WHERE action_type = 'stream_creation'
  AND timestamp >= '2024-02-01'
ORDER BY timestamp DESC;

-- Get logs with specific context
SELECT * FROM audit_logs
WHERE context->>'worker' = 'GWORKER...'
ORDER BY timestamp DESC;
```

## Configuration

All configuration is via environment variables in `.env`:

```bash
# Log level (INFO, WARN, ERROR)
LOG_LEVEL=INFO

# Enable async writes
LOG_ASYNC_WRITES=true

# Queue and flush settings
LOG_QUEUE_SIZE=1000
LOG_FLUSH_INTERVAL=1000

# Redaction (enabled by default)
LOG_REDACTION_ENABLED=true
LOG_REDACT_FIELDS=customField1,customField2
```

## Testing

To test the audit logging:

1. Start the backend: `npm run dev`
2. Make a contract interaction request
3. Check the logs in PostgreSQL:

```sql
SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 10;
```

## Security

The audit logging system automatically redacts:

- ✅ Private keys (S + 55 characters)
- ✅ Seed phrases (12 or 24 words)
- ✅ JWT tokens (eyJ... format)
- ✅ Bearer tokens
- ✅ Custom sensitive fields (configurable)

Transaction hashes and public addresses are preserved for audit purposes.

## Performance

- Async writes with configurable flush interval (default: 1 second)
- In-memory queue with overflow protection (default: 1000 entries)
- Indexed database queries for fast retrieval
- Minimal overhead (<5ms per log entry)

## Troubleshooting

### Logs not appearing in database

1. Check DATABASE_URL is set in `.env`
2. Verify database schema is initialized: `SELECT * FROM audit_logs LIMIT 1;`
3. Check backend logs for audit logger initialization message
4. Verify LOG_LEVEL is not set too high (use INFO for all logs)

### Queue overflow warnings

Increase LOG_QUEUE_SIZE or decrease LOG_FLUSH_INTERVAL:

```bash
LOG_QUEUE_SIZE=2000
LOG_FLUSH_INTERVAL=500
```

### Sensitive data not redacted

Verify LOG_REDACTION_ENABLED=true and check the redaction patterns in `backend/src/audit/redactionEngine.ts`.
