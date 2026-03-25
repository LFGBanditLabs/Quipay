# Database Migrations

This directory contains SQL migration files for the Quipay backend database.

## Overview

The migration system provides:

- **Version Tracking**: All applied migrations are tracked in the `schema_migrations` table
- **Checksum Validation**: Detects if applied migrations have been modified
- **Transaction Support**: Each migration runs in a transaction (atomic)
- **Rollback Capability**: Supports rolling back the last applied migration
- **Execution Time Tracking**: Records how long each migration took

## Migration File Format

Migration files follow this naming convention:

```
{version}_{name}.sql
```

- `version`: 3-digit number (001, 002, 003, etc.)
- `name`: Descriptive name using snake_case
- Extension: `.sql`

Example: `001_initial_schema.sql`

### Rollback Files

Optional rollback files use the same naming with `_rollback` suffix:

```
{version}_{name}_rollback.sql
```

Example: `001_initial_schema_rollback.sql`

## Commands

### Run Migrations

Apply all pending migrations:

```bash
npm run migrate
```

This will:

1. Check for pending migrations
2. Validate existing migrations haven't been modified
3. Apply each pending migration in a transaction
4. Record the migration in `schema_migrations` table

### Check Migration Status

View current migration status:

```bash
npm run migrate:status
```

Output shows:

- Total number of migrations
- Applied migrations with timestamps
- Pending migrations

### Rollback Last Migration

Rollback the most recently applied migration:

```bash
npm run migrate:rollback
```

**Note**: Requires a corresponding `_rollback.sql` file.

### Create New Migration

Generate a new migration file:

```bash
npm run migrate:create -- "migration_name"
```

Example:

```bash
npm run migrate:create -- "add_user_email_column"
```

This creates:

- `003_add_user_email_column.sql` (migration)
- `003_add_user_email_column_rollback.sql` (rollback)

## Writing Migrations

### Best Practices

1. **Idempotent Operations**: Use `IF NOT EXISTS` / `IF EXISTS` clauses

```sql
-- Good
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL
);

-- Bad (fails if table exists)
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL
);
```

2. **Add Columns Safely**: Use `ADD COLUMN IF NOT EXISTS`

```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email TEXT;
```

3. **Create Indexes Concurrently** (for production):

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email
ON users(email);
```

4. **Add Comments**: Document your changes

```sql
-- Add email column for user notifications
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN users.email IS 'User email address for notifications';
```

5. **Handle Data Migrations**: Separate schema and data changes

```sql
-- Schema change
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Data migration (if needed)
UPDATE users SET status = 'active' WHERE status IS NULL;
```

### Migration Template

```sql
-- Migration: 003_add_user_email
-- Description: Add email column to users table for notifications
-- Created: 2026-03-25

-- Add email column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Add comment
COMMENT ON COLUMN users.email IS 'User email address for notifications';
```

### Rollback Template

```sql
-- Rollback: 003_add_user_email
-- Description: Remove email column from users table
-- Created: 2026-03-25

-- Drop index
DROP INDEX IF EXISTS idx_users_email;

-- Drop column
ALTER TABLE users DROP COLUMN IF EXISTS email;
```

## Schema Migrations Table

The `schema_migrations` table tracks all applied migrations:

```sql
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    checksum VARCHAR(64) NOT NULL,
    execution_time_ms INTEGER
);
```

Columns:

- `version`: Migration version number (unique)
- `name`: Migration name
- `applied_at`: When the migration was applied
- `checksum`: SHA-256 hash of the migration SQL
- `execution_time_ms`: How long the migration took

## Checksum Validation

The system calculates a SHA-256 checksum of each migration file. When running migrations:

1. Loads all migration files
2. Calculates checksums
3. Compares with checksums in `schema_migrations` table
4. **Fails if any applied migration has been modified**

This prevents accidental changes to already-applied migrations.

## Transaction Support

Each migration runs in a transaction:

```
BEGIN;
  -- Execute migration SQL
  -- Record in schema_migrations
COMMIT;
```

If any part fails, the entire migration is rolled back.

## Error Handling

### Migration Fails

If a migration fails:

1. Transaction is rolled back
2. Database remains in previous state
3. Error is logged
4. Process exits with error code

Fix the migration file and run again.

### Modified Migration Detected

If an applied migration has been modified:

```
Error: Migration 001 (initial_schema) has been modified after being applied.
Expected checksum: abc123..., got: def456...
```

**Solution**: Never modify applied migrations. Create a new migration instead.

### Missing Rollback File

If you try to rollback without a rollback file:

```
Error: Rollback file not found: 003_add_user_email_rollback.sql
```

**Solution**: Create the rollback file with the reverse operations.

## Production Considerations

### Before Deploying

1. **Test migrations locally**:

```bash
npm run migrate
npm run migrate:status
```

2. **Backup database**:

```bash
pg_dump -h localhost -U user -d quipay > backup.sql
```

3. **Review migration SQL**: Ensure it's safe for production

### During Deployment

1. **Stop application** (if needed for schema changes)
2. **Run migrations**:

```bash
npm run migrate
```

3. **Verify success**:

```bash
npm run migrate:status
```

4. **Start application**

### Zero-Downtime Migrations

For zero-downtime deployments:

1. **Add columns as nullable first**:

```sql
ALTER TABLE users ADD COLUMN email TEXT;
```

2. **Deploy application** (handles both schemas)

3. **Backfill data** (separate migration):

```sql
UPDATE users SET email = 'default@example.com' WHERE email IS NULL;
```

4. **Add constraints** (separate migration):

```sql
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
```

## Troubleshooting

### Migration stuck

Check for locks:

```sql
SELECT * FROM pg_locks WHERE NOT granted;
```

### Rollback failed

Manually fix and update `schema_migrations`:

```sql
DELETE FROM schema_migrations WHERE version = 3;
```

### Reset all migrations (DANGER)

**Only for development**:

```sql
DROP TABLE schema_migrations CASCADE;
-- Then run migrations again
```

## Examples

### Example 1: Add Column

```sql
-- Migration: 004_add_user_phone
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
```

```sql
-- Rollback: 004_add_user_phone
DROP INDEX IF EXISTS idx_users_phone;
ALTER TABLE users DROP COLUMN IF EXISTS phone;
```

### Example 2: Create Table

```sql
-- Migration: 005_create_notifications
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
ON notifications(user_id, created_at DESC);
```

```sql
-- Rollback: 005_create_notifications
DROP TABLE IF EXISTS notifications CASCADE;
```

### Example 3: Data Migration

```sql
-- Migration: 006_migrate_user_status
-- Add new status column
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Migrate existing data
UPDATE users
SET status = CASE
    WHEN deleted_at IS NOT NULL THEN 'deleted'
    WHEN suspended_at IS NOT NULL THEN 'suspended'
    ELSE 'active'
END
WHERE status IS NULL;

-- Add constraint
ALTER TABLE users ALTER COLUMN status SET NOT NULL;
```

## Resources

- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [PostgreSQL CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html)
- [PostgreSQL Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
