CREATE TABLE IF NOT EXISTS employers (
    employer_id          TEXT        PRIMARY KEY,
    business_name        TEXT        NOT NULL,
    registration_number  TEXT        NOT NULL UNIQUE,
    country_code         TEXT        NOT NULL,
    contact_name         TEXT,
    contact_email        TEXT,
    verification_status  TEXT        NOT NULL DEFAULT 'pending'
        CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verification_reason  TEXT,
    verification_metadata JSONB      NOT NULL DEFAULT '{}',
    verified_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employers_status
    ON employers (verification_status);

CREATE INDEX IF NOT EXISTS idx_employers_country_status
    ON employers (country_code, verification_status);

CREATE INDEX IF NOT EXISTS idx_employers_updated_at
    ON employers (updated_at DESC);
