import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import {
  DbPoolMetricSnapshot,
  setDbPoolMetricsProvider,
} from "../metrics";

let pool: Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;
let resolvedPoolConfig: ResolvedPoolConfig | null = null;

interface ResolvedPoolConfig {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  maxUses: number;
  statementTimeoutMillis: number;
  idleInTransactionSessionTimeoutMillis: number;
  applicationName: string;
}

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseNonNegativeInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const resolvePoolConfig = (): ResolvedPoolConfig => {
  const databaseConnectionLimit = parsePositiveInt(
    process.env.PGPOOL_DATABASE_CONNECTION_LIMIT,
    50,
  );
  const appInstances = parsePositiveInt(process.env.PGPOOL_APP_INSTANCES, 1);
  const reservedConnections = parseNonNegativeInt(
    process.env.PGPOOL_RESERVED_CONNECTIONS,
    5,
  );
  const derivedMax = Math.max(
    4,
    Math.floor(
      Math.max(1, databaseConnectionLimit - reservedConnections) / appInstances,
    ),
  );

  const max = parsePositiveInt(process.env.PGPOOL_MAX, derivedMax);
  const min = Math.min(parseNonNegativeInt(process.env.PGPOOL_MIN, 2), max);

  return {
    min,
    max,
    idleTimeoutMillis: parsePositiveInt(
      process.env.PGPOOL_IDLE_TIMEOUT_MS,
      30_000,
    ),
    connectionTimeoutMillis: parsePositiveInt(
      process.env.PGPOOL_CONNECTION_TIMEOUT_MS,
      5_000,
    ),
    maxUses: parsePositiveInt(process.env.PGPOOL_MAX_USES, 7_500),
    statementTimeoutMillis: parsePositiveInt(
      process.env.PGPOOL_STATEMENT_TIMEOUT_MS,
      15_000,
    ),
    idleInTransactionSessionTimeoutMillis: parsePositiveInt(
      process.env.PGPOOL_IDLE_IN_TRANSACTION_TIMEOUT_MS,
      10_000,
    ),
    applicationName:
      process.env.PGAPPNAME || process.env.PGPOOL_APPLICATION_NAME || "quipay",
  };
};

const applySessionTimeouts = async (
  poolClient: PoolClient,
  config: ResolvedPoolConfig,
) => {
  await poolClient.query("SET statement_timeout = $1", [
    config.statementTimeoutMillis,
  ]);
  await poolClient.query("SET idle_in_transaction_session_timeout = $1", [
    config.idleInTransactionSessionTimeoutMillis,
  ]);
  await poolClient.query("SET application_name = $1", [
    config.applicationName,
  ]);
};

/**
 * Returns the singleton pool (null when DATABASE_URL is not configured).
 */
export const getPool = (): Pool | null => pool;

/**
 * Returns the Drizzle database instance.
 */
export const getDb = (): NodePgDatabase<typeof schema> | null => db;

export const getPoolStats = (): DbPoolMetricSnapshot | null => {
  if (!pool || !resolvedPoolConfig) {
    return null;
  }

  const total = pool.totalCount;
  const idle = pool.idleCount;
  const waiting = pool.waitingCount;

  return {
    total,
    idle,
    waiting,
    active: Math.max(total - idle, 0),
    max: resolvedPoolConfig.max,
    min: resolvedPoolConfig.min,
  };
};

/**
 * Initializes the connection pool and ensures the schema exists.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export const initDb = async (): Promise<void> => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn(
      "[DB] ⚠️  DATABASE_URL is not set. Analytics caching is disabled.",
    );
    return;
  }

  if (pool) return; // already initialized

  resolvedPoolConfig = resolvePoolConfig();
  pool = new Pool({
    connectionString: url,
    min: resolvedPoolConfig.min,
    max: resolvedPoolConfig.max,
    idleTimeoutMillis: resolvedPoolConfig.idleTimeoutMillis,
    connectionTimeoutMillis: resolvedPoolConfig.connectionTimeoutMillis,
    maxUses: resolvedPoolConfig.maxUses,
    query_timeout: resolvedPoolConfig.statementTimeoutMillis,
    keepAlive: true,
  });
  db = drizzle(pool, { schema });
  setDbPoolMetricsProvider(getPoolStats);

  pool.on("connect", (client) => {
    void applySessionTimeouts(client, resolvedPoolConfig!).catch((err) => {
      console.error(
        "[DB] Failed to apply PostgreSQL session timeouts:",
        err instanceof Error ? err.message : err,
      );
    });
  });

  pool.on("error", (err: Error) => {
    console.error("[DB] Unexpected pool error:", err.message);
  });

  console.log("[DB] ✅ Database pool initialized.", {
    max: resolvedPoolConfig.max,
    min: resolvedPoolConfig.min,
    idleTimeoutMillis: resolvedPoolConfig.idleTimeoutMillis,
    connectionTimeoutMillis: resolvedPoolConfig.connectionTimeoutMillis,
    statementTimeoutMillis: resolvedPoolConfig.statementTimeoutMillis,
    idleInTransactionSessionTimeoutMillis:
      resolvedPoolConfig.idleInTransactionSessionTimeoutMillis,
  });
};

export const closeDb = async (): Promise<void> => {
  if (!pool) return;

  const activePool = pool;
  pool = null;
  db = null;
  resolvedPoolConfig = null;
  setDbPoolMetricsProvider(null);

  await activePool.end();
  console.log("[DB] ✅ Database pool closed");
};

/**
 * Convenience wrapper — throws if db is not initialized.
 * Callers that can run without DB should check getPool() first.
 */
export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> => {
  if (!pool) throw new Error("Database pool is not initialized");
  return pool.query<T>(text, params);
};
