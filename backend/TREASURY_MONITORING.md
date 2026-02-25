# Treasury Health Monitoring Service

## Overview

The Treasury Health Monitoring Service is a background service that continuously monitors employer treasury balances and alerts them BEFORE funds run low. This ensures improved reliability for workers' streaming payments by providing proactive warnings about impending insolvency.

## Features

### 1. Accurate Burn Rate Calculation

The service calculates the daily burn rate based on active payment streams:

```
For each active stream:
  daily_rate = remaining_amount / remaining_days

Total burn rate = sum of all active stream daily rates
```

This provides a precise, real-time calculation rather than using static averages.

### 2. Runway Estimation

The service calculates how many days until funds are exhausted:

```
Runway (days) = Current Balance / Daily Burn Rate
```

### 3. Funds Exhaustion Date

Based on the runway calculation, the service estimates the exact date when funds will be exhausted:

```
Exhaustion Date = Current Date + Runway Days
```

### 4. Automated Alerts

The service sends alerts via multiple channels when runway falls below the threshold (default: 7 days):

- **Webhooks**: Generic webhook integration for custom systems
- **Slack**: Rich formatted messages with treasury details
- **Email**: Placeholder for email service integration (SendGrid, AWS SES, etc.)

## Configuration

### Environment Variables

```bash
# Minimum runway days before triggering alerts (default: 7)
TREASURY_RUNWAY_ALERT_DAYS=7

# How often to run the monitor cycle in milliseconds (default: 300000 = 5 minutes)
MONITOR_INTERVAL_MS=300000

# Generic webhook URL for treasury alerts
ALERT_WEBHOOK_URL=https://your-webhook-url.com/alerts

# Enable email alerts (requires email service integration)
ALERT_EMAIL_ENABLED=false

# Enable Slack alerts
ALERT_SLACK_ENABLED=true

# Slack webhook URL for alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

## Database Schema

### Treasury Balances Table

```sql
CREATE TABLE treasury_balances (
    employer        TEXT        PRIMARY KEY,
    balance         NUMERIC     NOT NULL DEFAULT 0,
    token           TEXT        NOT NULL DEFAULT 'USDC',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Treasury Monitor Log Table

```sql
CREATE TABLE treasury_monitor_log (
    id              BIGSERIAL   PRIMARY KEY,
    employer        TEXT        NOT NULL,
    balance         NUMERIC     NOT NULL,
    liabilities     NUMERIC     NOT NULL,
    runway_days     NUMERIC,
    alert_sent      BOOLEAN     NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## API Endpoints

### GET /monitor/status

Returns the current treasury health status for all employers.

**Response:**

```json
{
  "status": "ok",
  "employers": [
    {
      "employer": "GABC...",
      "balance": 100000000,
      "liabilities": 70000000,
      "daily_burn_rate": 10000000,
      "runway_days": 10,
      "funds_exhaustion_date": "2026-03-04T12:00:00.000Z",
      "alert_sent": false
    }
  ],
  "timestamp": "2026-02-22T12:00:00.000Z"
}
```

## Alert Payload

When an alert is triggered, the following payload is sent:

```json
{
  "event": "treasury_low_runway",
  "employer": "GABC...",
  "balance": 50000000,
  "liabilities": 70000000,
  "daily_burn_rate": 10000000,
  "runway_days": 5,
  "funds_exhaustion_date": "2026-02-27T12:00:00.000Z",
  "alert_threshold_days": 7,
  "timestamp": "2026-02-22T12:00:00.000Z"
}
```

## Slack Alert Format

Alerts sent to Slack include:

- **Employer**: The employer's Stellar address
- **Runway**: Days until funds exhaustion
- **Balance**: Current treasury balance
- **Daily Burn Rate**: How much is being spent per day
- **Liabilities**: Total outstanding payment obligations
- **Exhaustion Date**: Estimated date when funds will run out

## Usage

### Starting the Monitor

The monitor starts automatically when the backend server starts:

```typescript
import { startMonitor } from "./monitor/monitor";

// In your main server file
startMonitor();
```

### Manual Trigger

You can manually trigger a monitoring cycle via the API:

```bash
curl http://localhost:3001/monitor/status
```

## Testing

Run the test suite:

```bash
cd backend
npm test -- monitor.test.ts
```

The test suite covers:

- Daily burn rate calculations for single and multiple streams
- Runway day calculations
- Exhaustion date calculations
- Edge cases (expired streams, fully withdrawn streams, etc.)
- Integration scenarios (low runway, healthy treasury)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Treasury Monitor                          │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   Compute    │───▶│   Evaluate   │───▶│    Alert     │ │
│  │   Treasury   │    │   Runway     │    │   Delivery   │ │
│  │   Status     │    │   Threshold  │    │              │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         │                                         │         │
│         ▼                                         ▼         │
│  ┌──────────────┐                        ┌──────────────┐ │
│  │   Database   │                        │   Webhooks   │ │
│  │   Queries    │                        │   Slack      │ │
│  │              │                        │   Email      │ │
│  └──────────────┘                        └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Acceptance Criteria

✅ **Calculate "Burn Rate" (liabilities per day)**

- Implemented accurate per-stream burn rate calculation
- Accounts for remaining balance and time on each stream
- Aggregates across all active streams per employer

✅ **Estimate "Funds Exhaustion Date" based on current balance**

- Calculates runway days: balance / daily_burn_rate
- Computes exhaustion date: current_date + runway_days
- Returns null for unlimited runway (no active streams)

✅ **Implement automated alerts via email/Slack when runway is < 7 days**

- Configurable threshold via TREASURY_RUNWAY_ALERT_DAYS
- Multi-channel alert delivery (Webhook, Slack, Email placeholder)
- Rich formatted Slack messages with all relevant details
- Alert logging to database for audit trail

✅ **Employers get proactive warnings about impending insolvency**

- Alerts trigger before funds run out (default: 7 days)
- Detailed information about balance, burn rate, and exhaustion date
- Multiple notification channels for reliability

✅ **Improved reliability for workers' streaming payments**

- Continuous monitoring (default: every 5 minutes)
- Accurate real-time burn rate calculations
- Proactive alerts give employers time to add funds
- Prevents payment stream failures due to insufficient balance

## Future Enhancements

1. **Email Integration**: Complete email service integration (SendGrid, AWS SES)
2. **SMS Alerts**: Add SMS notifications for critical alerts
3. **Predictive Analytics**: ML-based prediction of future burn rates
4. **Auto-Rebalancing**: Automatic treasury top-ups from connected accounts
5. **Dashboard**: Real-time treasury health visualization
6. **Historical Analysis**: Trend analysis and reporting
7. **Multi-Token Support**: Track balances across different token types
