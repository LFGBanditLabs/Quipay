import { getPool } from "./pool";

export interface DLQItem {
  id: string; // BIGINT in Postgres, comes back as a string using node-pg
  job_type: string;
  payload: any;
  error_stack: string | null;
  context: any;
  status: "pending" | "replayed" | "discarded";
  created_at: Date;
  updated_at: Date;
}

/**
 * Pushes a terminally failed job to the Dead Letter Queue.
 */
export const pushToDLQ = async (
  jobType: string,
  payload: Record<string, unknown>,
  errorStack?: string,
  context: Record<string, unknown> = {},
): Promise<string> => {
  const pool = getPool();
  if (!pool) throw new Error("Database pool not initialized");

  const query = `
    INSERT INTO dead_letter_queue (job_type, payload, error_stack, context)
    VALUES ($1, $2, $3, $4)
    RETURNING id;
  `;
  const values = [
    jobType,
    JSON.stringify(payload),
    errorStack || null,
    JSON.stringify(context),
  ];

  const result = await pool.query(query, values);
  return result.rows[0].id;
};

/**
 * Retrieves pending DLQ items.
 */
export const getPendingDLQItems = async (
  limit: number = 50,
  offset: number = 0,
): Promise<DLQItem[]> => {
  const pool = getPool();
  if (!pool) throw new Error("Database pool not initialized");

  const query = `
    SELECT id, job_type, payload, error_stack, context, status, created_at, updated_at
    FROM dead_letter_queue
    WHERE status = 'pending'
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2;
  `;
  const result = await pool.query(query, [limit, offset]);
  return result.rows as DLQItem[];
};

export const getPendingDLQItemsByJobType = async (
  jobType: string,
  limit: number = 50,
  offset: number = 0,
): Promise<DLQItem[]> => {
  const pool = getPool();
  if (!pool) throw new Error("Database pool not initialized");

  const query = `
    SELECT id, job_type, payload, error_stack, context, status, created_at, updated_at
    FROM dead_letter_queue
    WHERE status = 'pending' AND job_type = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const result = await pool.query(query, [jobType, limit, offset]);
  return result.rows as DLQItem[];
};

/**
 * Retrieves a specific DLQ item by ID.
 */
export const getDLQItemById = async (id: string): Promise<DLQItem | null> => {
  const pool = getPool();
  if (!pool) throw new Error("Database pool not initialized");

  const query = `
    SELECT id, job_type, payload, error_stack, context, status, created_at, updated_at
    FROM dead_letter_queue
    WHERE id = $1;
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] ? (result.rows[0] as DLQItem) : null;
};

/**
 * Updates the status of a DLQ item (e.g., after it has been replayed or discarded).
 */
export const updateDLQItemStatus = async (
  id: string,
  status: "replayed" | "discarded",
): Promise<void> => {
  const pool = getPool();
  if (!pool) throw new Error("Database pool not initialized");

  const query = `
    UPDATE dead_letter_queue
    SET status = $2,
        updated_at = NOW()
    WHERE id = $1;
  `;
  await pool.query(query, [id, status]);
};

/**
 * Permanently deletes an item from the DLQ.
 */
export const deleteDLQItem = async (id: string): Promise<void> => {
  const pool = getPool();
  if (!pool) throw new Error("Database pool not initialized");

  const query = `
    DELETE FROM dead_letter_queue
    WHERE id = $1;
  `;
  await pool.query(query, [id]);
};
