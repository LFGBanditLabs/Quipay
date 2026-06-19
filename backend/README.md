# Quipay Webhook Backend

A robust webhook delivery system with Dead Letter Queue (DLQ) retry mechanism for the Quipay platform.

## Features

- ✅ **Webhook Delivery**: Reliable delivery of payroll, stream, and withdrawal events
- ✅ **Dead Letter Queue**: Failed webhooks are queued for retry with exponential backoff
- ✅ **Retry Worker**: Automated cron worker that retries failed deliveries up to 5 times
- ✅ **Audit Trail**: Comprehensive logging and audit events for permanently failed deliveries
- ✅ **No Silent Failures**: All webhook delivery failures are tracked and retried
- ✅ **RESTful API**: Management endpoints for monitoring and manual intervention

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Payroll       │    │   Webhook       │    │   Target        │
│   Events        │───▶│   Delivery      │───▶│   Server        │
│                 │    │   Service       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │                        │
                               ▼                        │
                       ┌─────────────────┐             │
                       │      DLQ        │             │
                       │   Database      │             │
                       │                 │             │
                       └─────────────────┘             │
                               ▲                        │
                               │                        │
                       ┌─────────────────┐             │
                       │   DLQ Retry     │             │
                       │   Worker        │─────────────┘
                       │   (Cron)        │
                       └─────────────────┘
```

## Installation

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Build TypeScript
npm run build

# Start development server
npm run dev

# Run tests
npm test

# Start DLQ worker standalone
npm run dlq:worker
```

## Usage

### Basic Webhook Delivery

```typescript
import { webhookDelivery } from "./src/delivery.js";

// Deliver a payroll completion event
const result = await webhookDelivery.deliverPayrollEvent(
  "https://customer-api.example.com/webhooks",
  "completed",
  {
    payrollId: "payroll_123",
    employerId: "emp_456",
    amount: "1500.00",
    currency: "USDC",
  },
);

if (!result.success) {
  console.log("Webhook added to DLQ for retry:", result.error);
}
```

### Manual DLQ Management

```bash
# Check DLQ statistics
curl http://localhost:3000/api/dlq/stats

# Get permanently failed entries
curl http://localhost:3000/api/dlq/failed

# Manually trigger retry processing
curl -X POST http://localhost:3000/api/dlq/retry-all

# Control DLQ worker
curl -X POST http://localhost:3000/api/dlq/worker/start
curl -X POST http://localhost:3000/api/dlq/worker/stop
```

## API Endpoints

### DLQ Management

| Endpoint                | Method | Description                             |
| ----------------------- | ------ | --------------------------------------- |
| `/api/dlq/stats`        | GET    | Get DLQ statistics and worker status    |
| `/api/dlq/failed`       | GET    | List permanently failed webhook entries |
| `/api/dlq/retry-all`    | POST   | Manually process all pending retries    |
| `/api/dlq/worker/start` | POST   | Start the DLQ retry worker              |
| `/api/dlq/worker/stop`  | POST   | Stop the DLQ retry worker               |

### Webhook Delivery

| Endpoint                        | Method | Description                        |
| ------------------------------- | ------ | ---------------------------------- |
| `/api/webhooks/send`            | POST   | Send a webhook (with DLQ fallback) |
| `/api/payroll/events/completed` | POST   | Trigger payroll completion webhook |
| `/api/payroll/events/failed`    | POST   | Trigger payroll failure webhook    |

### Request Examples

**Send Custom Webhook:**

```json
POST /api/webhooks/send
{
  "targetUrl": "https://api.example.com/webhook",
  "payload": {
    "event": "custom.event",
    "data": { "key": "value" }
  },
  "options": {
    "timeout": 5000,
    "maxRetries": 3
  }
}
```

**Payroll Event:**

