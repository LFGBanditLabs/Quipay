-- Rollback: 001_initial_schema
-- Description: Rollback initial database schema
-- Created: 2026-03-25
-- WARNING: This will drop all tables and data!

-- Drop tables in reverse order (respecting foreign key constraints)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS treasury_monitor_log CASCADE;
DROP TABLE IF EXISTS treasury_balances CASCADE;
DROP TABLE IF EXISTS scheduler_logs CASCADE;
DROP TABLE IF EXISTS payroll_schedules CASCADE;
DROP TABLE IF EXISTS vault_events CASCADE;
DROP TABLE IF EXISTS withdrawals CASCADE;
DROP TABLE IF EXISTS payroll_streams CASCADE;
DROP TABLE IF EXISTS sync_cursors CASCADE;

-- Note: schema_migrations table is NOT dropped to maintain migration history
-- If you need to completely reset, manually drop schema_migrations
