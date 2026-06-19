import sqlite3 from "sqlite3";
import { promisify } from "util";
import path from "path";
import { logger } from "../utils/logger.js";

export interface DLQEntry {
  id?: number;
  payload: string;
  targetUrl: string;
  retryCount: number;
  lastAttempt: string;
  nextRetry: string;
  maxRetries: number;
  status: "pending" | "retrying" | "failed" | "success";
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
}

export class DLQManager {
  private db: sqlite3.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), "data", "dlq.db");
    this.db = new sqlite3.Database(this.dbPath);
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const createTable = `
      CREATE TABLE IF NOT EXISTS dlq (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payload TEXT NOT NULL,
        target_url TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0,
        last_attempt TEXT,
        next_retry TEXT,
        max_retries INTEGER DEFAULT 5,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'failed', 'success')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        error_message TEXT
      )
    `;

    const createIndexes = [
      "CREATE INDEX IF NOT EXISTS idx_dlq_status ON dlq(status)",
      "CREATE INDEX IF NOT EXISTS idx_dlq_next_retry ON dlq(next_retry)",
      "CREATE INDEX IF NOT EXISTS idx_dlq_target_url ON dlq(target_url)",
    ];

    try {
      await this.runQuery(createTable);

      for (const indexQuery of createIndexes) {
        await this.runQuery(indexQuery);
      }

      logger.info("DLQ database initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize DLQ database:", error);
      throw error;
    }
  }

  private runQuery(query: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  private getAllQuery(query: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async addEntry(
    payload: object,
    targetUrl: string,
    maxRetries: number = 5,
  ): Promise<number> {
    const now = new Date().toISOString();
    const nextRetry = new Date(Date.now() + 30000).toISOString(); // First retry in 30 seconds

    const query = `
      INSERT INTO dlq (payload, target_url, max_retries, next_retry, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    try {
      const result = await this.runQuery(query, [
        JSON.stringify(payload),
        targetUrl,
        maxRetries,
        nextRetry,
        now,
        now,
      ]);

      logger.info("Added DLQ entry", {
        id: result.lastID,
        targetUrl,
        nextRetry,
      });

      return result.lastID;
    } catch (error) {
      logger.error("Failed to add DLQ entry:", error);
      throw error;
    }
  }

  async getRetryableEntries(): Promise<DLQEntry[]> {
    const now = new Date().toISOString();
    const query = `
      SELECT * FROM dlq 
      WHERE status IN ('pending', 'retrying') 
      AND next_retry <= ? 
      AND retry_count < max_retries
      ORDER BY next_retry ASC
    `;

    try {
      const rows = await this.getAllQuery(query, [now]);
      return rows.map(this.mapRowToDLQEntry);
    } catch (error) {
      logger.error("Failed to get retryable entries:", error);
      throw error;
    }
  }

  async updateRetryAttempt(
    id: number,
    success: boolean,
    errorMessage?: string,
  ): Promise<void> {
    const now = new Date().toISOString();

    if (success) {
      const query = `
        UPDATE dlq 
        SET status = 'success', last_attempt = ?, updated_at = ?
        WHERE id = ?
      `;

      await this.runQuery(query, [now, now, id]);
      logger.info("DLQ entry marked as successful", { id });
      return;
    }

    // Get current entry to calculate next retry time
    const entry = await this.getEntryById(id);
    if (!entry) {
      throw new Error(`DLQ entry ${id} not found`);
    }

    const newRetryCount = entry.retryCount + 1;
    const backoffDelays = [30000, 120000, 600000, 3600000, 21600000]; // 30s, 2m, 10m, 1h, 6h
    const nextRetryDelay =
      backoffDelays[Math.min(newRetryCount - 1, backoffDelays.length - 1)];
    const nextRetry = new Date(Date.now() + nextRetryDelay).toISOString();

    if (newRetryCount >= entry.maxRetries) {
      // Mark as permanently failed
      const query = `
        UPDATE dlq 
        SET status = 'failed', retry_count = ?, last_attempt = ?, updated_at = ?, error_message = ?
        WHERE id = ?
      `;

      await this.runQuery(query, [newRetryCount, now, now, errorMessage, id]);
      logger.warn("DLQ entry permanently failed after max retries", {
        id,
        retryCount: newRetryCount,
        maxRetries: entry.maxRetries,
      });
    } else {
      // Schedule next retry
      const query = `
        UPDATE dlq 
        SET status = 'retrying', retry_count = ?, last_attempt = ?, next_retry = ?, 
            updated_at = ?, error_message = ?
        WHERE id = ?
      `;

      await this.runQuery(query, [
        newRetryCount,
        now,
        nextRetry,
        now,
        errorMessage,
        id,
      ]);
      logger.info("DLQ entry scheduled for retry", {
        id,
        retryCount: newRetryCount,
        nextRetry,
      });
    }
  }

  async getEntryById(id: number): Promise<DLQEntry | null> {
    const query = "SELECT * FROM dlq WHERE id = ?";

    try {
      const rows = await this.getAllQuery(query, [id]);
      return rows.length > 0 ? this.mapRowToDLQEntry(rows[0]) : null;
    } catch (error) {
      logger.error("Failed to get DLQ entry by ID:", error);
      throw error;
    }
  }

  async getPermanentlyFailedEntries(): Promise<DLQEntry[]> {
    const query = "SELECT * FROM dlq WHERE status = ? ORDER BY updated_at DESC";

    try {
      const rows = await this.getAllQuery(query, ["failed"]);
      return rows.map(this.mapRowToDLQEntry);
    } catch (error) {
      logger.error("Failed to get permanently failed entries:", error);
      throw error;
    }
  }

  async getStats(): Promise<{
    pending: number;
    retrying: number;
    success: number;
    failed: number;
  }> {
    const query = `
      SELECT status, COUNT(*) as count 
      FROM dlq 
      GROUP BY status
    `;

    try {
      const rows = await this.getAllQuery(query);
      const stats = { pending: 0, retrying: 0, success: 0, failed: 0 };

      rows.forEach((row: any) => {
        stats[row.status as keyof typeof stats] = row.count;
      });

      return stats;
    } catch (error) {
      logger.error("Failed to get DLQ stats:", error);
      throw error;
    }
  }

  private mapRowToDLQEntry(row: any): DLQEntry {
    return {
      id: row.id,
      payload: row.payload,
      targetUrl: row.target_url,
      retryCount: row.retry_count,
      lastAttempt: row.last_attempt,
      nextRetry: row.next_retry,
      maxRetries: row.max_retries,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      errorMessage: row.error_message,
    };
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.db.close((err) => {
        if (err) {
          logger.error("Error closing DLQ database:", err);
        } else {
          logger.info("DLQ database closed successfully");
        }
        resolve();
      });
    });
  }
}

// Export singleton instance
export const dlqManager = new DLQManager();
