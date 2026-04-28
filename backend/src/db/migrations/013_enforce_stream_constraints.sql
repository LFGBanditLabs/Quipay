-- Enforce integrity for stream amount/status and active-stream uniqueness.
ALTER TABLE payroll_streams
ADD CONSTRAINT payroll_streams_total_amount_positive_check
CHECK (total_amount > 0);

ALTER TABLE payroll_streams
ADD CONSTRAINT payroll_streams_status_check
CHECK (status IN ('active', 'paused', 'cancelled', 'completed'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_payroll_streams_active_employer_worker
ON payroll_streams (employer_address, worker_address)
WHERE status = 'active';
