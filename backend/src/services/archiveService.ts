import crypto from "crypto";
import { Pool } from "pg";
import { getPool, query } from "../db/pool";
import { initArchivePool } from "../db/archivePool";
import { withAdvisoryLock } from "../utils/lock";
import { metricsManager } from "../metrics";
import {
  logServiceError,
  logServiceInfo,
  logServiceWarn,
} from "../audit/serviceLogger";

interface AuditLogRow {
  id: string;
  timestamp: Date;
  log_level: string;
  message: string;
  action_type: string;
  employer: string | null;
  context: unknown;
  transaction_hash: string | null;
  block_number: number | null;
  error_message: string | null;
  error_code: string | null;
  error_stack: string | null;
  created_at: Date;
}

interface MetricSnapshotRow {
  id: string;
  captured_at: Date;
  metrics_text: string;
  created_at: Date;
}

interface WebhookAttemptArchiveRow {
  id: number;
  attempt_number: number;
  response_code: number | null;
  response_body: string | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: Date;
}

interface WebhookArchiveRow {
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
  attempts: WebhookAttemptArchiveRow[];
}

export interface ArchiveRetentionSummary {
  auditLogsArchived: number;
  metricSnapshotsArchived: number;
  webhookEventsArchived: number;
}

const ARCHIVE_BATCH_SIZE = Number.parseInt(
  process.env.ARCHIVE_BATCH_SIZE || "250",
  10,
);
const ARCHIVE_MAX_BATCHES = Number.parseInt(
  process.env.ARCHIVE_MAX_BATCHES_PER_RUN || "20",
  10,
);
const AUDIT_LOG_TTL_MONTHS = Number.parseInt(
  process.env.AUDIT_LOG_TTL_MONTHS || "6",
  10,
);
const METRIC_SNAPSHOT_TTL_MONTHS = Number.parseInt(
  process.env.METRIC_SNAPSHOT_TTL_MONTHS || "2",
  10,
);
const WEBHOOK_EVENT_TTL_MONTHS = Number.parseInt(
  process.env.WEBHOOK_EVENT_TTL_MONTHS || "3",
  10,
);
const PII_SALT =
  process.env.ARCHIVE_PII_SALT ||
  process.env.VAULT_TOKEN ||
  "quipay-archive-salt";

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const STELLAR_ADDRESS_REGEX = /\bG[A-Z2-7]{55}\b/g;

const PII_FIELD_NAMES = new Set([
  "address",
  "email",
  "employer",
  "owner_id",
  "ownerid",
  "proposer",
  "subscription_id",
  "subscriptionid",
  "url",
  "user_id",
  "userid",
  "wallet",
  "walletaddress",
  "worker",
]);

const safeBatchSize =
  Number.isFinite(ARCHIVE_BATCH_SIZE) && ARCHIVE_BATCH_SIZE > 0
    ? ARCHIVE_BATCH_SIZE
    : 250;
const safeMaxBatches =
  Number.isFinite(ARCHIVE_MAX_BATCHES) && ARCHIVE_MAX_BATCHES > 0
    ? ARCHIVE_MAX_BATCHES
    : 20;

const subtractMonths = (months: number) => {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
};

class ArchivePiiAnonymizer {
  constructor(private readonly salt: string) {}

  fingerprint(kind: string, value: string): string {
    return crypto
      .createHmac("sha256", this.salt)
      .update(`${kind}:${value}`)
      .digest("hex")
      .slice(0, 24);
  }

  pseudonymize(kind: string, value: string): string {
    return `${kind}_${this.fingerprint(kind, value)}`;
  }

  anonymizeValue(value: unknown, key?: string): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.anonymizeValue(item, key));
    }

    if (typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(
          ([entryKey, entryValue]) => [
            entryKey,
            this.anonymizeValue(entryValue, entryKey),
          ],
        ),
      );
    }

    if (typeof value !== "string") {
      return value;
    }

    if (key && PII_FIELD_NAMES.has(key.toLowerCase())) {
      return this.pseudonymize(key.toLowerCase(), value);
    }

    return value
      .replace(EMAIL_REGEX, (match) => this.pseudonymize("email", match))
      .replace(STELLAR_ADDRESS_REGEX, (match) =>
        this.pseudonymize("stellar", match),
      );
  }
}

const anonymizer = new ArchivePiiAnonymizer(PII_SALT);

