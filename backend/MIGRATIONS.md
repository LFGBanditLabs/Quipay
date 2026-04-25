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
