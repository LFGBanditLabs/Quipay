CREATE TABLE IF NOT EXISTS metric_snapshots (
    id              BIGSERIAL   PRIMARY KEY,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metrics_text    TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metric_snapshots_captured_at
    ON metric_snapshots (captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_metric_snapshots_created_at
    ON metric_snapshots (created_at DESC);
