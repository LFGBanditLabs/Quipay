# Database Migrations

This directory contains versioned SQL migrations for the Quipay database schema.

## Migration System

The migration system provides:

- **Version tracking**: Each migration has a unique version number
- **Checksum validation**: Detects if applied migrations have been modified
- **Transaction support**: Each migration runs in a transaction (rollback on failure)
- **Rollback capability**: Each migration has a corresponding rollback file
- **Execution tracking**: Records when migrations were applied and how long they took

## File Naming Convention

Migrations follow this naming pattern:

```
{version}_{name}.sql
{version}_{name}_rollback.sql
```

Examples:

- `001_initial_schema.sql` / `001_initial_schema_rollback.sql`
- `002_add_stream_rate_column.sql` / `002_add_stream_rate_column_rollback.sql`

## Commands

### Apply Pending Migrations

```bash
npm run migrate
```

This will apply all pending migrations in order.

### Check Migration Status

```bash
npm run migrate:status
```

Shows which migrations have been applied and which are pending.

### Rollback Last Migration

```bash
npm run migrate:rollback
```

Rolls back the most recently applied migration using its rollback file.

### Create New Migration

```bash
npm run migrate:create
```

Generates a new migration file with the next version number.

## Creating Migrations

### Manual Creation

1. Create two files in this directory:
   - `{version}_{name}.sql` - The migration SQL
   - `{version}_{name}_rollback.sql` - The rollback SQL

2. Version numbers are 3-digit padded (001, 002, 003, etc.)

3. Names should be lowercase with underscores (e.g., `add_user_roles`)

### Using the Generator

```bash
npm run migrate:create
```

This will prompt you for a migration name and create both files with boilerplate.

## Migration Best Practices

### 1. Make Migrations Idempotent

Use `IF NOT EXISTS` / `IF EXISTS` clauses where possible:

```sql
CREATE TABLE IF NOT EXISTS users (...);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
DROP TABLE IF EXISTS old_table;
```

### 2. Always Provide Rollbacks

Every migration must have a corresponding rollback file that undoes the changes:

```sql
-- Migration: 003_add_email_column.sql
ALTER TABLE users ADD COLUMN email TEXT;

-- Rollback: 003_add_email_column_rollback.sql
ALTER TABLE users DROP COLUMN email;
```

### 3. Test Migrations Locally

Before deploying:

1. Apply the migration: `npm run migrate`
2. Verify the changes work
3. Rollback: `npm run migrate:rollback`
4. Verify rollback works
5. Re-apply: `npm run migrate`

### 4. Keep Migrations Small

Each migration should do one logical thing. This makes them easier to:

- Review
- Test
- Rollback if needed
- Debug if something goes wrong

### 5. Never Modify Applied Migrations

Once a migration has been applied to any environment (especially production), never modify it. The system tracks checksums and will detect changes.

If you need to make changes, create a new migration.

### 6. Handle Data Migrations Carefully

When migrating data:

- Consider the size of the table
- Use batching for large tables
- Test with production-like data volumes
- Have a rollback plan for data changes

Example:

```sql
-- Batch update in chunks
UPDATE users SET status = 'active'
WHERE status IS NULL
AND id IN (SELECT id FROM users WHERE status IS NULL LIMIT 1000);
```

### 7. Add Indexes Concurrently (PostgreSQL)

For large tables, create indexes without locking:

```sql
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
```

Note: This cannot run inside a transaction, so handle carefully.

### 8. Document Complex Migrations

Add comments explaining why the migration is needed and any special considerations:

```sql
-- Migration: 005_add_user_roles.sql
-- Adds role-based access control to the users table
-- This migration is safe to run on production as it only adds new columns

ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
CREATE INDEX idx_users_role ON users(role);
```

## Migration Workflow

### Development

1. Create migration: `npm run migrate:create`
2. Write SQL in both migration and rollback files
3. Test locally: `npm run migrate`
4. Verify changes work
5. Test rollback: `npm run migrate:rollback`
6. Re-apply: `npm run migrate`
7. Commit both files to git

### Staging/Production

1. Pull latest code with migrations
2. Check status: `npm run migrate:status`
3. Review pending migrations
4. Backup database (if critical)
5. Apply migrations: `npm run migrate`
6. Verify application works
7. If issues, rollback: `npm run migrate:rollback`

## Troubleshooting

### Migration Failed Mid-Way

Migrations run in transactions, so a failed migration will be rolled back automatically. Fix the SQL and run `npm run migrate` again.

### Checksum Mismatch Error

This means an applied migration file has been modified. Never modify applied migrations. Create a new migration instead.

### Rollback File Missing

Every migration must have a rollback file. Create it before applying the migration.

### Need to Skip a Migration

This is not supported by design. If a migration is problematic:

1. Fix the migration SQL
2. Rollback if already applied: `npm run migrate:rollback`
3. Re-apply with fix: `npm run migrate`

## Schema Migrations Table

The system tracks applied migrations in the `schema_migrations` table:

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execution_time_ms INTEGER NOT NULL
);
```

This table is automatically created on first migration run.

## Example Migration

```sql
-- Migration: 003_add_stream_metadata.sql
-- Adds metadata fields to payroll_streams for better tracking

ALTER TABLE payroll_streams
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_streams_metadata
ON payroll_streams USING GIN (metadata);

COMMENT ON COLUMN payroll_streams.metadata IS 'Additional stream metadata and tags';
```

```sql
-- Rollback: 003_add_stream_metadata_rollback.sql

DROP INDEX IF EXISTS idx_streams_metadata;
ALTER TABLE payroll_streams DROP COLUMN IF EXISTS metadata;
```

## CI/CD Integration

Migrations can be run automatically in CI/CD pipelines:

```yaml
# Example GitHub Actions step
- name: Run database migrations
  run: npm run migrate
  working-directory: backend
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## Support

For questions or issues with migrations, check:

1. This README
2. The migration runner code: `backend/src/db/migrationRunner.ts`
3. Integration tests: `backend/src/__tests__/integration/migrationRunner.integration.test.ts`
