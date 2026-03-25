-- Migration: 002_add_stream_rate_column
-- Description: Add rate column to payroll_streams for per-second payment rate tracking
-- Created: 2026-03-25

-- Add rate column to payroll_streams
ALTER TABLE payroll_streams 
ADD COLUMN IF NOT EXISTS rate NUMERIC;

-- Add comment for documentation
COMMENT ON COLUMN payroll_streams.rate IS 'Payment rate in stroops per second';

-- Create index for rate-based queries
CREATE INDEX IF NOT EXISTS idx_streams_rate ON payroll_streams(rate) WHERE rate IS NOT NULL;
