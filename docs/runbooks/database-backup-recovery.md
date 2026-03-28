# Database Backup and Recovery Runbook

## Overview

Quipay's production database uses automated daily backups with point-in-time recovery (PITR) enabled. This runbook covers backup configuration, monitoring, and restore procedures.

## Backup Strategy

| Parameter              | Staging            | Production         |
| ---------------------- | ------------------ | ------------------ |
| Backup frequency       | Daily at 03:00 UTC | Daily at 03:00 UTC |
| Retention              | 7 days             | 30 days            |
| Point-in-time recovery | Enabled            | Enabled            |
| PITR granularity       | 5 minutes (WAL)    | 5 minutes (WAL)    |
| Storage location       | Same region        | Geo-redundant      |
| RPO (Recovery Point)   | 5 minutes          | 5 minutes          |
| RTO (Recovery Time)    | < 1 hour           | < 30 minutes       |

## Configuration

Backups are configured via Terraform in `infra/modules/database/main.tf`:

```hcl
backup_configuration {
  enabled                        = true
  start_time                     = "03:00"
  point_in_time_recovery_enabled = true
  transaction_log_retention_days = 7

  backup_retention_settings {
    retained_backups = 30
    retention_unit   = "COUNT"
  }
}
```

## Monitoring Backups

### Check backup status

```bash
# List recent backups
gcloud sql backups list --instance=quipay-production-postgres

# Verify latest backup succeeded
gcloud sql backups list \
  --instance=quipay-production-postgres \
  --filter="status=SUCCESSFUL" \
  --limit=1
```

### Alerts

Configure alerts for backup failures in your monitoring system. The backup job should emit metrics that trigger notifications on:

- Backup job failure
- Backup duration exceeding 2x the normal time
- Backup size anomaly (sudden drop may indicate data loss)

## Restore Procedures

### Restore from daily backup

```bash
# 1. Identify the backup to restore
gcloud sql backups list --instance=quipay-production-postgres

# 2. Restore to a new instance (never restore over production directly)
gcloud sql instances restore-backup quipay-restore-target \
  --backup-instance=quipay-production-postgres \
  --backup-id=BACKUP_ID

# 3. Verify data integrity on the restored instance
psql -h RESTORED_IP -U quipay_app -d quipay \
  -c "SELECT count(*) FROM workers; SELECT count(*) FROM streams;"

# 4. If verified, swap DNS or connection strings to point to the restored instance
```

### Point-in-time recovery (PITR)

Use PITR to recover to a specific timestamp (e.g., just before an accidental deletion):

```bash
# 1. Create a clone at the desired point in time
gcloud sql instances clone quipay-production-postgres quipay-pitr-restore \
  --point-in-time="2025-03-28T14:30:00Z"

# 2. Verify the restored data
psql -h PITR_IP -U quipay_app -d quipay \
  -c "SELECT * FROM streams WHERE deleted_at IS NULL LIMIT 10;"

# 3. Promote the clone if it looks correct, or extract specific data
```

### Emergency: restore to production

Only use this if the production database is completely unrecoverable:

```bash
# 1. Scale down all services to prevent writes
# 2. Restore from backup (as above)
# 3. Update connection strings to point to the new instance
# 4. Scale services back up
# 5. Verify application health
# 6. Run data integrity checks
```

## Monthly Restore Drill

On the first Monday of each month, the on-call engineer should:

1. Restore the latest production backup to a staging instance
2. Run the data integrity check script:
   ```bash
   psql -h STAGING_IP -U quipay_app -d quipay -f scripts/verify-backup-integrity.sql
   ```
3. Verify row counts match production (within the RPO window)
4. Document the result in the team's incident log
5. Delete the test restore instance

## Data Integrity Checks

After any restore, verify:

- [ ] Worker count matches expected range
- [ ] Stream count matches expected range
- [ ] No orphaned streams (streams without valid employer references)
- [ ] Treasury balances are non-negative
- [ ] Latest transaction timestamps are within RPO window of the target time
