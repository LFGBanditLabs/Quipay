import { Pool, PoolClient } from "pg";

let archivePool: Pool | null = null;

interface ArchivePoolConfig {
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statementTimeoutMillis: number;
  idleInTransactionSessionTimeoutMillis: number;
  applicationName: string;
}

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const resolveArchivePoolConfig = (): ArchivePoolConfig => ({
  max: parsePositiveInt(process.env.ARCHIVE_DB_POOL_MAX, 2),
  idleTimeoutMillis: parsePositiveInt(
    process.env.ARCHIVE_DB_POOL_IDLE_TIMEOUT_MS,
    30_000,
  ),
  connectionTimeoutMillis: parsePositiveInt(
    process.env.ARCHIVE_DB_POOL_CONNECTION_TIMEOUT_MS,
    5_000,
  ),
  statementTimeoutMillis: parsePositiveInt(
    process.env.ARCHIVE_DB_POOL_STATEMENT_TIMEOUT_MS,
    15_000,
  ),
  idleInTransactionSessionTimeoutMillis: parsePositiveInt(
    process.env.ARCHIVE_DB_POOL_IDLE_IN_TRANSACTION_TIMEOUT_MS,
    10_000,
  ),
  applicationName:
    process.env.ARCHIVE_DB_APPLICATION_NAME || "quipay-archive-writer",
});

const applyArchiveSessionSettings = async (
  client: PoolClient,
  config: ArchivePoolConfig,
) => {
  await client.query("SET statement_timeout = $1", [
    config.statementTimeoutMillis,
  ]);
  await client.query("SET idle_in_transaction_session_timeout = $1", [
    config.idleInTransactionSessionTimeoutMillis,
  ]);
  await client.query("SET application_name = $1", [config.applicationName]);
};

const ensureArchiveSchema = async (pool: Pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs_archive (
      original_id BIGINT PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL,
      log_level TEXT NOT NULL,
      message TEXT NOT NULL,
      action_type TEXT NOT NULL,
      employer_hash TEXT,
      context JSONB NOT NULL DEFAULT '{}',
      transaction_hash TEXT,
      block_number BIGINT,
      error_message TEXT,
      error_code TEXT,
      error_stack TEXT,
      source_created_at TIMESTAMPTZ NOT NULL,
      archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      anonymized BOOLEAN NOT NULL DEFAULT true
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS metric_snapshots_archive (
      original_id BIGINT PRIMARY KEY,
      captured_at TIMESTAMPTZ NOT NULL,
      metrics_text TEXT NOT NULL,
      source_created_at TIMESTAMPTZ NOT NULL,
      archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhook_outbound_events_archive (
      original_id UUID PRIMARY KEY,
      owner_hash TEXT NOT NULL,
      subscription_hash TEXT NOT NULL,
      destination_host TEXT,
      destination_fingerprint TEXT NOT NULL,
      event_type TEXT NOT NULL,
      request_payload JSONB NOT NULL,
      attempts JSONB NOT NULL DEFAULT '[]',
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_response_code INTEGER,
      last_error TEXT,
      next_retry_at TIMESTAMPTZ,
      last_attempt_at TIMESTAMPTZ,
      source_created_at TIMESTAMPTZ NOT NULL,
      source_updated_at TIMESTAMPTZ NOT NULL,
      archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      anonymized BOOLEAN NOT NULL DEFAULT true
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_source_created
      ON audit_logs_archive (source_created_at);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_metric_snapshots_archive_captured_at
      ON metric_snapshots_archive (captured_at);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_webhook_events_archive_source_created
      ON webhook_outbound_events_archive (source_created_at);
  `);
};

export const getArchivePool = (): Pool | null => archivePool;

export const initArchivePool = async (): Promise<Pool | null> => {
  const url = process.env.ARCHIVE_DATABASE_URL;
  if (!url) {
    return null;
  }

  if (archivePool) {
    return archivePool;
  }

  const config = resolveArchivePoolConfig();
  archivePool = new Pool({
    connectionString: url,
    max: config.max,
    idleTimeoutMillis: config.idleTimeoutMillis,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    keepAlive: true,
    query_timeout: config.statementTimeoutMillis,
  });

  archivePool.on("connect", (client) => {
    void applyArchiveSessionSettings(client, config).catch((err) => {
      console.error(
        "[ArchiveDB] Failed to apply archive DB session settings:",
        err instanceof Error ? err.message : err,
      );
    });
  });

  archivePool.on("error", (err) => {
    console.error("[ArchiveDB] Unexpected pool error:", err.message);
  });

  await ensureArchiveSchema(archivePool);
  console.log("[ArchiveDB] ✅ Archive pool initialized");

  return archivePool;
};

export const closeArchivePool = async (): Promise<void> => {
  if (!archivePool) return;

  const activePool = archivePool;
  archivePool = null;
  await activePool.end();
  console.log("[ArchiveDB] ✅ Archive pool closed");
};