const listExpiredAuditLogs = async (cutoff: Date): Promise<AuditLogRow[]> => {
  const result = await query<AuditLogRow>(
    `
      SELECT
        id,
        timestamp,
        log_level,
        message,
        action_type,
        employer,
        context,
        transaction_hash,
        block_number,
        error_message,
        error_code,
        error_stack,
        created_at
      FROM audit_logs
      WHERE timestamp < $1
      ORDER BY timestamp ASC
      LIMIT $2
    `,
    [cutoff, safeBatchSize],
  );

  return result.rows;
};

const listExpiredMetricSnapshots = async (
  cutoff: Date,
): Promise<MetricSnapshotRow[]> => {
  const result = await query<MetricSnapshotRow>(
    `
      SELECT id, captured_at, metrics_text, created_at
      FROM metric_snapshots
      WHERE captured_at < $1
      ORDER BY captured_at ASC
      LIMIT $2
    `,
    [cutoff, safeBatchSize],
  );

  return result.rows;
};

const listExpiredWebhookEvents = async (
  cutoff: Date,
): Promise<WebhookArchiveRow[]> => {
  const result = await query<WebhookArchiveRow>(
    `
      SELECT
        e.id,
        e.owner_id,
        e.subscription_id,
        e.url,
        e.event_type,
        e.request_payload,
        e.status,
        e.attempt_count,
        e.last_response_code,
        e.last_error,
        e.next_retry_at,
        e.last_attempt_at,
        e.created_at,
        e.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', a.id,
              'attempt_number', a.attempt_number,
              'response_code', a.response_code,
              'response_body', a.response_body,
              'error_message', a.error_message,
              'duration_ms', a.duration_ms,
              'created_at', a.created_at
            )
            ORDER BY a.attempt_number ASC
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'
        ) AS attempts
      FROM webhook_outbound_events e
      LEFT JOIN webhook_outbound_attempts a ON a.event_id = e.id
      WHERE e.status IN ('success', 'failed')
        AND e.created_at < $1
      GROUP BY e.id
      ORDER BY e.created_at ASC
      LIMIT $2
    `,
    [cutoff, safeBatchSize],
  );

  return result.rows;
};

