-- Rollback: Remove rate column from payroll_streams

ALTER TABLE payroll_streams 
DROP COLUMN IF EXISTS rate;
