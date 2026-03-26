-- Add rate column to payroll_streams for per-second payment rate tracking

ALTER TABLE payroll_streams 
ADD COLUMN IF NOT EXISTS rate NUMERIC;

COMMENT ON COLUMN payroll_streams.rate IS 'Per-second payment rate in stroops';