```json
POST /api/payroll/events/completed
{
  "payrollData": {
    "payrollId": "payroll_123",
    "employerId": "emp_456",
    "totalAmount": "5000.00",
    "workerCount": 10
  },
  "webhookUrl": "https://employer-api.com/webhooks"
}
```

## Retry Strategy

The DLQ system uses exponential backoff for retries:

| Retry # | Delay      |
| ------- | ---------- |
| 1       | 30 seconds |
| 2       | 2 minutes  |
| 3       | 10 minutes |
| 4       | 1 hour     |
| 5       | 6 hours    |

After 5 failed attempts, webhooks are marked as permanently failed and an audit event is emitted.

## Database Schema

```sql
CREATE TABLE dlq (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,                    -- JSON webhook payload
  target_url TEXT NOT NULL,                 -- Destination URL
  retry_count INTEGER DEFAULT 0,            -- Current retry attempt
  last_attempt TEXT,                        -- Last retry timestamp
  next_retry TEXT,                          -- Next scheduled retry
  max_retries INTEGER DEFAULT 5,            -- Maximum retry attempts
  status TEXT DEFAULT 'pending',            -- pending|retrying|failed|success
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  error_message TEXT                        -- Last error message
);
```

## Monitoring & Observability

### Logs

All webhook deliveries and retry attempts are logged with structured data:

```json
{
  "level": "info",
  "message": "Webhook delivery successful",
  "targetUrl": "https://api.example.com/webhook",
  "event": "payroll.completed",
  "webhookId": "webhook_1703123456789_abc123",
  "statusCode": 200,
  "timestamp": "2023-12-21T10:30:00.000Z"
}
```

### Audit Events

Critical events are emitted for audit trail:

- `webhook.added_to_dlq` - Initial failure, added to retry queue
- `webhook.retry_success` - Successful retry after failure
- `webhook.retry_failed` - Retry attempt failed
- `webhook.permanently_failed` - Permanently failed after max retries

### Metrics

Monitor these key metrics:

- **DLQ queue depth** - Number of pending/retrying entries
- **Success rate** - Percentage of successful deliveries
- **Retry success rate** - Percentage of retries that succeed
- **Permanent failure rate** - Webhooks that exhaust all retries
- **Average retry count** - How many retries typically needed

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run integration tests only
npm test -- --testNamePattern="DLQ Integration"

# Watch mode
npm run test:watch
```

### Code Structure

```
src/
├── db/
│   └── dlq.ts              # DLQ database manager
├── utils/
│   ├── logger.ts           # Winston logger setup
│   └── auditEvents.ts      # Audit event emitter
├── workers/
│   └── dlqWorker.ts        # Cron-based retry worker
├── tests/
│   └── dlq.integration.test.ts  # Integration tests
├── delivery.ts             # Webhook delivery service
└── index.ts                # Express server & API
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY logs/ ./logs/
COPY data/ ./data/

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Environment Variables

Required environment variables for production:

```env
NODE_ENV=production
PORT=3000
DLQ_DB_PATH=/app/data/dlq.db
LOG_LEVEL=info
```

### Health Checks

The service provides a health check endpoint:

```bash
curl http://localhost:3000/health
```

Returns:

```json
{
  "status": "ok",
  "service": "quipay-webhook-service",
  "timestamp": "2023-12-21T10:30:00.000Z"
}
```

## Troubleshooting

### Common Issues

**DLQ entries not being retried:**

- Check if DLQ worker is running: `GET /api/dlq/stats`
- Check logs for worker errors
- Verify next_retry timestamps are not in the future

**High permanent failure rate:**

- Check target webhook URLs are reachable
- Verify webhook endpoints accept POST requests with JSON
- Review error messages in DLQ entries

**Performance issues:**

- Monitor concurrent retry limit (default: 5)
- Check database query performance on DLQ table
- Consider database indexing for large DLQ tables

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev
```

This will log all webhook attempts, retry scheduling, and DLQ operations.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

MIT License - see LICENSE file for details.
