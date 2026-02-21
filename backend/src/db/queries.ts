import { query, getPool } from "./pool";

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
}): Promise<void> => {
  if (!getPool()) return; // DB not configured
  await query(
    `INSERT INTO payroll_streams
           (stream_id, employer, worker, total_amount, withdrawn_amount,
            start_ts, end_ts, status, closed_at, ledger_created, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW())
         ON CONFLICT (stream_id) DO UPDATE
           SET withdrawn_amount = EXCLUDED.withdrawn_amount,
               status           = EXCLUDED.status,
               closed_at        = EXCLUDED.closed_at,
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
    ],
  );
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

export const getStreamsByEmployer = async (
  employer: string,
  status?: string,
  limit = 50,
  offset = 0,
): Promise<StreamRecord[]> => {
  const params: unknown[] = [employer, limit, offset];
  let statusClause = "";
  if (status) {
    params.push(status);
    statusClause = `AND status = $${params.length}`;
  }
  const res = await query<StreamRecord>(
    `SELECT * FROM payroll_streams
         WHERE employer = $1 ${statusClause}
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
): Promise<StreamRecord[]> => {
  const params: unknown[] = [worker, limit, offset];
  let statusClause = "";
  if (status) {
    params.push(status);
    statusClause = `AND status = $${params.length}`;
  }
  const res = await query<StreamRecord>(
    `SELECT * FROM payroll_streams
         WHERE worker = $1 ${statusClause}
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
