/**
 * Log Query Service
 *
 * Provides querying and export functionality for audit logs.
 */

import { Pool } from "pg";
import { LogEntry, LogQueryFilters, ExportFilters } from "./types";

/**
 * LogQueryService class - Handles log querying and export
 */
export class LogQueryService {
  constructor(private pool: Pool) {}

  /**
   * Query logs with filters
   */
  async query(filters: LogQueryFilters): Promise<LogEntry[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Build WHERE clause based on filters
    if (filters.startDate) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      params.push(filters.endDate);
    }

    if (filters.logLevel) {
      conditions.push(`log_level = $${paramIndex++}`);
      params.push(filters.logLevel);
    }

    if (filters.employer) {
      conditions.push(`employer = $${paramIndex++}`);
      params.push(filters.employer);
    }

    if (filters.actionType) {
      conditions.push(`action_type = $${paramIndex++}`);
      params.push(filters.actionType);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filters.limit || 1000;
    const offset = filters.offset || 0;

    const query = `
      SELECT 
        id, timestamp, log_level, message, action_type, employer,
        context, transaction_hash, block_number,
        error_message, error_code, error_stack, created_at
      FROM audit_logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    params.push(limit, offset);

    const result = await this.pool.query(query, params);

    // Parse JSONB context field
    return result.rows.map((row) => ({
      ...row,
      context:
        typeof row.context === "string" ? JSON.parse(row.context) : row.context,
    }));
  }

  /**
   * Export logs for an employer
   */
  async export(employerId: string, filters: ExportFilters): Promise<string> {
    const logs = await this.query({ ...filters, employer: employerId });

    if (filters.format === "csv") {
      return this.convertToCSV(logs);
    }

    return JSON.stringify(logs, null, 2);
  }

  /**
   * Convert log entries to CSV format
   */
  private convertToCSV(logs: LogEntry[]): string {
    if (logs.length === 0) {
      return "timestamp,log_level,message,action_type,employer\n";
    }

    const headers = [
      "timestamp",
      "log_level",
      "message",
      "action_type",
      "employer",
      "transaction_hash",
      "block_number",
      "error_message",
    ];

    const rows = logs.map((log) => [
      log.timestamp,
      log.log_level,
      this.escapeCsvValue(log.message),
      log.action_type,
      log.employer || "",
      log.transaction_hash || "",
      log.block_number?.toString() || "",
      log.error_message ? this.escapeCsvValue(log.error_message) : "",
    ]);

    const csvLines = [headers.join(","), ...rows.map((row) => row.join(","))];

    return csvLines.join("\n");
  }

  /**
   * Escape CSV values that contain commas, quotes, or newlines
   */
  private escapeCsvValue(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Get log count for a specific employer
   */
  async getLogCount(employerId: string): Promise<number> {
    const result = await this.pool.query(
      "SELECT COUNT(*) as count FROM audit_logs WHERE employer = $1",
      [employerId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get log statistics
   */
  async getStatistics(employerId?: string): Promise<{
    total: number;
    byLevel: Record<string, number>;
    byActionType: Record<string, number>;
  }> {
    const whereClause = employerId ? "WHERE employer = $1" : "";
    const params = employerId ? [employerId] : [];

    // Total count
    const totalResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
      params,
    );

    // By log level
    const levelResult = await this.pool.query(
      `SELECT log_level, COUNT(*) as count FROM audit_logs ${whereClause} GROUP BY log_level`,
      params,
    );

    // By action type
    const actionResult = await this.pool.query(
      `SELECT action_type, COUNT(*) as count FROM audit_logs ${whereClause} GROUP BY action_type`,
      params,
    );

    const byLevel: Record<string, number> = {};
    levelResult.rows.forEach((row) => {
      byLevel[row.log_level] = parseInt(row.count, 10);
    });

    const byActionType: Record<string, number> = {};
    actionResult.rows.forEach((row) => {
      byActionType[row.action_type] = parseInt(row.count, 10);
    });

    return {
      total: parseInt(totalResult.rows[0].count, 10),
      byLevel,
      byActionType,
    };
  }
}