const archiveAuditLogs = async (
  archivePool: Pool,
  rows: AuditLogRow[],
): Promise<number> => {
  if (rows.length === 0) return 0;

  const client = await archivePool.connect();

  try {
    await client.query("BEGIN");

    for (const row of rows) {
      await client.query(
        `
          INSERT INTO audit_logs_archive (
            original_id,
            timestamp,
            log_level,
            message,
            action_type,
            employer_hash,
            context,
            transaction_hash,
            block_number,
            error_message,
            error_code,
            error_stack,
            source_created_at,
            anonymized
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true
          )
          ON CONFLICT (original_id) DO NOTHING
        `,
        [
          row.id,
          row.timestamp,
          row.log_level,
          row.message,
          row.action_type,
          row.employer
            ? anonymizer.pseudonymize("employer", row.employer)
            : null,
          JSON.stringify(anonymizer.anonymizeValue(row.context)),
          row.transaction_hash,
          row.block_number,
          row.error_message,
          row.error_code,
          row.error_stack,
          row.created_at,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await query(`DELETE FROM audit_logs WHERE id = ANY($1::bigint[])`, [
    rows.map((row) => row.id),
  ]);

  return rows.length;
};

const archiveMetricSnapshots = async (
  archivePool: Pool,
  rows: MetricSnapshotRow[],
): Promise<number> => {
  if (rows.length === 0) return 0;

  const client = await archivePool.connect();

  try {
    await client.query("BEGIN");

    for (const row of rows) {
      await client.query(
        `
          INSERT INTO metric_snapshots_archive (
            original_id,
            captured_at,
            metrics_text,
            source_created_at
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (original_id) DO NOTHING
        `,
        [row.id, row.captured_at, row.metrics_text, row.created_at],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await query(`DELETE FROM metric_snapshots WHERE id = ANY($1::bigint[])`, [
    rows.map((row) => row.id),
  ]);

  return rows.length;
};

const archiveWebhookEvents = async (
  archivePool: Pool,
  rows: WebhookArchiveRow[],
): Promise<number> => {
  if (rows.length === 0) return 0;

  const client = await archivePool.connect();

  try {
    await client.query("BEGIN");

    for (const row of rows) {
      let destinationHost: string | null = null;
      try {
        destinationHost = new URL(row.url).host;
      } catch {
        destinationHost = null;
      }

      await client.query(
        `
          INSERT INTO webhook_outbound_events_archive (
            original_id,
            owner_hash,
            subscription_hash,
            destination_host,
            destination_fingerprint,
            event_type,
            request_payload,
            attempts,
            status,
            attempt_count,
            last_response_code,
            last_error,
            next_retry_at,
            last_attempt_at,
            source_created_at,
            source_updated_at,
            anonymized
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, true
          )
          ON CONFLICT (original_id) DO NOTHING
        `,
        [
          row.id,
          anonymizer.pseudonymize("owner", row.owner_id),
          anonymizer.pseudonymize("subscription", row.subscription_id),
          destinationHost,
          anonymizer.pseudonymize("webhook_url", row.url),
          row.event_type,
          JSON.stringify(anonymizer.anonymizeValue(row.request_payload)),
          JSON.stringify(anonymizer.anonymizeValue(row.attempts)),
          row.status,
          row.attempt_count,
          row.last_response_code,
          row.last_error,
          row.next_retry_at,
          row.last_attempt_at,
          row.created_at,
          row.updated_at,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await query(
    `DELETE FROM webhook_outbound_events WHERE id = ANY($1::uuid[])`,
    [rows.map((row) => row.id)],
  );

  return rows.length;
};

const runSingleArchiveBatch = async (
  archivePool: Pool,
): Promise<ArchiveRetentionSummary> => {
  const auditCutoff = subtractMonths(AUDIT_LOG_TTL_MONTHS);
  const metricCutoff = subtractMonths(METRIC_SNAPSHOT_TTL_MONTHS);
  const webhookCutoff = subtractMonths(WEBHOOK_EVENT_TTL_MONTHS);

  const [auditRows, metricRows, webhookRows] = await Promise.all([
    listExpiredAuditLogs(auditCutoff),
    listExpiredMetricSnapshots(metricCutoff),
    listExpiredWebhookEvents(webhookCutoff),
  ]);

  const [auditLogsArchived, metricSnapshotsArchived, webhookEventsArchived] =
    await Promise.all([
      archiveAuditLogs(archivePool, auditRows),
      archiveMetricSnapshots(archivePool, metricRows),
      archiveWebhookEvents(archivePool, webhookRows),
    ]);

  return {
    auditLogsArchived,
    metricSnapshotsArchived,
    webhookEventsArchived,
  };
};

export const runArchiveRetentionCycle =
  async (): Promise<ArchiveRetentionSummary> => {
    if (!getPool()) {
      return {
        auditLogsArchived: 0,
        metricSnapshotsArchived: 0,
        webhookEventsArchived: 0,
      };
    }

    const archivePool = await initArchivePool();
    if (!archivePool) {
      await logServiceWarn(
        "ArchiveService",
        "Archive retention skipped because ARCHIVE_DATABASE_URL is not configured",
      );
      return {
        auditLogsArchived: 0,
        metricSnapshotsArchived: 0,
        webhookEventsArchived: 0,
      };
    }

    const summary: ArchiveRetentionSummary = {
      auditLogsArchived: 0,
      metricSnapshotsArchived: 0,
      webhookEventsArchived: 0,
    };

    await withAdvisoryLock(
      616161,
      async () => {
        let batch = 0;
        while (batch < safeMaxBatches) {
          const result = await runSingleArchiveBatch(archivePool);
          summary.auditLogsArchived += result.auditLogsArchived;
          summary.metricSnapshotsArchived += result.metricSnapshotsArchived;
          summary.webhookEventsArchived += result.webhookEventsArchived;

          if (
            result.auditLogsArchived < safeBatchSize &&
            result.metricSnapshotsArchived < safeBatchSize &&
            result.webhookEventsArchived < safeBatchSize
          ) {
            break;
          }

          batch += 1;
        }
      },
      "archive-retention-cycle",
    );

    await logServiceInfo(
      "ArchiveService",
      "Archive retention cycle completed",
      {
        audit_logs_archived: summary.auditLogsArchived,
        metric_snapshots_archived: summary.metricSnapshotsArchived,
        webhook_events_archived: summary.webhookEventsArchived,
      },
    );

    return summary;
  };

export const captureMetricSnapshot = async (): Promise<void> => {
  if (!getPool()) return;

  const snapshot = await metricsManager.snapshot();
  await query(
    `
      INSERT INTO metric_snapshots (captured_at, metrics_text)
      VALUES (NOW(), $1)
    `,
    [snapshot],
  );
};

export const runMetricSnapshotCycle = async (): Promise<void> => {
  try {
    await captureMetricSnapshot();
    await logServiceInfo(
      "ArchiveService",
      "Captured raw metrics snapshot for retention policy",
    );
  } catch (error) {
    await logServiceError(
      "ArchiveService",
      "Failed to capture raw metrics snapshot",
      error,
    );
  }
};
