-- Migration: 0008_add_idempotency_keys
-- Persists idempotency keys for audit and cross-instance deduplication.
-- Keys expire after 24 hours (enforced by application-layer TTL and the
-- expires_at column; a maintenance job can purge stale rows).

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id             BIGSERIAL PRIMARY KEY,
    idempotency_key TEXT      NOT NULL,
    endpoint       TEXT      NOT NULL,
    status_code    INTEGER   NOT NULL,
    response_body  JSONB     NOT NULL DEFAULT '{}',
    expires_at     TIMESTAMPTZ NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_idempotency_key_endpoint UNIQUE (idempotency_key, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_key_endpoint
    ON idempotency_keys (idempotency_key, endpoint);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at
    ON idempotency_keys (expires_at);

COMMENT ON TABLE idempotency_keys IS
    'Audit log of idempotency keys used for deduplicating write requests.';
