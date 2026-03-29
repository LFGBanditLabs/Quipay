import { query, getPool } from "./pool";
import { globalCache } from "../utils/cache";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StreamRecord {
  stream_id: number;
  employer: string;
  worker: string;
  total_amount: string;
  withdrawn_amount: string;
  start_ts: number;
  end_ts: number;
  status: "active" | "completed" | "cancelled";
  closed_at?: number;
  ledger_created: number;
  created_at: Date;
  updated_at: Date;
}

export interface WithdrawalRecord {
  id: number;
  stream_id: number;
  worker: string;
  amount: string;
  ledger: number;
  ledger_ts: number;
  created_at: Date;
}

export interface VaultEventRecord {
  id: number;
  event_type: "deposit" | "payout";
  address: string;
  token: string;
  amount: string;
  ledger: number;
  ledger_ts: number;
  created_at: Date;
}

export type EmployerVerificationStatus = "pending" | "verified" | "rejected";

export interface EmployerRecord {
  employer_id: string;
  business_name: string;
  registration_number: string;
  country_code: string;
  contact_name: string | null;
  contact_email: string | null;
  verification_status: EmployerVerificationStatus;
  verification_reason: string | null;
  verification_metadata: Record<string, unknown>;
  verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface TrendPoint {
  bucket: string; // ISO date string
  volume: string; // total amount in that period
  stream_count: number;
  withdrawal_count: number;
}

export interface OverallStats {
  total_streams: number;
  active_streams: number;
  completed_streams: number;
  cancelled_streams: number;
  total_volume: string;
  total_withdrawn: string;
}

export interface EmployerPayrollSummary {
  total_streams: number;
  active_streams: number;
  completed_streams: number;
  cancelled_streams: number;
  total_disbursed: string;
}

export interface EmployerMonthlyPayrollPoint {
  month: string;
  payroll_volume: string;
}

export interface EmployerWorkerPayrollBreakdown {
  worker: string;
  stream_count: number;
  active_streams: number;
  completed_streams: number;
  cancelled_streams: number;
  total_allocated: string;
  total_disbursed: string;
}

export interface PayrollSchedule {
  id: number;
  employer: string;
  worker: string;
  token: string;
  rate: string;
  cron_expression: string;
  duration_days: number;
  enabled: boolean;
  last_run_at: Date | null;
  next_run_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SchedulerLog {
  id: number;
  schedule_id: number;
  action: string;
  status: "success" | "failed" | "skipped";
  stream_id: number | null;
  error_message: string | null;
  execution_time: number | null;
  created_at: Date;
}

export interface WebhookOutboundEventRecord {
  id: string;
  owner_id: string;
  subscription_id: string;
  url: string;
  event_type: string;
  request_payload: unknown;
  status: "pending" | "success" | "failed";
  attempt_count: number;
  last_response_code: number | null;
  last_error: string | null;
  next_retry_at: Date | null;
  last_attempt_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PayrollProofRecord {
  id: number;
  stream_id: number;
  cid: string;
  ipfs_url: string;
  gateway_url: string;
  proof_json: unknown;
  created_at: Date;
}

// ─── Cursor helpers (for sync worker) ───────────────────────────────────────

export const getLastSyncedLedger = async (
  contractId: string,
): Promise<number> => {
  const res = await query<{ last_ledger: string }>(
    "SELECT last_ledger FROM sync_cursors WHERE contract_id = $1",
    [contractId],
  );
  return res.rows.length > 0 ? parseInt(res.rows[0].last_ledger, 10) : 0;
};

export const updateSyncCursor = async (
  contractId: string,
  ledger: number,
): Promise<void> => {
  await query(
    `INSERT INTO sync_cursors (contract_id, last_ledger, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (contract_id) DO UPDATE
           SET last_ledger = EXCLUDED.last_ledger,
               updated_at  = NOW()`,
    [contractId, ledger],
  );
};

// ─── Stream writes ───────────────────────────────────────────────────────────

export const upsertStream = async (params: {
  streamId: number;
  employer: string;
  worker: string;
  totalAmount: bigint;
  withdrawnAmount: bigint;
  startTs: number;
  endTs: number;
  status: "active" | "completed" | "cancelled";
  closedAt?: number;
  ledger: number;
  metadata?: Record<string, string>;
}): Promise<void> => {
  if (!getPool()) return; // DB not configured
  await query(
    `INSERT INTO payroll_streams
           (stream_id, employer, worker, total_amount, withdrawn_amount,
            start_ts, end_ts, status, closed_at, ledger_created, metadata, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW())
         ON CONFLICT (stream_id) DO UPDATE
           SET withdrawn_amount = EXCLUDED.withdrawn_amount,
               status           = EXCLUDED.status,
               closed_at        = EXCLUDED.closed_at,
               metadata         = EXCLUDED.metadata,
               updated_at       = NOW()`,
    [
      params.streamId,
      params.employer,
      params.worker,
      params.totalAmount.toString(),
      params.withdrawnAmount.toString(),
      params.startTs,
      params.endTs,
      params.status,
      params.closedAt ?? null,
      params.ledger,
      params.metadata ?? null,
    ],
  );

  // Invalidate global analytics cache
  globalCache.del("analytics:summary");
  globalCache.invalidateByPrefix("analytics:trends:");
  globalCache.del(`analytics:address:${params.employer}`);
  globalCache.del(`analytics:address:${params.worker}`);
  globalCache.invalidateByPrefix(`analytics:payroll:${params.employer}:`);
};

export const recordWithdrawal = async (params: {
  streamId: number;
  worker: string;
  amount: bigint;
  ledger: number;
  ledgerTs: number;
}): Promise<void> => {
  if (!getPool()) return;
  await query(
    `INSERT INTO withdrawals (stream_id, worker, amount, ledger, ledger_ts)
         VALUES ($1,$2,$3,$4,$5)`,
    [
      params.streamId,
      params.worker,
      params.amount.toString(),
      params.ledger,
      params.ledgerTs,
    ],
  );

  // Invalidate worker analytics cache
  globalCache.del(`analytics:address:${params.worker}`);
  globalCache.del("analytics:summary"); // total withdrawn changes
  const stream = await getStreamById(params.streamId);
  if (stream) {
    globalCache.invalidateByPrefix(`analytics:payroll:${stream.employer}:`);
  }
};

export const recordVaultEvent = async (params: {
  eventType: "deposit" | "payout";
  address: string;
  token: string;
  amount: bigint;
  ledger: number;
  ledgerTs: number;
}): Promise<void> => {
  if (!getPool()) return;
  await query(
    `INSERT INTO vault_events (event_type, address, token, amount, ledger, ledger_ts)
         VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      params.eventType,
      params.address,
      params.token,
      params.amount.toString(),
      params.ledger,
      params.ledgerTs,
    ],
  );
};

// ─── Analytics reads ─────────────────────────────────────────────────────────

export const getOverallStats = async (): Promise<OverallStats> => {
  const res = await query<OverallStats>(`
        SELECT
            COUNT(*)                                       AS total_streams,
            COUNT(*) FILTER (WHERE status = 'active')      AS active_streams,
            COUNT(*) FILTER (WHERE status = 'completed')   AS completed_streams,
            COUNT(*) FILTER (WHERE status = 'cancelled')   AS cancelled_streams,
            COALESCE(SUM(total_amount),    0)              AS total_volume,
            COALESCE(SUM(withdrawn_amount),0)              AS total_withdrawn
        FROM payroll_streams
        WHERE deleted_at IS NULL
    `);
  const row = res.rows[0];
  return {
    total_streams: Number(row.total_streams),
    active_streams: Number(row.active_streams),
    completed_streams: Number(row.completed_streams),
    cancelled_streams: Number(row.cancelled_streams),
    total_volume: row.total_volume,
    total_withdrawn: row.total_withdrawn,
  };
};

export const getEmployerPayrollSummary = async (
  employer: string,
): Promise<EmployerPayrollSummary> => {
  const res = await query<EmployerPayrollSummary>(
    `SELECT
        COUNT(*)                                      AS total_streams,
        COUNT(*) FILTER (WHERE status = 'active')     AS active_streams,
        COUNT(*) FILTER (WHERE status = 'completed')  AS completed_streams,
        COUNT(*) FILTER (WHERE status = 'cancelled')  AS cancelled_streams,
        COALESCE(SUM(withdrawn_amount), 0)            AS total_disbursed
      FROM payroll_streams
      WHERE employer = $1`,
    [employer],
  );

  const row = res.rows[0];
  return {
    total_streams: Number(row?.total_streams ?? 0),
    active_streams: Number(row?.active_streams ?? 0),
    completed_streams: Number(row?.completed_streams ?? 0),
    cancelled_streams: Number(row?.cancelled_streams ?? 0),
    total_disbursed: row?.total_disbursed ?? "0",
  };
};

export const getEmployerPayrollMonthly = async (
  employer: string,
): Promise<EmployerMonthlyPayrollPoint[]> => {
  const res = await query<EmployerMonthlyPayrollPoint>(
    `WITH months AS (
        SELECT generate_series(
          date_trunc('month', NOW()) - interval '11 months',
          date_trunc('month', NOW()),
          interval '1 month'
        ) AS month_start
      )
      SELECT
        to_char(months.month_start, 'YYYY-MM') AS month,
        COALESCE(SUM(w.amount), 0)             AS payroll_volume
      FROM months
      LEFT JOIN payroll_streams s
        ON s.employer = $1
      LEFT JOIN withdrawals w
        ON w.stream_id = s.stream_id
       AND date_trunc('month', to_timestamp(w.ledger_ts)) = months.month_start
      GROUP BY months.month_start
      ORDER BY months.month_start ASC`,
    [employer],
  );

  return res.rows;
};

export const getEmployerPayrollByWorker = async (
  employer: string,
): Promise<EmployerWorkerPayrollBreakdown[]> => {
  const res = await query<EmployerWorkerPayrollBreakdown>(
    `SELECT
        worker,
        COUNT(*)                                     AS stream_count,
        COUNT(*) FILTER (WHERE status = 'active')    AS active_streams,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_streams,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_streams,
        COALESCE(SUM(total_amount), 0)               AS total_allocated,
        COALESCE(SUM(withdrawn_amount), 0)           AS total_disbursed
      FROM payroll_streams
      WHERE employer = $1
      GROUP BY worker
      ORDER BY worker ASC`,
    [employer],
  );

  return res.rows.map((row) => ({
    worker: row.worker,
    stream_count: Number(row.stream_count),
    active_streams: Number(row.active_streams),
    completed_streams: Number(row.completed_streams),
    cancelled_streams: Number(row.cancelled_streams),
    total_allocated: row.total_allocated,
    total_disbursed: row.total_disbursed,
  }));
};

export const getStreamsByEmployer = async (
  employer: string,
  status?: string,
  limit = 50,
  offset = 0,
  includeDeleted = false,
): Promise<StreamRecord[]> => {
  const params: unknown[] = [employer, limit, offset];
  const clauses: string[] = [];
  if (!includeDeleted) clauses.push("deleted_at IS NULL");
  if (status) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  const whereExtra = clauses.length ? `AND ${clauses.join(" AND ")}` : "";
  const res = await query<StreamRecord>(
    `SELECT * FROM payroll_streams
         WHERE employer = $1 ${whereExtra}
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
    params,
  );
  return res.rows;
};

export const getStreamsByWorker = async (
  worker: string,
  status?: string,
  limit = 50,
  offset = 0,
  includeDeleted = false,
): Promise<StreamRecord[]> => {
  const params: unknown[] = [worker, limit, offset];
  const clauses: string[] = [];
  if (!includeDeleted) clauses.push("deleted_at IS NULL");
  if (status) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  const whereExtra = clauses.length ? `AND ${clauses.join(" AND ")}` : "";
  const res = await query<StreamRecord>(
    `SELECT * FROM payroll_streams
         WHERE worker = $1 ${whereExtra}
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
    params,
  );
  return res.rows;
};

export const getPayrollTrends = async (
  address: string | null,
  granularity: "daily" | "weekly" = "daily",
): Promise<TrendPoint[]> => {
  const truncUnit = granularity === "weekly" ? "week" : "day";
  const params: unknown[] = [];
  let addressFilter = "";
  if (address) {
    params.push(address);
    addressFilter = `WHERE employer = $1 OR worker = $1`;
  }

  const res = await query<TrendPoint>(
    `SELECT
            date_trunc('${truncUnit}', created_at)::TEXT AS bucket,
            COALESCE(SUM(total_amount), 0)               AS volume,
            COUNT(*)                                     AS stream_count,
            0                                            AS withdrawal_count
         FROM payroll_streams
         ${addressFilter}
         GROUP BY 1
         ORDER BY 1`,
    params,
  );
  return res.rows;
};

export const getAddressStats = async (
  address: string,
): Promise<{
  asEmployer: OverallStats;
  asWorker: OverallStats;
  recentWithdrawals: WithdrawalRecord[];
}> => {
  const [empRes, wrkRes, wdRes] = await Promise.all([
    query<OverallStats>(
      `SELECT
                COUNT(*)                                       AS total_streams,
                COUNT(*) FILTER (WHERE status = 'active')      AS active_streams,
                COUNT(*) FILTER (WHERE status = 'completed')   AS completed_streams,
                COUNT(*) FILTER (WHERE status = 'cancelled')   AS cancelled_streams,
                COALESCE(SUM(total_amount),    0)              AS total_volume,
                COALESCE(SUM(withdrawn_amount),0)              AS total_withdrawn
             FROM payroll_streams WHERE employer = $1`,
      [address],
    ),
    query<OverallStats>(
      `SELECT
                COUNT(*)                                       AS total_streams,
                COUNT(*) FILTER (WHERE status = 'active')      AS active_streams,
                COUNT(*) FILTER (WHERE status = 'completed')   AS completed_streams,
                COUNT(*) FILTER (WHERE status = 'cancelled')   AS cancelled_streams,
                COALESCE(SUM(total_amount),    0)              AS total_volume,
                COALESCE(SUM(withdrawn_amount),0)              AS total_withdrawn
             FROM payroll_streams WHERE worker = $1`,
      [address],
    ),
    query<WithdrawalRecord>(
      `SELECT * FROM withdrawals WHERE worker = $1 ORDER BY created_at DESC LIMIT 20`,
      [address],
    ),
  ]);

  const toStats = (row: OverallStats): OverallStats => ({
    total_streams: Number(row.total_streams),
    active_streams: Number(row.active_streams),
    completed_streams: Number(row.completed_streams),
    cancelled_streams: Number(row.cancelled_streams),
    total_volume: row.total_volume,
    total_withdrawn: row.total_withdrawn,
  });

  return {
    asEmployer: toStats(empRes.rows[0]),
    asWorker: toStats(wrkRes.rows[0]),
    recentWithdrawals: wdRes.rows,
  };
};

// ─── Scheduler queries ────────────────────────────────────────────────────────

export const getActivePayrollSchedules = async (): Promise<
  PayrollSchedule[]
> => {
  if (!getPool()) return [];
  const res = await query<PayrollSchedule>(
    `SELECT * FROM payroll_schedules WHERE enabled = true ORDER BY next_run_at ASC`,
  );
  return res.rows;
};

export const getPayrollSchedulesByEmployer = async (
  employer: string,
): Promise<PayrollSchedule[]> => {
  if (!getPool()) return [];
  const res = await query<PayrollSchedule>(
    `SELECT * FROM payroll_schedules WHERE employer = $1 ORDER BY created_at DESC`,
    [employer],
  );
  return res.rows;
};

export const createPayrollSchedule = async (params: {
  employer: string;
  worker: string;
  token: string;
  rate: bigint;
  cronExpression: string;
  durationDays: number;
  nextRunAt?: Date;
}): Promise<number> => {
  if (!getPool()) throw new Error("Database not configured");
  const res = await query<{ id: string }>(
    `INSERT INTO payroll_schedules
            (employer, worker, token, rate, cron_expression, duration_days, next_run_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
    [
      params.employer,
      params.worker,
      params.token,
      params.rate.toString(),
      params.cronExpression,
      params.durationDays,
      params.nextRunAt ?? null,
    ],
  );
  return parseInt(res.rows[0].id, 10);
};

export const updatePayrollSchedule = async (params: {
  id: number;
  enabled?: boolean;
  nextRunAt?: Date;
  lastRunAt?: Date;
}): Promise<void> => {
  if (!getPool()) return;
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (params.enabled !== undefined) {
    updates.push(`enabled = $${paramIdx++}`);
    values.push(params.enabled);
  }
  if (params.nextRunAt !== undefined) {
    updates.push(`next_run_at = $${paramIdx++}`);
    values.push(params.nextRunAt);
  }
  if (params.lastRunAt !== undefined) {
    updates.push(`last_run_at = $${paramIdx++}`);
    values.push(params.lastRunAt);
  }

  if (updates.length === 0) return;

  updates.push(`updated_at = NOW()`);
  values.push(params.id);

  await query(
    `UPDATE payroll_schedules SET ${updates.join(", ")} WHERE id = $${paramIdx}`,
    values,
  );
};

export const deletePayrollSchedule = async (id: number): Promise<void> => {
  if (!getPool()) return;
  await query(`DELETE FROM payroll_schedules WHERE id = $1`, [id]);
};

export const logSchedulerAction = async (params: {
  scheduleId: number;
  action: string;
  status: "success" | "failed" | "skipped";
  streamId?: number;
  errorMessage?: string;
  executionTime?: number;
}): Promise<void> => {
  if (!getPool()) return;
  await query(
    `INSERT INTO scheduler_logs
            (schedule_id, action, status, stream_id, error_message, execution_time)
         VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.scheduleId,
      params.action,
      params.status,
      params.streamId ?? null,
      params.errorMessage ?? null,
      params.executionTime ?? null,
    ],
  );
};

export const getSchedulerLogs = async (
  scheduleId?: number,
  limit = 100,
): Promise<SchedulerLog[]> => {
  if (!getPool()) return [];
  if (scheduleId) {
    const res = await query<SchedulerLog>(
      `SELECT * FROM scheduler_logs WHERE schedule_id = $1
             ORDER BY created_at DESC LIMIT $2`,
      [scheduleId, limit],
    );
    return res.rows;
  }
  const res = await query<SchedulerLog>(
    `SELECT * FROM scheduler_logs ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return res.rows;
};

// ─── Treasury monitoring queries ──────────────────────────────────────────────

export interface TreasuryBalance {
  employer: string;
  balance: string;
  token: string;
  updated_at: Date;
}

export interface TreasuryLiability {
  employer: string;
  liabilities: string;
}

export interface MonitorLogEntry {
  id: number;
  employer: string;
  balance: string;
  liabilities: string;
  runway_days: number | null;
  alert_sent: boolean;
  created_at: Date;
}

export interface WorkerNotificationSettingsRecord {
  worker: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  cliff_unlock_alerts: boolean;
  stream_ending_alerts: boolean;
  low_runway_alerts: boolean;
  created_at: Date;
  updated_at: Date;
}

export const getTreasuryBalances = async (): Promise<TreasuryBalance[]> => {
  if (!getPool()) return [];
  const res = await query<TreasuryBalance>(
    `SELECT employer, balance, token, updated_at FROM treasury_balances`,
  );
  return res.rows;
};

export const getTreasuryBalanceByEmployer = async (
  employer: string,
): Promise<TreasuryBalance | null> => {
  if (!getPool()) return null;
  const res = await query<TreasuryBalance>(
    `SELECT employer, balance, token, updated_at
      FROM treasury_balances
      WHERE employer = $1`,
    [employer],
  );
  return res.rows[0] ?? null;
};

export const getEmployerById = async (
  employerId: string,
): Promise<EmployerRecord | null> => {
  if (!getPool()) return null;
  const res = await query<EmployerRecord>(
    `SELECT * FROM employers WHERE employer_id = $1`,
    [employerId],
  );
  return res.rows[0] ?? null;
};

export const upsertEmployerVerification = async (params: {
  employerId: string;
  businessName: string;
  registrationNumber: string;
  countryCode: string;
  contactName?: string;
  contactEmail?: string;
  verificationStatus: EmployerVerificationStatus;
  verificationReason: string | null;
  verificationMetadata: Record<string, unknown>;
}): Promise<EmployerRecord> => {
  if (!getPool()) {
    throw new Error("Database not configured");
  }

  const res = await query<EmployerRecord>(
    `INSERT INTO employers (
        employer_id,
        business_name,
        registration_number,
        country_code,
        contact_name,
        contact_email,
        verification_status,
        verification_reason,
        verification_metadata,
        verified_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
      ON CONFLICT (employer_id) DO UPDATE
        SET business_name = EXCLUDED.business_name,
            registration_number = EXCLUDED.registration_number,
            country_code = EXCLUDED.country_code,
            contact_name = EXCLUDED.contact_name,
            contact_email = EXCLUDED.contact_email,
            verification_status = EXCLUDED.verification_status,
            verification_reason = EXCLUDED.verification_reason,
            verification_metadata = EXCLUDED.verification_metadata,
            verified_at = EXCLUDED.verified_at,
            updated_at = NOW()
      RETURNING *`,
    [
      params.employerId,
      params.businessName,
      params.registrationNumber,
      params.countryCode,
      params.contactName ?? null,
      params.contactEmail ?? null,
      params.verificationStatus,
      params.verificationReason,
      params.verificationMetadata,
      params.verificationStatus === "verified" ? new Date() : null,
    ],
  );

  return res.rows[0];
};

export const getActiveLiabilities = async (): Promise<TreasuryLiability[]> => {
  if (!getPool()) return [];
  const res = await query<TreasuryLiability>(
    `SELECT 
            employer,
            SUM(total_amount - withdrawn_amount) AS liabilities
         FROM payroll_streams
         WHERE status = 'active'
         GROUP BY employer`,
  );
  return res.rows;
};

export const logMonitorEvent = async (params: {
  employer: string;
  balance: number;
  liabilities: number;
  runwayDays: number | null;
  alertSent: boolean;
}): Promise<void> => {
  if (!getPool()) return;
  await query(
    `INSERT INTO treasury_monitor_log
            (employer, balance, liabilities, runway_days, alert_sent)
         VALUES ($1, $2, $3, $4, $5)`,
    [
      params.employer,
      params.balance,
      params.liabilities,
      params.runwayDays,
      params.alertSent,
    ],
  );
};

export const updateTreasuryBalance = async (
  employer: string,
  balance: bigint,
  token = "USDC",
): Promise<void> => {
  if (!getPool()) return;
  await query(
    `INSERT INTO treasury_balances (employer, balance, token, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (employer) DO UPDATE
           SET balance = EXCLUDED.balance,
               token = EXCLUDED.token,
               updated_at = NOW()`,
    [employer, balance.toString(), token],
  );
  globalCache.invalidateByPrefix(`analytics:payroll:${employer}:`);
};

export const getMonitorLogs = async (
  employer?: string,
  limit = 100,
): Promise<MonitorLogEntry[]> => {
  if (!getPool()) return [];
  if (employer) {
    const res = await query<MonitorLogEntry>(
      `SELECT * FROM treasury_monitor_log WHERE employer = $1
             ORDER BY created_at DESC LIMIT $2`,
      [employer, limit],
    );
    return res.rows;
  }
  const res = await query<MonitorLogEntry>(
    `SELECT * FROM treasury_monitor_log ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return res.rows;
};

export const getWorkerNotificationSettings = async (
  worker: string,
): Promise<WorkerNotificationSettingsRecord | null> => {
  if (!getPool()) return null;
  const res = await query<WorkerNotificationSettingsRecord>(
    `SELECT * FROM worker_notification_settings WHERE worker = $1`,
    [worker],
  );
  return res.rows[0] ?? null;
};

export const upsertWorkerNotificationSettings = async (params: {
  worker: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  cliffUnlockAlerts: boolean;
  streamEndingAlerts: boolean;
  lowRunwayAlerts: boolean;
}): Promise<void> => {
  if (!getPool()) return;
  await query(
    `INSERT INTO worker_notification_settings
      (worker, email_enabled, in_app_enabled, cliff_unlock_alerts, stream_ending_alerts, low_runway_alerts, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (worker)
     DO UPDATE SET
       email_enabled = EXCLUDED.email_enabled,
       in_app_enabled = EXCLUDED.in_app_enabled,
       cliff_unlock_alerts = EXCLUDED.cliff_unlock_alerts,
       stream_ending_alerts = EXCLUDED.stream_ending_alerts,
       low_runway_alerts = EXCLUDED.low_runway_alerts,
       updated_at = NOW()`,
    [
      params.worker,
      params.emailEnabled,
      params.inAppEnabled,
      params.cliffUnlockAlerts,
      params.streamEndingAlerts,
      params.lowRunwayAlerts,
    ],
  );
};

// ─── Webhook outbound delivery logs ──────────────────────────────────────────

export const createWebhookOutboundEvent = async (params: {
  id: string;
  ownerId: string;
  subscriptionId: string;
  url: string;
  eventType: string;
  requestPayload: unknown;
}): Promise<void> => {
  if (!getPool()) return;
  await query(
    `INSERT INTO webhook_outbound_events
        (id, owner_id, subscription_id, url, event_type, request_payload, status)
      VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
    [
      params.id,
      params.ownerId,
      params.subscriptionId,
      params.url,
      params.eventType,
      params.requestPayload,
    ],
  );
};

export const insertWebhookOutboundAttempt = async (params: {
  eventId: string;
  attemptNumber: number;
  responseCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  durationMs: number | null;
}): Promise<void> => {
  if (!getPool()) return;
  await query(
    `INSERT INTO webhook_outbound_attempts
        (event_id, attempt_number, response_code, response_body, error_message, duration_ms)
      VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      params.eventId,
      params.attemptNumber,
      params.responseCode,
      params.responseBody,
      params.errorMessage,
      params.durationMs,
    ],
  );
};

export const updateWebhookOutboundEventAfterAttempt = async (params: {
  eventId: string;
  status: "pending" | "success" | "failed";
  attemptCount: number;
  lastResponseCode: number | null;
  lastError: string | null;
  nextRetryAt: Date | null;
}): Promise<void> => {
  if (!getPool()) return;
  await query(
    `UPDATE webhook_outbound_events
        SET status = $2,
            attempt_count = $3,
            last_response_code = $4,
            last_error = $5,
            next_retry_at = $6,
            last_attempt_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [
      params.eventId,
      params.status,
      params.attemptCount,
      params.lastResponseCode,
      params.lastError,
      params.nextRetryAt,
    ],
  );
};

export const getWebhookOutboundEventById = async (
  eventId: string,
): Promise<WebhookOutboundEventRecord | null> => {
  if (!getPool()) return null;
  const res = await query<WebhookOutboundEventRecord>(
    `SELECT * FROM webhook_outbound_events WHERE id = $1`,
    [eventId],
  );
  return res.rows[0] ?? null;
};

export const getWebhookOutboundEventByIdForOwner = async (params: {
  eventId: string;
  ownerId: string;
}): Promise<WebhookOutboundEventRecord | null> => {
  if (!getPool()) return null;
  const res = await query<WebhookOutboundEventRecord>(
    `SELECT * FROM webhook_outbound_events WHERE id = $1 AND owner_id = $2`,
    [params.eventId, params.ownerId],
  );
  return res.rows[0] ?? null;
};

export const listDueWebhookOutboundEvents = async (params: {
  limit: number;
}): Promise<WebhookOutboundEventRecord[]> => {
  if (!getPool()) return [];
  const res = await query<WebhookOutboundEventRecord>(
    `SELECT *
      FROM webhook_outbound_events
      WHERE status = 'pending'
        AND next_retry_at IS NOT NULL
        AND next_retry_at <= NOW()
      ORDER BY next_retry_at ASC
      LIMIT $1`,
    [params.limit],
  );
  return res.rows;
};

export const listWebhookOutboundEventsByOwner = async (params: {
  ownerId: string;
  limit: number;
  offset: number;
}): Promise<WebhookOutboundEventRecord[]> => {
  if (!getPool()) return [];
  const res = await query<WebhookOutboundEventRecord>(
    `SELECT *
      FROM webhook_outbound_events
      WHERE owner_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
    [params.ownerId, params.limit, params.offset],
  );
  return res.rows;
};

// ─── Stream read by ID ────────────────────────────────────────────────────────

export const getStreamById = async (
  streamId: number,
  includeSoftDeleted = false,
): Promise<StreamRecord | null> => {
  if (!getPool()) return null;
  const deletedClause = includeSoftDeleted ? "" : "AND deleted_at IS NULL";
  const res = await query<StreamRecord>(
    `SELECT * FROM payroll_streams WHERE stream_id = $1 ${deletedClause}`,
    [streamId],
  );
  return res.rows[0] ?? null;
};

// ─── Soft-delete helpers (issue #614) ────────────────────────────────────────

export interface StreamAuditEntry {
  id: number;
  stream_id: number;
  changed_by: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

/**
 * Soft-delete a stream by setting `deleted_at`, `deleted_by`, and
 * `cancel_reason`.  Also appends an entry to `stream_audit_log`.
 * Returns `false` when the stream does not exist or is already deleted.
 */
export const softDeleteStream = async (params: {
  streamId: number;
  deletedBy: string;
  cancelReason?: string;
}): Promise<boolean> => {
  if (!getPool()) throw new Error("Database pool is not initialized");

  const existing = await query<{ status: string; stream_id: string }>(
    `SELECT stream_id, status FROM payroll_streams
     WHERE stream_id = $1 AND deleted_at IS NULL`,
    [params.streamId],
  );

  if (existing.rows.length === 0) return false;

  const oldStatus = existing.rows[0].status;

  await query(
    `UPDATE payroll_streams
     SET deleted_at    = NOW(),
         deleted_by    = $2,
         cancel_reason = $3,
         status        = 'cancelled',
         updated_at    = NOW()
     WHERE stream_id = $1 AND deleted_at IS NULL`,
    [params.streamId, params.deletedBy, params.cancelReason ?? null],
  );

  // Record the cancellation in the immutable audit log
  await query(
    `INSERT INTO stream_audit_log
       (stream_id, changed_by, action, old_status, new_status, reason)
     VALUES ($1, $2, 'cancelled', $3, 'cancelled', $4)`,
    [params.streamId, params.deletedBy, oldStatus, params.cancelReason ?? null],
  );

  // Invalidate analytics cache
  globalCache.del("analytics:summary");
  globalCache.invalidateByPrefix("analytics:trends:");

  return true;
};

/**
 * Retrieve the full audit trail for a single stream.
 */
export const getStreamAuditLog = async (
  streamId: number,
): Promise<StreamAuditEntry[]> => {
  if (!getPool()) return [];
  const res = await query<StreamAuditEntry>(
    `SELECT * FROM stream_audit_log WHERE stream_id = $1 ORDER BY created_at ASC`,
    [streamId],
  );
  return res.rows;
};

// ─── Payroll proof queries ────────────────────────────────────────────────────

export const insertPayrollProof = async (params: {
  streamId: number;
  cid: string;
  ipfsUrl: string;
  gatewayUrl: string;
  proofJson: unknown;
}): Promise<void> => {
  if (!getPool()) return;
  await query(
    `INSERT INTO payroll_proofs (stream_id, cid, ipfs_url, gateway_url, proof_json)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (stream_id) DO NOTHING`,
    [
      params.streamId,
      params.cid,
      params.ipfsUrl,
      params.gatewayUrl,
      JSON.stringify(params.proofJson),
    ],
  );
};

export const getProofByStreamId = async (
  streamId: number,
): Promise<PayrollProofRecord | null> => {
  if (!getPool()) return null;
  const res = await query<PayrollProofRecord>(
    `SELECT * FROM payroll_proofs WHERE stream_id = $1`,
    [streamId],
  );
  return res.rows[0] ?? null;
};

// ─── Dashboard analytics queries ─────────────────────────────────────────────

export interface VolumePoint {
  bucket: string; // ISO date string (day or week)
  xlm_volume: string;
  usdc_volume: string;
  total_volume: string;
  stream_count: number;
}

export interface TopWorker {
  worker: string;
  total_earned: string;
  stream_count: number;
  last_withdrawal_at: string | null;
}

export interface StreamCreationPoint {
  bucket: string;
  streams_created: number;
}

export interface WithdrawalFrequencyPoint {
  bucket: string;
  withdrawal_count: number;
  total_withdrawn: string;
}

/**
 * Total XLM/USDC streamed per day or week.
 * Uses vault_events for token-level breakdown; falls back to payroll_streams volume.
 */
export const getVolumeOverTime = async (
  granularity: "daily" | "weekly" = "daily",
  days = 30,
): Promise<VolumePoint[]> => {
  if (!getPool()) return [];
  const trunc = granularity === "weekly" ? "week" : "day";
  const res = await query<VolumePoint>(
    `SELECT
        date_trunc('${trunc}', created_at)::date::text          AS bucket,
        COALESCE(SUM(total_amount) FILTER (
          WHERE LOWER(worker) LIKE '%xlm%' OR LOWER(employer) LIKE '%xlm%'
        ), 0)                                                    AS xlm_volume,
        COALESCE(SUM(total_amount) FILTER (
          WHERE LOWER(worker) NOT LIKE '%xlm%' AND LOWER(employer) NOT LIKE '%xlm%'
        ), 0)                                                    AS usdc_volume,
        COALESCE(SUM(total_amount), 0)                           AS total_volume,
        COUNT(*)                                                 AS stream_count
      FROM payroll_streams
      WHERE deleted_at IS NULL
        AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY 1
      ORDER BY 1 ASC`,
  );
  return res.rows.map((r) => ({
    ...r,
    stream_count: Number(r.stream_count),
  }));
};

/**
 * Top workers ranked by total withdrawn amount.
 */
export const getTopWorkersByEarnings = async (
  limit = 10,
): Promise<TopWorker[]> => {
  if (!getPool()) return [];
  const res = await query<TopWorker>(
    `SELECT
        w.worker,
        COALESCE(SUM(w.amount), 0)                              AS total_earned,
        COUNT(DISTINCT w.stream_id)                             AS stream_count,
        MAX(w.created_at)::text                                 AS last_withdrawal_at
      FROM withdrawals w
      GROUP BY w.worker
      ORDER BY total_earned DESC
      LIMIT $1`,
    [limit],
  );
  return res.rows.map((r) => ({
    ...r,
    stream_count: Number(r.stream_count),
  }));
};

/**
 * Stream creation rate per day or week.
 */
export const getStreamCreationRate = async (
  granularity: "daily" | "weekly" = "daily",
  days = 30,
): Promise<StreamCreationPoint[]> => {
  if (!getPool()) return [];
  const trunc = granularity === "weekly" ? "week" : "day";
  const res = await query<StreamCreationPoint>(
    `SELECT
        date_trunc('${trunc}', created_at)::date::text  AS bucket,
        COUNT(*)                                         AS streams_created
      FROM payroll_streams
      WHERE deleted_at IS NULL
        AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY 1
      ORDER BY 1 ASC`,
  );
  return res.rows.map((r) => ({
    ...r,
    streams_created: Number(r.streams_created),
  }));
};

/**
 * Withdrawal frequency per day or week.
 */
export const getWithdrawalFrequency = async (
  granularity: "daily" | "weekly" = "daily",
  days = 30,
): Promise<WithdrawalFrequencyPoint[]> => {
  if (!getPool()) return [];
  const trunc = granularity === "weekly" ? "week" : "day";
  const res = await query<WithdrawalFrequencyPoint>(
    `SELECT
        date_trunc('${trunc}', created_at)::date::text  AS bucket,
        COUNT(*)                                         AS withdrawal_count,
        COALESCE(SUM(amount), 0)                         AS total_withdrawn
      FROM withdrawals
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY 1
      ORDER BY 1 ASC`,
  );
  return res.rows.map((r) => ({
    ...r,
    withdrawal_count: Number(r.withdrawal_count),
  }));
};

// ─── Employer Spend Analytics ─────────────────────────────────────────────────

export const getEmployerSpendBreakdown = async (
  employer: string,
  period: "monthly" | "weekly" | "daily" = "monthly",
): Promise<
  Array<{
    worker: string;
    department?: string;
    project?: string;
    role?: string;
    period_start: string;
    total_spend: number;
  }>
> => {
  if (!getPool()) return [];
  const interval =
    period === "monthly" ? "month" : period === "weekly" ? "week" : "day";
  const res = await query(
    `SELECT
       s.worker,
       s.metadata->>'department' as department,
       s.metadata->>'project' as project,
       s.metadata->>'role' as role,
       DATE_TRUNC('${interval}', TO_TIMESTAMP(s.start_ts))::text as period_start,
       SUM(s.total_amount::numeric) as total_spend
     FROM payroll_streams s
     WHERE s.employer = $1 AND s.status = 'active'
     GROUP BY s.worker, s.metadata->>'department', s.metadata->>'project', s.metadata->>'role', DATE_TRUNC('${interval}', TO_TIMESTAMP(s.start_ts))
     ORDER BY period_start DESC, total_spend DESC`,
    [employer],
  );
  return res.rows.map((r) => ({
    worker: r.worker,
    department: r.department || undefined,
    project: r.project || undefined,
    role: r.role || undefined,
    period_start: r.period_start,
    total_spend: Number(r.total_spend),
  }));
};

// ─── Payslip Records ──────────────────────────────────────────────────────────

export interface PayslipRecord {
  id: number;
  payslip_id: string;
  worker_address: string;
  period: string;
  signature: string;
  branding_snapshot: any;
  pdf_url: string | null;
  total_gross_amount: string;
  stream_ids: number[];
  generated_at: Date;
}

export interface InsertPayslipRecordParams {
  payslipId: string;
  workerAddress: string;
  period: string;
  signature: string;
  brandingSnapshot: any;
  pdfUrl?: string;
  totalGrossAmount: string;
  streamIds: number[];
}

/**
 * Insert a new payslip record
 * Uses ON CONFLICT to ensure idempotency per worker per period
 */
export const insertPayslipRecord = async (
  params: InsertPayslipRecordParams,
): Promise<PayslipRecord> => {
  const pool = getPool();
  if (!pool) throw new Error("Database pool not initialized");

  const res = await query<PayslipRecord>(
    `INSERT INTO payslip_records (
      payslip_id,
      worker_address,
      period,
      signature,
      branding_snapshot,
      pdf_url,
      total_gross_amount,
      stream_ids
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (worker_address, period) 
    DO UPDATE SET
      signature = EXCLUDED.signature,
      branding_snapshot = EXCLUDED.branding_snapshot,
      pdf_url = EXCLUDED.pdf_url,
      total_gross_amount = EXCLUDED.total_gross_amount,
      stream_ids = EXCLUDED.stream_ids,
      generated_at = NOW()
    RETURNING *`,
    [
      params.payslipId,
      params.workerAddress,
      params.period,
      params.signature,
      JSON.stringify(params.brandingSnapshot),
      params.pdfUrl || null,
      params.totalGrossAmount,
      params.streamIds,
    ],
  );

  return res.rows[0];
};

/**
 * Get payslip by worker address and period
 * Used for idempotency - check if payslip already exists
 */
export const getPayslipByWorkerAndPeriod = async (
  workerAddress: string,
  period: string,
): Promise<PayslipRecord | null> => {
  const pool = getPool();
  if (!pool) return null;

  const res = await query<PayslipRecord>(
    `SELECT * FROM payslip_records
     WHERE worker_address = $1 AND period = $2`,
    [workerAddress, period],
  );

  return res.rows[0] || null;
};

/**
 * Get payslip by signature
 * Used for signature verification
 */
export const getPayslipBySignature = async (
  signature: string,
): Promise<PayslipRecord | null> => {
  const pool = getPool();
  if (!pool) return null;

  const res = await query<PayslipRecord>(
    `SELECT * FROM payslip_records
     WHERE signature = $1`,
    [signature],
  );

  return res.rows[0] || null;
};

/**
 * Query payslip records with filters
 */
export interface QueryPayslipRecordsParams {
  workerAddress?: string;
  period?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export const queryPayslipRecords = async (
  params: QueryPayslipRecordsParams,
): Promise<PayslipRecord[]> => {
  const pool = getPool();
  if (!pool) return [];

  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (params.workerAddress) {
    conditions.push(`worker_address = $${paramIndex++}`);
    values.push(params.workerAddress);
  }

  if (params.period) {
    conditions.push(`period = $${paramIndex++}`);
    values.push(params.period);
  }

  if (params.startDate) {
    conditions.push(`generated_at >= $${paramIndex++}`);
    values.push(params.startDate);
  }

  if (params.endDate) {
    conditions.push(`generated_at <= $${paramIndex++}`);
    values.push(params.endDate);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = params.limit || 50;
  const offset = params.offset || 0;

  const res = await query<PayslipRecord>(
    `SELECT * FROM payslip_records
     ${whereClause}
     ORDER BY generated_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset],
  );

  return res.rows;
};

/**
 * Get all payslips for a worker
 */
export const getPayslipsByWorker = async (
  workerAddress: string,
  limit = 50,
  offset = 0,
): Promise<PayslipRecord[]> => {
  return queryPayslipRecords({ workerAddress, limit, offset });
};

// ─── Employer Branding ────────────────────────────────────────────────────────

export interface EmployerBrandingRecord {
  id: number;
  employer_address: string;
  logo_url: string | null;
  logo_metadata: any;
  primary_color: string;
  secondary_color: string;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertEmployerBrandingParams {
  employerAddress: string;
  logoUrl?: string;
  logoMetadata?: any;
  primaryColor?: string;
  secondaryColor?: string;
}

/**
 * Upsert employer branding settings
 */
export const upsertEmployerBranding = async (
  params: UpsertEmployerBrandingParams,
): Promise<EmployerBrandingRecord> => {
  const pool = getPool();
  if (!pool) throw new Error("Database pool not initialized");

  const updates: string[] = [];
  const values: any[] = [params.employerAddress];
  let paramIndex = 2;

  if (params.logoUrl !== undefined) {
    updates.push(`logo_url = $${paramIndex++}`);
    values.push(params.logoUrl);
  }

  if (params.logoMetadata !== undefined) {
    updates.push(`logo_metadata = $${paramIndex++}`);
    values.push(JSON.stringify(params.logoMetadata));
  }

  if (params.primaryColor !== undefined) {
    updates.push(`primary_color = $${paramIndex++}`);
    values.push(params.primaryColor);
  }

  if (params.secondaryColor !== undefined) {
    updates.push(`secondary_color = $${paramIndex++}`);
    values.push(params.secondaryColor);
  }

  updates.push(`updated_at = NOW()`);

  const setClause = updates.join(", ");

  const res = await query<EmployerBrandingRecord>(
    `INSERT INTO employer_branding (
      employer_address,
      logo_url,
      logo_metadata,
      primary_color,
      secondary_color
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (employer_address)
    DO UPDATE SET ${setClause}
    RETURNING *`,
    [
      params.employerAddress,
      params.logoUrl || null,
      params.logoMetadata ? JSON.stringify(params.logoMetadata) : null,
      params.primaryColor || "#2563eb",
      params.secondaryColor || "#64748b",
    ],
  );

  return res.rows[0];
};

/**
 * Get employer branding by address
 */
export const getEmployerBranding = async (
  employerAddress: string,
): Promise<EmployerBrandingRecord | null> => {
  const pool = getPool();
  if (!pool) return null;

  const res = await query<EmployerBrandingRecord>(
    `SELECT * FROM employer_branding
     WHERE employer_address = $1`,
    [employerAddress],
  );

  return res.rows[0] || null;
};

/**
 * Delete employer logo (set to null)
 */
export const deleteEmployerLogo = async (
  employerAddress: string,
): Promise<void> => {
  const pool = getPool();
  if (!pool) throw new Error("Database pool not initialized");

  await query(
    `UPDATE employer_branding
     SET logo_url = NULL,
         logo_metadata = NULL,
         updated_at = NOW()
     WHERE employer_address = $1`,
    [employerAddress],
  );
};
