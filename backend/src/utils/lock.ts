import { query } from "../db/pool";

/**
 * Executes a task within a PostgreSQL advisory lock.
 * If the lock cannot be acquired, the task is skipped.
 *
 * @param lockId A unique numeric ID for the lock
 * @param task The async task to execute
 * @param taskName A descriptive name for logging
 */
export async function withAdvisoryLock(
  lockId: number,
  task: () => Promise<void>,
  taskName: string,
): Promise<void> {
  try {
    // Attempt to acquire the lock (returns true if acquired, false otherwise)
    const result = await query<{ pg_try_advisory_lock: boolean }>(
      "SELECT pg_try_advisory_lock($1)",
      [lockId],
    );

    const acquired = result.rows[0]?.pg_try_advisory_lock;

    if (!acquired) {
      console.log(
        `[Lock] 🔒 Task "${taskName}" skipped: lock ${lockId} held by another instance.`,
      );
      return;
    }

    try {
      console.log(`[Lock] 🔑 Acquired lock ${lockId} for task "${taskName}".`);
      await task();
    } finally {
      // Release the lock
      await query("SELECT pg_advisory_unlock($1)", [lockId]);
      console.log(`[Lock] 🔓 Released lock ${lockId} for task "${taskName}".`);
    }
  } catch (err) {
    console.error(
      `[Lock] ❌ Error in withAdvisoryLock for task "${taskName}":`,
      err,
    );
    throw err;
  }
}
