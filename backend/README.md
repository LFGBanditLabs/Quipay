# Quipay Backend

Backend automation engine for the Quipay payroll streaming platform.

## Features

- Automated payroll stream creation
- Treasury monitoring and alerts
- Scheduler for recurring payments
- Comprehensive audit logging

## Audit Logging System

The backend includes a professional audit logging system that provides detailed trails for every automated action.

### Features

- **Structured JSON Logging**: All logs in machine-readable JSON format
- **Comprehensive Coverage**: Captures stream creation, contract interactions, monitoring, and scheduling events
- **Automatic Redaction**: Sensitive data (private keys, tokens, seed phrases) automatically redacted
- **Searchable Storage**: PostgreSQL-based storage with indexed queries
- **Export Functionality**: Export logs in JSON or CSV format
- **Log Rotation**: Automatic rotation and compression of old logs
- **Configurable Levels**: INFO, WARN, ERROR with runtime configuration

### Configuration

Configure audit logging via environment variables in `.env`:

```bash
# Minimum log level (INFO, WARN, ERROR)
LOG_LEVEL=INFO

# Enable async writes
LOG_ASYNC_WRITES=true

# Queue size for buffering
LOG_QUEUE_SIZE=1000

# Flush interval in milliseconds
LOG_FLUSH_INTERVAL=1000

# Log rotation settings
LOG_ROTATION_ENABLED=true
LOG_MAX_SIZE=1073741824  # 1GB
LOG_RETENTION_DAYS=90
LOG_COMPRESSION=true

# Redaction settings
LOG_REDACTION_ENABLED=true
LOG_REDACT_FIELDS=customField1,customField2
```

### Usage

```typescript
import { AuditLogger } from "./audit/auditLogger";
import { loadConfig } from "./audit/config";

// Initialize logger
const config = loadConfig();
const logger = new AuditLogger(config);

// Log stream creation
await logger.logStreamCreation({
  employer: "GEMPLOYER...",
  worker: "GWORKER...",
  token: "USDC",
  amount: "1000",
  duration: 30,
  streamId: 123,
  transactionHash: "0xabc...",
  blockNumber: 456789,
  success: true,
});

// Log contract interaction
await logger.logContractInteraction({
  contractAddress: "CCONTRACT...",
  functionName: "transfer",
  parameters: { to: "GWORKER...", amount: "100" },
  success: true,
  durationMs: 250,
});

// Query logs
const logs = await logger.query({
  employer: "GEMPLOYER...",
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-12-31"),
  logLevel: "ERROR",
});

// Export logs
const jsonExport = await logger.export("GEMPLOYER...", {
  format: "json",
  startDate: new Date("2024-01-01"),
});

const csvExport = await logger.export("GEMPLOYER...", {
  format: "csv",
  logLevel: "WARN",
});
```

### Log Entry Structure

```typescript
{
  "timestamp": "2024-02-24T10:30:00.000Z",
  "log_level": "INFO",
  "message": "Payroll stream created successfully",
  "action_type": "stream_creation",
  "employer": "GEMPLOYER...",
  "context": {
    "worker": "GWORKER...",
    "token": "USDC",
    "amount": "1000",
    "duration": 30,
    "stream_id": 123
  },
  "transaction_hash": "0xabc...",
  "block_number": 456789
}
```

### Security

The audit logging system automatically redacts:

- Private keys (S + 55 characters)
- Seed phrases (12 or 24 words)
- JWT tokens (eyJ... format)
- Bearer tokens
- Custom sensitive fields (configurable)

Transaction hashes and public addresses are preserved for audit purposes.

### Database Schema

Logs are stored in the `audit_logs` table:

```sql
CREATE TABLE audit_logs (
    id              BIGSERIAL   PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL,
    log_level       TEXT        NOT NULL,
    message         TEXT        NOT NULL,
    action_type     TEXT        NOT NULL,
    employer        TEXT,
    context         JSONB       NOT NULL,
    transaction_hash TEXT,
    block_number    BIGINT,
    error_message   TEXT,
    error_code      TEXT,
    error_stack     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Indexes are created on `timestamp`, `log_level`, `employer`, `action_type`, and `context` (GIN) for fast queries.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev
```

## Environment Variables

See `.env.example` for all available configuration options.
