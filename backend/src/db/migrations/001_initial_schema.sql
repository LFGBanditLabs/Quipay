-- Migration: 001_initial_schema
-- Description: Initial database schema with all core tables
-- Created: 2026-03-25

-- Create schema_migrations table for tracking applied migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    checksum VARCHAR(64) NOT NULL,
    execution_time_ms INTEGER
);

-- Create index on applied_at for performance
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);

-- Sync cursors for tracking last ingested ledger per contract
CREATE TABLE IF NOT EXISTS sync_cursors (
    contract_id TEXT PRIMARY KEY,
    last_ledger BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Payroll streams (mirror of on-chain data)
CREATE TABLE IF NOT EXISTS payroll_streams (
    stream_id BIGINT PRIMARY KEY,
    employer TEXT NOT NULL,
    worker TEXT NOT NULL,
    total_amount NUMERIC NOT NULL,
    withdrawn_amount NUMERIC NOT NULL DEFAULT '0',
    start_ts BIGINT NOT NULL,
    end_ts BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    closed_at BIGINT,
    ledger_created BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for payroll_streams
CREATE INDEX IF NOT EXISTS idx_streams_employer ON payroll_streams(employer);
CREATE INDEX IF NOT EXISTS idx_streams_worker ON payroll_streams(worker);
CREATE INDEX IF NOT EXISTS idx_streams_status ON payroll_streams(status);
CREATE INDEX IF NOT EXISTS idx_streams_created_at ON payroll_streams(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_streams_start_ts ON payroll_streams(start_ts);
CREATE INDEX IF NOT EXISTS idx_streams_employer_status ON payroll_streams(employer, status);
CREATE INDEX IF NOT EXISTS idx_streams_worker_status ON payroll_streams(worker, status);
CREATE INDEX IF NOT EXISTS idx_streams_employer_created ON payroll_streams(employer, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_streams_worker_created ON payroll_streams(worker, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_streams_employer_worker ON payroll_streams(employer, worker);

-- Withdrawals table
CREATE TABLE IF NOT EXISTS withdrawals (
    id BIGSERIAL PRIMARY KEY,
    stream_id BIGINT NOT NULL REFERENCES payroll_streams(stream_id),
    worker TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    ledger BIGINT NOT NULL,
    ledger_ts BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for withdrawals
CREATE INDEX IF NOT EXISTS idx_withdrawals_stream ON withdrawals(stream_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_worker ON withdrawals(worker);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON withdrawals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_worker_created ON withdrawals(worker, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_stream_created ON withdrawals(stream_id, created_at DESC);

-- Vault events table
CREATE TABLE IF NOT EXISTS vault_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    address TEXT NOT NULL,
    token TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    ledger BIGINT NOT NULL,
    ledger_ts BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for vault_events
CREATE INDEX IF NOT EXISTS idx_vault_address ON vault_events(address);
CREATE INDEX IF NOT EXISTS idx_vault_event_type ON vault_events(event_type);
CREATE INDEX IF NOT EXISTS idx_vault_created_at ON vault_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vault_address_hash ON vault_events USING hash(address);

-- Payroll schedules table
CREATE TABLE IF NOT EXISTS payroll_schedules (
    id BIGSERIAL PRIMARY KEY,
    employer TEXT NOT NULL,
    worker TEXT NOT NULL,
    token TEXT NOT NULL,
    rate NUMERIC NOT NULL,
    cron_expression TEXT NOT NULL,
    duration_days INTEGER NOT NULL DEFAULT 30,
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for payroll_schedules
CREATE INDEX IF NOT EXISTS idx_schedules_employer ON payroll_schedules(employer);
CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON payroll_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON payroll_schedules(next_run_at);

-- Scheduler logs table
CREATE TABLE IF NOT EXISTS scheduler_logs (
    id BIGSERIAL PRIMARY KEY,
    schedule_id BIGINT NOT NULL REFERENCES payroll_schedules(id),
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    stream_id BIGINT,
    error_message TEXT,
    execution_time INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for scheduler_logs
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_schedule ON scheduler_logs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_status ON scheduler_logs(status);
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_created_at ON scheduler_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_schedule_created ON scheduler_logs(schedule_id, created_at DESC);

-- Treasury balances table
CREATE TABLE IF NOT EXISTS treasury_balances (
    employer TEXT PRIMARY KEY,
    balance NUMERIC NOT NULL DEFAULT '0',
    token TEXT NOT NULL DEFAULT 'USDC',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Treasury monitor log table
CREATE TABLE IF NOT EXISTS treasury_monitor_log (
    id BIGSERIAL PRIMARY KEY,
    employer TEXT NOT NULL,
    balance NUMERIC NOT NULL,
    liabilities NUMERIC NOT NULL,
    runway_days NUMERIC,
    alert_sent BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for treasury_monitor_log
CREATE INDEX IF NOT EXISTS idx_monitor_log_employer ON treasury_monitor_log(employer);
CREATE INDEX IF NOT EXISTS idx_monitor_log_created ON treasury_monitor_log(created_at DESC);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    log_level TEXT NOT NULL,
    message TEXT NOT NULL,
    action_type TEXT NOT NULL,
    employer TEXT,
    context JSONB NOT NULL DEFAULT '{}',
    transaction_hash TEXT,
    block_number BIGINT,
    error_message TEXT,
    error_code TEXT,
    error_stack TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT log_level_check CHECK (log_level IN ('INFO', 'WARN', 'ERROR'))
);

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_level ON audit_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_employer ON audit_logs(employer);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_context ON audit_logs USING gin(context);
CREATE INDEX IF NOT EXISTS idx_audit_logs_employer_timestamp ON audit_logs(employer, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action_type, created_at DESC);
