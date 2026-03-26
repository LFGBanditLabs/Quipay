import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import path from "path";
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { serviceLogger } from "../audit/serviceLogger";
import { DbPoolMetricSnapshot, setDbPoolMetricsProvider } from "../metrics";
import { MigrationRunner } from "./migrationRunner";
import * as schema from "./schema";

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
  maxRetries: number;
  retryBaseDelayMs: number;
  maxRetryDelayMs: number;
}

const getEnvValue = (...keys: string[]): string | undefined =>
  keys.find((key) => process.env[key] !== undefined)
    ? process.env[keys.find((key) => process.env[key] !== undefined)!]
    : undefined;

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
    getEnvValue("PGPOOL_DATABASE_CONNECTION_LIMIT"),
    50,
  );
  const appInstances = parsePositiveInt(getEnvValue("PGPOOL_APP_INSTANCES"), 1);
  const reservedConnections = parseNonNegativeInt(
    getEnvValue("PGPOOL_RESERVED_CONNECTIONS"),
    5,
  );
  const derivedMax = Math.max(
    4,
    Math.floor(
      Math.max(1, databaseConnectionLimit - reservedConnections) / appInstances,
    ),
  );

  const max = parsePositiveInt(
    getEnvValue("PGPOOL_MAX", "DB_POOL_MAX"),
    derivedMax,
  );
  const min = Math.min(
    parseNonNegativeInt(getEnvValue("PGPOOL_MIN", "DB_POOL_MIN"), 2),
    max,
  );

  return {
    min,
    max,
    idleTimeoutMillis: parsePositiveInt(
      getEnvValue("PGPOOL_IDLE_TIMEOUT_MS", "DB_POOL_IDLE_MS"),
      30_000,
    ),
    connectionTimeoutMillis: parsePositiveInt(
      getEnvValue(
        "PGPOOL_CONNECTION_TIMEOUT_MS",
        "DB_POOL_CONNECTION_TIMEOUT_MS",
      ),
      5_000,
    ),
    maxUses: parsePositiveInt(getEnvValue("PGPOOL_MAX_USES"), 7_500),
    statementTimeoutMillis: parsePositiveInt(
      getEnvValue("PGPOOL_STATEMENT_TIMEOUT_MS"),
      15_000,
    ),
    idleInTransactionSessionTimeoutMillis: parsePositiveInt(
      getEnvValue("PGPOOL_IDLE_IN_TRANSACTION_TIMEOUT_MS"),
      10_000,
    ),
    applicationName:
      getEnvValue("PGAPPNAME", "PGPOOL_APPLICATION_NAME") || "quipay",
    maxRetries: parsePositiveInt(getEnvValue("DB_POOL_MAX_RETRIES"), 5),
    retryBaseDelayMs: parsePositiveInt(
      getEnvValue("DB_POOL_RETRY_BASE_DELAY_MS"),
      500,
    ),
    maxRetryDelayMs: parsePositiveInt(
      getEnvValue("DB_POOL_MAX_DELAY_MS"),
      10_000,
    ),
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
  await poolClient.query("SET application_name = $1", [config.applicationName]);
};

const getPoolEventContext = (
  activePool: Pool,
  config: ResolvedPoolConfig,
): Record<string, number> => ({
  total_connections: activePool.totalCount,
  idle_connections: activePool.idleCount,
  waiting_requests: activePool.waitingCount,
  pool_max: config.max,
  pool_min: config.min,
});

const attachPoolObservers = (activePool: Pool, config: ResolvedPoolConfig) => {
  activePool.on("connect", (client) => {
    void (async () => {
      await applySessionTimeouts(client, config);
      await serviceLogger.info("DbPool", "New database connection created", {
        event_type: "db_connection_created",
        ...getPoolEventContext(activePool, config),
      });
    })().catch((err) => {
      console.error(
        "[DB] Failed to initialize PostgreSQL session state:",
        err instanceof Error ? err.message : err,
      );
    });
  });

  activePool.on("acquire", () => {
    const total = activePool.totalCount;
    const waiting = activePool.waitingCount;

    if (total >= config.max && waiting > 0) {
      void serviceLogger.warn(
        "DbPool",
        "Connection pool exhausted; requests are waiting for a free connection",
        {
          event_type: "db_pool_exhausted",
          ...getPoolEventContext(activePool, config),
        },
      );
    }
  });

  activePool.on("error", (err: Error) => {
    console.error("[DB] Unexpected pool error:", err.message);
    void serviceLogger.error("DbPool", "Unexpected pool error", err, {
      event_type: "db_connection_error",
      ...getPoolEventContext(activePool, config),
    });
  });

  activePool.on("remove", () => {
    void serviceLogger.info("DbPool", "Database connection removed", {
      event_type: "db_connection_removed",
      ...getPoolEventContext(activePool, config),
    });
  });
};

const createConfiguredPool = (
  url: string,
  config: ResolvedPoolConfig,
): Pool => {
  const activePool = new Pool({
    connectionString: url,
    min: config.min,
    max: config.max,
    idleTimeoutMillis: config.idleTimeoutMillis,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    maxUses: config.maxUses,
    query_timeout: config.statementTimeoutMillis,
    keepAlive: true,
  });

  attachPoolObservers(activePool, config);
  return activePool;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

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

  if (pool) return;

  const config = resolvePoolConfig();
  const migrationsDir = path.join(__dirname, "migrations");
  let attempt = 0;

  while (attempt < config.maxRetries) {
    attempt += 1;
    let createdPool: Pool | null = null;

    try {
      createdPool = createConfiguredPool(url, config);

      const client = await createdPool.connect();
      client.release();

      const migrationRunner = new MigrationRunner(createdPool, migrationsDir);
      await migrationRunner.migrate();

      pool = createdPool;
      db = drizzle(createdPool, { schema });
      resolvedPoolConfig = config;
      setDbPoolMetricsProvider(getPoolStats);

      await serviceLogger.info(
        "DbPool",
        "Database initialized and migrations applied",
        {
          event_type: "db_init_success",
          attempt,
          pool_max: config.max,
          pool_min: config.min,
        },
      );

      console.log("[DB] ✅ Database pool initialized.", {
        max: config.max,
        min: config.min,
        idleTimeoutMillis: config.idleTimeoutMillis,
        connectionTimeoutMillis: config.connectionTimeoutMillis,
        statementTimeoutMillis: config.statementTimeoutMillis,
        idleInTransactionSessionTimeoutMillis:
          config.idleInTransactionSessionTimeoutMillis,
      });
      return;
    } catch (err) {
      if (createdPool) {
        try {
          await createdPool.end();
        } catch {
          // Ignore cleanup failures during initialization retries.
        }
      }

      pool = null;
      db = null;
      resolvedPoolConfig = null;
      setDbPoolMetricsProvider(null);

      await serviceLogger.error(
        "DbPool",
        "Failed to initialize database connection pool",
        err,
        {
          event_type: "db_init_retry",
          attempt,
          max_retries: config.maxRetries,
        },
      );

      if (attempt >= config.maxRetries) {
        await serviceLogger.error(
          "DbPool",
          "Exhausted database initialization retries",
          err,
          {
            event_type: "db_init_failed",
            attempt,
            max_retries: config.maxRetries,
          },
        );
        throw err;
      }

      const delay = Math.min(
        config.retryBaseDelayMs * Math.pow(2, attempt - 1),
        config.maxRetryDelayMs,
      );
      await sleep(delay);
    }
  }
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
