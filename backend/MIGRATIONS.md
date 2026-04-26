# Drizzle Migrations Workflow

This document outlines the formal database migration and rollback procedures for the Quipay backend.

## Tools
- **Drizzle ORM**: TypeScript ORM for SQL databases.
- **Drizzle Kit**: CLI tool for migration generation and management.

## Workflow

### 1. Modifying the Schema
All database changes MUST start in `backend/src/db/schema.ts`. Do not manually edit the database.

### 2. Generating Migrations
Once you've updated `schema.ts`, generate a new migration file:
```bash
cd backend
npm run migration:generate
```
This creates a new SQL file in the `backend/drizzle` directory.

### 3. Reviewing Migrations
Always review the generated SQL in `backend/drizzle/*.sql` before committing.

### 4. Running Migrations Locally
To apply migrations to your local development database:
```bash
cd backend
npm run migration:run
```
Alternatively, for rapid development, you can use:
```bash
npm run migration:push
```
*Note: `push` should only be used in development as it bypasses the migration files.*

## Rollback Procedures

### Automatic Rollback
If a migration fails during `npm run migration:run`, the transaction will be rolled back automatically (if supported by the migration logic).

### Manual Rollback
Drizzle Kit does not have a built-in "down" migration command. If you need to revert a schema change:
1. Revert the changes in `backend/src/db/schema.ts`.
2. Generate a new migration that reverses the previous one.
3. Apply the new migration.

## CI/CD Integration
- **Verification**: The CI pipeline (`backend.yml`) runs `drizzle-kit check` to ensure migration files match the current schema.
- **Production**: Migrations are automatically run on startup in production environments.

## Deployment Checklist
1. [ ] Schema updated in `src/db/schema.ts`
2. [ ] Migration generated with `npm run migration:generate`
3. [ ] SQL verified in `backend/drizzle/`
4. [ ] Tested locally with `npm run migration:run`

## Payroll Stream Index Coverage
- `backend/src/db/schema.ts` already defines the hot-path indexes used by the payroll queries:
- `idx_streams_employer` on `payroll_streams.employer_address`
- `idx_streams_worker` on `payroll_streams.worker_address`
- `idx_streams_created_at` on `payroll_streams.created_at DESC`
- `idx_streams_status` on `payroll_streams.status`

These indexes are present in the generated Drizzle SQL under `backend/drizzle/`.

For verification on a seeded database, run:
```sql
EXPLAIN ANALYZE
SELECT * FROM payroll_streams
WHERE employer_address = 'GEMPLOYER1'
ORDER BY created_at DESC;

EXPLAIN ANALYZE
SELECT * FROM payroll_streams
WHERE worker_address = 'GWORKER1'
ORDER BY created_at DESC;
```

The integration suite asserts that PostgreSQL chooses an index-backed plan for these lookups, which is the expected improvement over sequential scans as the dataset grows.

## Issue #897 status

The backend schema in this repository models stream-heavy payroll workloads, so
the frequently queried columns are covered by:

- `idx_streams_employer` (`payroll_streams.employer_address`)
- `idx_streams_worker` (`payroll_streams.worker_address`)
- `idx_streams_created_at` (`payroll_streams.created_at DESC`)
- `idx_streams_status` (`payroll_streams.status`)

These indexes are already present in `backend/src/db/schema.ts` and generated
into `backend/drizzle/0000_quick_landau.sql`, so migration checks remain green.
