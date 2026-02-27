# Treasury Monitoring - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

### Step 2: Configure Environment

```bash
# Copy the example environment file
cp ../.env.example ../.env

# Edit .env and set these variables:
TREASURY_RUNWAY_ALERT_DAYS=7
MONITOR_INTERVAL_MS=300000
ALERT_SLACK_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Step 3: Setup Database

```bash
# Apply the schema to your PostgreSQL database
psql $DATABASE_URL < src/db/schema.sql
```

### Step 4: Start the Service

```bash
npm run dev
```

You should see:

```
🏦 Treasury monitor started (interval: 300000ms, runway alert threshold: 7 days)
```

### Step 5: Test the Monitor

```bash
# Check the status endpoint
curl http://localhost:3001/monitor/status
```

## 📊 Understanding the Response

```json
{
  "status": "ok",
  "employers": [
    {
      "employer": "GABC...",
      "balance": 100000000, // 10 tokens (in stroops)
      "liabilities": 70000000, // 7 tokens
      "daily_burn_rate": 10000000, // 1 token/day
      "runway_days": 10, // 10 days until exhaustion
      "funds_exhaustion_date": "2026-03-04T12:00:00.000Z",
      "alert_sent": false
    }
  ],
  "timestamp": "2026-02-22T12:00:00.000Z"
}
```

## 🔔 Setting Up Slack Alerts

### 1. Create a Slack Webhook

1. Go to https://api.slack.com/messaging/webhooks
2. Click "Create New App" → "From scratch"
3. Name it "Quipay Treasury Alerts"
4. Select your workspace
5. Click "Incoming Webhooks" → Enable
6. Click "Add New Webhook to Workspace"
7. Select a channel (e.g., #treasury-alerts)
8. Copy the webhook URL

### 2. Configure the Service

```bash
# In your .env file
ALERT_SLACK_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

### 3. Test the Alert

The monitor will automatically send alerts when:

- Runway drops below 7 days (configurable)
- Every monitoring cycle detects low runway

## 🧪 Running Tests

```bash
npm test -- monitor.test.ts
```

Expected output:

```
PASS  src/monitor/monitor.test.ts
  Treasury Monitor
    calculateDailyBurnRate
      ✓ should calculate burn rate for a single active stream
      ✓ should calculate burn rate for multiple active streams
      ✓ should return 0 for streams with no remaining balance
      ✓ should return 0 for expired streams
      ✓ should handle empty stream array
    calculateRunwayDays
      ✓ should calculate runway correctly
      ✓ should return null for zero burn rate
      ✓ should return null for negative burn rate
      ✓ should handle fractional runway days
    calculateExhaustionDate
      ✓ should calculate exhaustion date correctly
      ✓ should return null for null runway
      ✓ should handle fractional days
    Integration scenarios
      ✓ should correctly identify low runway scenario
      ✓ should correctly identify healthy treasury

Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
```

## 📝 Populating Test Data

To test the monitoring service, you need treasury balances and active streams:

```sql
-- Insert a test employer treasury balance
INSERT INTO treasury_balances (employer, balance, token)
VALUES ('GABC...', 50000000, 'USDC');

-- Insert a test active stream
INSERT INTO payroll_streams (
    stream_id, employer, worker, total_amount, withdrawn_amount,
    start_ts, end_ts, status, ledger_created
)
VALUES (
    1,
    'GABC...',
    'GDEF...',
    70000000,  -- 7 tokens
    0,
    EXTRACT(EPOCH FROM NOW())::BIGINT,
    EXTRACT(EPOCH FROM NOW() + INTERVAL '7 days')::BIGINT,
    'active',
    12345
);
```

This will create a scenario where:

- Balance: 5 tokens
- Liability: 7 tokens over 7 days
- Burn rate: 1 token/day
- Runway: 5 days ⚠️ (triggers alert!)

## 🔍 Monitoring Logs

Watch the console for monitoring activity:

```
[Monitor] 🔍 Running treasury monitor cycle…
[Monitor] ⚠️  Employer GABC... has low runway: 5.0 days (threshold: 7 days),
           balance: 50000000 stroops, daily burn: 10000000.00 stroops/day,
           exhaustion date: 2026-02-27T12:00:00.000Z
[Notifier] 🚨 Alert sent for employer GABC... — runway 5.0 days,
           exhaustion date: 2026-02-27T12:00:00.000Z
[Monitor] ✅ Cycle complete — checked 1 employer(s)
```

## ⚙️ Configuration Options

| Variable                     | Default | Description                        |
| ---------------------------- | ------- | ---------------------------------- |
| `TREASURY_RUNWAY_ALERT_DAYS` | 7       | Alert when runway < this many days |
| `MONITOR_INTERVAL_MS`        | 300000  | Check every N milliseconds (5 min) |
| `ALERT_WEBHOOK_URL`          | -       | Generic webhook for alerts         |
| `ALERT_SLACK_ENABLED`        | false   | Enable Slack notifications         |
| `SLACK_WEBHOOK_URL`          | -       | Slack webhook URL                  |
| `ALERT_EMAIL_ENABLED`        | false   | Enable email notifications         |

## 🐛 Troubleshooting

### Monitor Not Starting

```
[Monitor] ⚠️  Database not configured — treasury monitor disabled.
```

**Solution**: Set `DATABASE_URL` in your `.env` file

### No Alerts Being Sent

**Check:**

1. Is `ALERT_SLACK_ENABLED=true`?
2. Is `SLACK_WEBHOOK_URL` set correctly?
3. Is runway actually below threshold?
4. Check logs for delivery errors

### Database Errors

```
Failed to compute treasury status: relation "treasury_balances" does not exist
```

**Solution**: Run the schema migration:

```bash
psql $DATABASE_URL < src/db/schema.sql
```

## 📚 Additional Resources

- [Full Documentation](./TREASURY_MONITORING.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- [API Documentation](./README.md)

## 🎯 What's Next?

1. ✅ Monitor is running
2. ✅ Alerts are configured
3. 📊 Add a dashboard for visualization
4. 📧 Integrate email service (SendGrid/AWS SES)
5. 📱 Add SMS alerts for critical situations
6. 🤖 Implement auto-rebalancing

## 💡 Pro Tips

1. **Start with a higher threshold** (e.g., 14 days) to give more warning time
2. **Monitor multiple channels** - Don't rely on just one alert method
3. **Set up a dedicated Slack channel** for treasury alerts
4. **Review monitor logs regularly** to understand burn patterns
5. **Test alerts** by temporarily lowering the threshold

## 🆘 Need Help?

- Check the logs: `tail -f backend/logs/monitor.log`
- Review test cases: `backend/src/monitor/monitor.test.ts`
- Read full docs: `backend/TREASURY_MONITORING.md`
