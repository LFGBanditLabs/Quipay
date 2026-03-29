-- Migration: 0010_add_payslip_tables
-- Adds tables for PDF payslip generation with employer branding and cryptographic signatures
-- Payslips are generated per worker per period (e.g., 2025-01) and aggregate all streams in that period

-- Employer branding settings (logo and colors)
CREATE TABLE IF NOT EXISTS employer_branding (
    id SERIAL PRIMARY KEY,
    employer_address VARCHAR(56) NOT NULL UNIQUE,
    logo_url TEXT,
    logo_metadata JSONB,
    primary_color VARCHAR(7) NOT NULL DEFAULT '#2563eb',
    secondary_color VARCHAR(7) NOT NULL DEFAULT '#64748b',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_hex_primary CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT valid_hex_secondary CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE INDEX IF NOT EXISTS idx_employer_branding_address ON employer_branding(employer_address);

COMMENT ON TABLE employer_branding IS 'Stores employer branding settings for payslip customization';
COMMENT ON COLUMN employer_branding.logo_url IS 'URL to employer logo in object storage (S3)';
COMMENT ON COLUMN employer_branding.logo_metadata IS 'Logo file metadata (size, format, dimensions, uploadedAt)';
COMMENT ON COLUMN employer_branding.primary_color IS 'Primary brand color in hex format (#RRGGBB)';
COMMENT ON COLUMN employer_branding.secondary_color IS 'Secondary brand color in hex format (#RRGGBB)';

-- Payslip records (one per worker per period)
CREATE TABLE IF NOT EXISTS payslip_records (
    id SERIAL PRIMARY KEY,
    payslip_id VARCHAR(64) NOT NULL UNIQUE,
    worker_address VARCHAR(56) NOT NULL,
    period VARCHAR(7) NOT NULL, -- Format: YYYY-MM (e.g., 2025-01)
    signature TEXT NOT NULL,
    branding_snapshot JSONB NOT NULL,
    pdf_url TEXT,
    total_gross_amount NUMERIC NOT NULL,
    stream_ids BIGINT[] NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_worker_period UNIQUE (worker_address, period)
);

CREATE INDEX IF NOT EXISTS idx_payslip_worker ON payslip_records(worker_address);
CREATE INDEX IF NOT EXISTS idx_payslip_period ON payslip_records(period);
CREATE INDEX IF NOT EXISTS idx_payslip_worker_period ON payslip_records(worker_address, period);
CREATE INDEX IF NOT EXISTS idx_payslip_signature ON payslip_records(signature);
CREATE INDEX IF NOT EXISTS idx_payslip_generated_at ON payslip_records(generated_at);

COMMENT ON TABLE payslip_records IS 'Stores generated payslip records for audit and idempotency';
COMMENT ON COLUMN payslip_records.payslip_id IS 'Unique identifier for the payslip';
COMMENT ON COLUMN payslip_records.worker_address IS 'Stellar address of the worker';
COMMENT ON COLUMN payslip_records.period IS 'Period in YYYY-MM format (e.g., 2025-01)';
COMMENT ON COLUMN payslip_records.signature IS 'Cryptographic signature for authenticity verification';
COMMENT ON COLUMN payslip_records.branding_snapshot IS 'Snapshot of employer branding settings used for generation';
COMMENT ON COLUMN payslip_records.pdf_url IS 'Optional URL to stored PDF in object storage';
COMMENT ON COLUMN payslip_records.total_gross_amount IS 'Total gross amount across all streams in the period';
COMMENT ON COLUMN payslip_records.stream_ids IS 'Array of stream IDs included in this payslip';
