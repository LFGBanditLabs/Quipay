import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import path from "path";
import * as schema from "./schema";
import {
  DbPoolMetricSnapshot,
  setDbPoolMetricsProvider,
} from "../metrics";
import { MigrationRunner } from "./migrationRunner";
import { serviceLogger } from "../audit/serviceLogger";

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

const DEFAULT_POOL_MIN = 0;
const DEFAULT_POOL_MAX = 10;
const DEFAULT_POOL_IDLE_MS = 30000;
const DEFAULT_CONN_TIMEOUT_MS = 5000;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 10000;

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
  const maxRetries = parseInt(
    process.env.DB_POOL_MAX_RETRIES || String(DEFAULT_MAX_RETRIES),
    10,
  );
  const baseDelayMs = parseInt(
    process.env.DB_POOL_RETRY_BASE_DELAY_MS || String(DEFAULT_BASE_DELAY_MS),
    10,
  );
  const maxDelayMs = parseInt(
    process.env.DB_POOL_MAX_DELAY_MS || String(DEFAULT_MAX_DELAY_MS),
    10,
  );

  let attempt = 0;
  // Exponential backoff retry for transient startup failures
  // (e.g., database container not yet accepting connections).
  // If all retries are exhausted, the error is rethrown so the
  // process can fail fast rather than running without a database.
  //
  // This is intentionally simple and only runs during initialization.
  // Callers of getPool()/query() still see a fully-initialized pool.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    try {
      const min = parseInt(
        process.env.DB_POOL_MIN || String(DEFAULT_POOL_MIN),
        10,
      );
      const max = parseInt(
        process.env.DB_POOL_MAX || String(DEFAULT_POOL_MAX),
        10,
      );
      const idleTimeoutMillis = parseInt(
        process.env.DB_POOL_IDLE_MS || String(DEFAULT_POOL_IDLE_MS),
        10,
      );
      const connectionTimeoutMillis = parseInt(
        process.env.DB_POOL_CONNECTION_TIMEOUT_MS ||
          String(DEFAULT_CONN_TIMEOUT_MS),
        10,
      );

      const createdPool = new Pool({
        connectionString: url,
        min,
        max,
        idleTimeoutMillis,
        connectionTimeoutMillis,
      });

      // Attach pool-level diagnostics
      createdPool.on("connect", async () => {
        await serviceLogger.info("DbPool", "New database connection created", {
          event_type: "db_connection_created",
          total_connections: createdPool.totalCount,
          idle_connections: createdPool.idleCount,
          waiting_requests: createdPool.waitingCount,
          pool_max: (createdPool as any).options?.max,
          pool_min: (createdPool as any).options?.min,
        });
      });

      createdPool.on("acquire", async () => {
        const total = createdPool.totalCount;
        const waiting = createdPool.waitingCount;
        const configuredMax = (createdPool as any).options?.max as
          | number
          | undefined;

        if (configuredMax && total >= configuredMax && waiting > 0) {
          await serviceLogger.warn(
            "DbPool",
            "Connection pool exhausted; requests are waiting for a free connection",
            {
              event_type: "db_pool_exhausted",
              total_connections: total,
              idle_connections: createdPool.idleCount,
              waiting_requests: waiting,
              pool_max: configuredMax,
            },
          );
        }
      });

      createdPool.on("error", async (err: Error) => {
        await serviceLogger.error("DbPool", "Unexpected pool error", err, {
          event_type: "db_connection_error",
          total_connections: createdPool.totalCount,
          idle_connections: createdPool.idleCount,
          waiting_requests: createdPool.waitingCount,
          pool_max: (createdPool as any).options?.max,
        });
      });

      createdPool.on("remove", async () => {
        await serviceLogger.info("DbPool", "Database connection removed", {
          event_type: "db_connection_removed",
          total_connections: createdPool.totalCount,
          idle_connections: createdPool.idleCount,
          waiting_requests: createdPool.waitingCount,
          pool_max: (createdPool as any).options?.max,
        });
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
      // Assign shared instances only after the pool is fully configured
      pool = createdPool;
      db = drizzle(createdPool, { schema });

      // Run migrations as part of initialization flow so callers see a
      // fully-prepared schema. Any failure here will trigger a retry.
      const migrationsDir = path.join(__dirname, "migrations");
      const migrationRunner = new MigrationRunner(createdPool, migrationsDir);
      await migrationRunner.migrate();

      await serviceLogger.info(
        "DbPool",
        "Database initialized and migrations applied",
        {
          event_type: "db_init_success",
          attempt,
          pool_max: (createdPool as any).options?.max,
          pool_min: (createdPool as any).options?.min,
        },
      );

      return;
    } catch (err) {
      await serviceLogger.error(
        "DbPool",
        "Failed to initialize database connection pool",
        err,
        {
          event_type: "db_init_retry",
          attempt,
          max_retries: maxRetries,
        },
      );

      // Clean up any partially initialized pool before retrying
      if (pool) {
        try {
          await pool.end();
        } catch {
          // ignore
        } finally {
          pool = null;
          db = null;
        }
      }

      if (attempt >= maxRetries) {
        await serviceLogger.error(
          "DbPool",
          "Exhausted database initialization retries",
          err,
          {
            event_type: "db_init_failed",
            attempt,
            max_retries: maxRetries,
          },
        );
        throw err;
      }

      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1),
        maxDelayMs,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
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
