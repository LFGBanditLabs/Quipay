-- Migration: 0009_add_soft_delete_streams
-- Replaces hard-delete behaviour on the payroll_streams table with soft-delete.
-- Adds deleted_at, deleted_by, and cancel_reason for compliance audit trails.

ALTER TABLE payroll_streams
    ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by    TEXT,
    ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Partial index so default queries (WHERE deleted_at IS NULL) stay fast.
CREATE INDEX IF NOT EXISTS idx_streams_not_deleted
    ON payroll_streams (stream_id)
    WHERE deleted_at IS NULL;

-- Stream-level audit table – one row per state transition.
CREATE TABLE IF NOT EXISTS stream_audit_log (
    id          BIGSERIAL   PRIMARY KEY,
    stream_id   BIGINT      NOT NULL REFERENCES payroll_streams (stream_id),
    changed_by  TEXT        NOT NULL,
    action      TEXT        NOT NULL,   -- e.g. 'created' | 'cancelled' | 'completed'
    old_status  TEXT,
    new_status  TEXT,
    reason      TEXT,
    metadata    JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_audit_stream_id
    ON stream_audit_log (stream_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stream_audit_changed_by
    ON stream_audit_log (changed_by);

COMMENT ON TABLE stream_audit_log IS
    'Immutable audit trail of every status change on a payroll stream.';
