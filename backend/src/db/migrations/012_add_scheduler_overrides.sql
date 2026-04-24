-- Migration: Add scheduler_overrides table for admin manual payroll overrides
-- Issue: #858
-- Description: Allows super-admins to queue manual payroll stream creation overrides
--              that the scheduler will dequeue and execute in its poll loop.

CREATE TABLE IF NOT EXISTS scheduler_overrides (
  id BIGSERIAL PRIMARY KEY,
  employer_address TEXT NOT NULL,
  worker_address TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create_stream', 'cancel_stream', 'pause_stream')),
  params JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_by TEXT NOT NULL,
  error_message TEXT,
  stream_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for efficient querying
CREATE INDEX idx_scheduler_overrides_status ON scheduler_overrides(status);
CREATE INDEX idx_scheduler_overrides_employer ON scheduler_overrides(employer_address);
CREATE INDEX idx_scheduler_overrides_created_at ON scheduler_overrides(created_at DESC);
CREATE INDEX idx_scheduler_overrides_pending ON scheduler_overrides(status, created_at) WHERE status = 'pending';

-- Add comment for documentation
COMMENT ON TABLE scheduler_overrides IS 'Queue for admin-triggered manual payroll operations that bypass normal scheduling';
COMMENT ON COLUMN scheduler_overrides.action IS 'Type of operation: create_stream, cancel_stream, or pause_stream';
COMMENT ON COLUMN scheduler_overrides.params IS 'JSON parameters for the action (e.g., amount, duration, token)';
COMMENT ON COLUMN scheduler_overrides.status IS 'Current status: pending (queued), processing (being executed), completed, or failed';
COMMENT ON COLUMN scheduler_overrides.created_by IS 'Admin address who created this override';
