DROP INDEX IF EXISTS ux_payroll_streams_active_employer_worker;

ALTER TABLE payroll_streams
DROP CONSTRAINT IF EXISTS payroll_streams_status_check;

ALTER TABLE payroll_streams
DROP CONSTRAINT IF EXISTS payroll_streams_total_amount_positive_check;
