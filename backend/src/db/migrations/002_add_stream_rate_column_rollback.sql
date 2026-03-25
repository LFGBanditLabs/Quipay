-- Rollback: 002_add_stream_rate_column
-- Description: Remove rate column from payroll_streams
-- Created: 2026-03-25

-- Drop index
DROP INDEX IF EXISTS idx_streams_rate;

-- Drop column
ALTER TABLE payroll_streams DROP COLUMN IF EXISTS rate;
