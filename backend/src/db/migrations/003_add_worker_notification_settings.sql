CREATE TABLE IF NOT EXISTS worker_notification_settings (
    worker               TEXT        PRIMARY KEY,
    email_enabled        BOOLEAN     NOT NULL DEFAULT true,
    in_app_enabled       BOOLEAN     NOT NULL DEFAULT true,
    cliff_unlock_alerts  BOOLEAN     NOT NULL DEFAULT true,
    stream_ending_alerts BOOLEAN     NOT NULL DEFAULT true,
    low_runway_alerts    BOOLEAN     NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_notification_settings_updated
    ON worker_notification_settings (updated_at DESC);
