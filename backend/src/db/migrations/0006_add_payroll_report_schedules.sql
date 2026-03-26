-- Payroll report schedules table
CREATE TABLE IF NOT EXISTS payroll_report_schedules (
    id BIGSERIAL PRIMARY KEY,
    employer_id TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
    email TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_sent_at TIMESTAMPTZ,
    next_send_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_report_schedules_employer ON payroll_report_schedules(employer_id);
CREATE INDEX idx_report_schedules_enabled ON payroll_report_schedules(enabled);
CREATE INDEX idx_report_schedules_next_send ON payroll_report_schedules(next_send_at);

-- Add comment for documentation
COMMENT ON TABLE payroll_report_schedules IS 'Automated payroll report delivery schedules';
COMMENT ON COLUMN payroll_report_schedules.employer_id IS 'Employer identifier';
COMMENT ON COLUMN payroll_report_schedules.frequency IS 'Report frequency: weekly or monthly';
COMMENT ON COLUMN payroll_report_schedules.email IS 'Email address to send reports to';
COMMENT ON COLUMN payroll_report_schedules.enabled IS 'Whether the schedule is active';
COMMENT ON COLUMN payroll_report_schedules.last_sent_at IS 'Timestamp of last sent report';
COMMENT ON COLUMN payroll_report_schedules.next_send_at IS 'Scheduled time for next report';
