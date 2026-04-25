-- Rollback: 0010_add_payslip_tables

DROP INDEX IF EXISTS idx_payslip_generated_at;
DROP INDEX IF EXISTS idx_payslip_signature;
DROP INDEX IF EXISTS idx_payslip_worker_period;
DROP INDEX IF EXISTS idx_payslip_period;
DROP INDEX IF EXISTS idx_payslip_worker;

DROP TABLE IF EXISTS payslip_records;

DROP INDEX IF EXISTS idx_employer_branding_address;

DROP TABLE IF EXISTS employer_branding;
