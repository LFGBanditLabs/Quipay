import { Pool, QueryResult, QueryResultRow } from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import path from "path";
import * as schema from "./schema";
import { MigrationRunner } from "./migrationRunner";
import { serviceLogger } from "../audit/serviceLogger";

let pool: Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;

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
