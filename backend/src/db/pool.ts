import { Pool, QueryResult, QueryResultRow } from "pg";
import fs from "fs";
import path from "path";

let pool: Pool | null = null;

/**
 * Returns the singleton pool (null when DATABASE_URL is not configured).
 */
export const getPool = (): Pool | null => pool;

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

  pool = new Pool({ connectionString: url });

  pool.on("error", (err) => {
    console.error("[DB] Unexpected pool error:", err.message);
  });

  // Run schema DDL (idempotent CREATE IF NOT EXISTS)
  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");
  await pool.query(schemaSql);

  console.log("[DB] ✅ Database initialized and schema verified.");
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
