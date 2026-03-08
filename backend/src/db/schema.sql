-- Quipay Analytics Cache Schema
-- Run on startup via initDb() to ensure tables exist.

-- Track the last ingested ledger per contract (for idempotent sync)
CREATE TABLE IF NOT EXISTS sync_cursors (
    contract_id  TEXT        PRIMARY KEY,
    last_ledger  BIGINT      NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mirror of on-chain payroll_stream entries
CREATE TABLE IF NOT EXISTS payroll_streams (
    stream_id        BIGINT      PRIMARY KEY,
    employer         TEXT        NOT NULL,
    worker           TEXT        NOT NULL,
    total_amount     NUMERIC     NOT NULL,  -- stored in stroops (1e-7 XLM equivalent)
    withdrawn_amount NUMERIC     NOT NULL DEFAULT 0,
    start_ts         BIGINT      NOT NULL,  -- unix seconds (on-chain ledger timestamp)
    end_ts           BIGINT      NOT NULL,
    status           TEXT        NOT NULL DEFAULT 'active', -- active | completed | cancelled
    closed_at        BIGINT,
    ledger_created   BIGINT      NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_streams_employer   ON payroll_streams (employer);
CREATE INDEX IF NOT EXISTS idx_streams_worker     ON payroll_streams (worker);
CREATE INDEX IF NOT EXISTS idx_streams_status     ON payroll_streams (status);
CREATE INDEX IF NOT EXISTS idx_streams_created_at ON payroll_streams (created_at DESC);
-- For time-range filtering on charts
CREATE INDEX IF NOT EXISTS idx_streams_start_ts   ON payroll_streams (start_ts);

-- Per-withdrawal events
CREATE TABLE IF NOT EXISTS withdrawals (
    id          BIGSERIAL   PRIMARY KEY,
    stream_id   BIGINT      NOT NULL REFERENCES payroll_streams (stream_id),
    worker      TEXT        NOT NULL,
    amount      NUMERIC     NOT NULL,
    ledger      BIGINT      NOT NULL,
    ledger_ts   BIGINT      NOT NULL,       -- unix seconds
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_stream ON withdrawals (stream_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_worker ON withdrawals (worker);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON withdrawals (created_at DESC);

-- Vault deposit / payout events
CREATE TABLE IF NOT EXISTS vault_events (
    id          BIGSERIAL   PRIMARY KEY,
    event_type  TEXT        NOT NULL,  -- 'deposit' | 'payout'
    address     TEXT        NOT NULL,  -- from / to
    token       TEXT        NOT NULL,
    amount      NUMERIC     NOT NULL,
    ledger      BIGINT      NOT NULL,
    ledger_ts   BIGINT      NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_address    ON vault_events (address);
CREATE INDEX IF NOT EXISTS idx_vault_event_type ON vault_events (event_type);
CREATE INDEX IF NOT EXISTS idx_vault_created_at ON vault_events (created_at DESC);

-- Payroll schedules for automated stream creation
CREATE TABLE IF NOT EXISTS payroll_schedules (
    id              BIGSERIAL   PRIMARY KEY,
    employer        TEXT        NOT NULL,
    worker          TEXT        NOT NULL,
    token           TEXT        NOT NULL,
    rate            NUMERIC     NOT NULL,
    cron_expression TEXT        NOT NULL,
    duration_days   INTEGER     NOT NULL DEFAULT 30,
    enabled         BOOLEAN     NOT NULL DEFAULT true,
    last_run_at     TIMESTAMPTZ,
    next_run_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedules_employer    ON payroll_schedules (employer);
CREATE INDEX IF NOT EXISTS idx_schedules_enabled     ON payroll_schedules (enabled);
CREATE INDEX IF NOT EXISTS idx_schedules_next_run    ON payroll_schedules (next_run_at);

-- Scheduler execution logs
CREATE TABLE IF NOT EXISTS scheduler_logs (
    id              BIGSERIAL   PRIMARY KEY,
    schedule_id     BIGINT      NOT NULL REFERENCES payroll_schedules (id),
    action          TEXT        NOT NULL,
    status          TEXT        NOT NULL,
    stream_id       BIGINT,
    error_message   TEXT,
    execution_time  INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduler_logs_schedule ON scheduler_logs (schedule_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_status  ON scheduler_logs (status);
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_created_at ON scheduler_logs (created_at DESC);

-- Treasury balances (employer deposits)
CREATE TABLE IF NOT EXISTS treasury_balances (
    employer        TEXT        PRIMARY KEY,
    balance         NUMERIC     NOT NULL DEFAULT 0,
    token           TEXT        NOT NULL DEFAULT 'USDC',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Treasury monitor logs
CREATE TABLE IF NOT EXISTS treasury_monitor_log (
    id              BIGSERIAL   PRIMARY KEY,
    employer        TEXT        NOT NULL,
    balance         NUMERIC     NOT NULL,
    liabilities     NUMERIC     NOT NULL,
    runway_days     NUMERIC,
    alert_sent      BOOLEAN     NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitor_log_employer ON treasury_monitor_log (employer);
CREATE INDEX IF NOT EXISTS idx_monitor_log_created  ON treasury_monitor_log (created_at DESC);

-- Audit logs for comprehensive action tracking
CREATE TABLE IF NOT EXISTS audit_logs (
    id              BIGSERIAL   PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    log_level       TEXT        NOT NULL CHECK (log_level IN ('INFO', 'WARN', 'ERROR')),
    message         TEXT        NOT NULL,
    action_type     TEXT        NOT NULL,
    employer        TEXT,
    context         JSONB       NOT NULL DEFAULT '{}',
    transaction_hash TEXT,
    block_number    BIGINT,
    error_message   TEXT,
    error_code      TEXT,
    error_stack     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_level ON audit_logs (log_level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_employer ON audit_logs (employer);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_context ON audit_logs USING GIN (context);

-- Outbound webhook delivery reliability
-- Stores one row per intended delivery (subscription + event payload)
CREATE TABLE IF NOT EXISTS webhook_outbound_events (
    id                 UUID        PRIMARY KEY,
    owner_id           TEXT        NOT NULL,
    subscription_id    TEXT        NOT NULL,
    url                TEXT        NOT NULL,
    event_type         TEXT        NOT NULL,
    request_payload    JSONB       NOT NULL,
    status             TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    attempt_count      INTEGER     NOT NULL DEFAULT 0,
    last_response_code INTEGER,
    last_error         TEXT,
    next_retry_at      TIMESTAMPTZ,
    last_attempt_at    TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_owner ON webhook_outbound_events (owner_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status_retry ON webhook_outbound_events (status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_outbound_events (created_at DESC);

-- Stores one row per delivery attempt (HTTP response code, timestamp, error)
CREATE TABLE IF NOT EXISTS webhook_outbound_attempts (
    id                 BIGSERIAL   PRIMARY KEY,
    event_id           UUID        NOT NULL REFERENCES webhook_outbound_events (id) ON DELETE CASCADE,
    attempt_number     INTEGER     NOT NULL,
    response_code      INTEGER,
    response_body      TEXT,
    error_message      TEXT,
    duration_ms        INTEGER,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_attempts_event_id ON webhook_outbound_attempts (event_id);
-- Composite indexes for frequently queried field combinations
-- payroll_streams: employer + status for filtered stream lookups
CREATE INDEX IF NOT EXISTS idx_streams_employer_status ON payroll_streams (employer, status);
-- payroll_streams: worker + status for worker stream lookups
CREATE INDEX IF NOT EXISTS idx_streams_worker_status ON payroll_streams (worker, status);
-- payroll_streams: employer + created_at for time-based employer queries
CREATE INDEX IF NOT EXISTS idx_streams_employer_created ON payroll_streams (employer, created_at DESC);
-- payroll_streams: worker + created_at for time-based worker queries
CREATE INDEX IF NOT EXISTS idx_streams_worker_created ON payroll_streams (worker, created_at DESC);
-- payroll_streams: employer + worker for combined lookups
CREATE INDEX IF NOT EXISTS idx_streams_employer_worker ON payroll_streams (employer, worker);

-- withdrawals: worker + created_at for recent withdrawals by worker
CREATE INDEX IF NOT EXISTS idx_withdrawals_worker_created ON withdrawals (worker, created_at DESC);
-- withdrawals: stream_id + created_at for ordered withdrawal history
CREATE INDEX IF NOT EXISTS idx_withdrawals_stream_created ON withdrawals (stream_id, created_at DESC);

-- scheduler_logs: schedule_id + created_at for execution history ordering
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_schedule_created ON scheduler_logs (schedule_id, created_at DESC);

-- audit_logs: employer + timestamp for time-based employer filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_employer_timestamp ON audit_logs (employer, timestamp DESC);
-- audit_logs: action_type + created_at for action-based filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs (action_type, created_at DESC);

-- Hash index for exact status matches (faster than B-Tree for equality)
CREATE INDEX IF NOT EXISTS idx_vault_address_hash ON vault_events USING HASH (address);
