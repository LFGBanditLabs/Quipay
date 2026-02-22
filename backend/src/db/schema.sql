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
CREATE INDEX IF NOT EXISTS idx_withdrawals_day    ON withdrawals (date_trunc('day', created_at));

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
CREATE INDEX IF NOT EXISTS idx_vault_day        ON vault_events (date_trunc('day', created_at));

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
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_day     ON scheduler_logs (date_trunc('day', created_at));

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
