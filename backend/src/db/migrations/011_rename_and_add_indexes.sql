-- Rename columns in payroll_streams
ALTER TABLE payroll_streams RENAME COLUMN employer TO employer_address;
ALTER TABLE payroll_streams RENAME COLUMN worker TO worker_address;

-- Renaming columns automatically updates existing indexes in PostgreSQL.
-- However, we want to ensure the indexes match the requested names and additional composite indexes.

-- Composite indexes for optimized queries
CREATE INDEX IF NOT EXISTS idx_streams_employer_status ON payroll_streams (employer_address, status);
CREATE INDEX IF NOT EXISTS idx_streams_worker_status ON payroll_streams (worker_address, status);
CREATE INDEX IF NOT EXISTS idx_streams_employer_created ON payroll_streams (employer_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_streams_worker_created ON payroll_streams (worker_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_streams_employer_worker ON payroll_streams (employer_address, worker_address);

-- Ensure base indexes exist on the new column names
CREATE INDEX IF NOT EXISTS idx_streams_employer_addr ON payroll_streams (employer_address);
CREATE INDEX IF NOT EXISTS idx_streams_worker_addr ON payroll_streams (worker_address);
