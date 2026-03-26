-- Admin audit trail table
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    admin_address TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    details JSONB NOT NULL DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_admin_audit_admin ON admin_audit_log(admin_address);
CREATE INDEX idx_admin_audit_action ON admin_audit_log(action);
CREATE INDEX idx_admin_audit_timestamp ON admin_audit_log(timestamp DESC);
CREATE INDEX idx_admin_audit_admin_timestamp ON admin_audit_log(admin_address, timestamp DESC);

-- Add comment for documentation
COMMENT ON TABLE admin_audit_log IS 'Audit trail for all administrative actions including pause, upgrade, and set_authorized_contract operations';
COMMENT ON COLUMN admin_audit_log.admin_address IS 'Address or ID of the admin who performed the action';
COMMENT ON COLUMN admin_audit_log.action IS 'Type of admin action performed (e.g., user_suspend, dlq_replay)';
COMMENT ON COLUMN admin_audit_log.target IS 'Target entity of the action (e.g., user ID, DLQ item ID)';
COMMENT ON COLUMN admin_audit_log.details IS 'Additional context including request/response data';
COMMENT ON COLUMN admin_audit_log.ip_address IS 'IP address of the client making the request';
COMMENT ON COLUMN admin_audit_log.user_agent IS 'User agent string from the HTTP request';
