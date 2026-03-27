-- Rollback initial schema
-- Drops all tables in reverse dependency order

DROP TABLE IF EXISTS webhook_outbound_attempts CASCADE;
DROP TABLE IF EXISTS webhook_outbound_events CASCADE;
DROP TABLE IF EXISTS dead_letter_queue CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS treasury_monitor_log CASCADE;
DROP TABLE IF EXISTS treasury_balances CASCADE;
DROP TABLE IF EXISTS scheduler_logs CASCADE;
DROP TABLE IF EXISTS payroll_schedules CASCADE;
DROP TABLE IF EXISTS vault_events CASCADE;
DROP TABLE IF EXISTS withdrawals CASCADE;
DROP TABLE IF EXISTS payroll_streams CASCADE;
DROP TABLE IF EXISTS sync_cursors CASCADE;
