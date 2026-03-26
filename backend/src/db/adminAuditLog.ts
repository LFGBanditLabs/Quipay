import { getDb } from "./pool";
import { adminAuditLog } from "./schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";

export interface AdminAuditLogInput {
  adminAddress: string;
  action: string;
  target?: string | null;
  details?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AdminAuditLogFilters {
  startDate?: Date;
  endDate?: Date;
  adminAddress?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

/**
 * Log an admin action to the audit trail
 */
export const logAdminAction = async (input: AdminAuditLogInput): Promise<void> => {
  const db = getDb();
  if (!db) {
    console.warn("[Admin Audit] Database not initialized, skipping audit log");
    return;
  }

  try {
    await db.insert(adminAuditLog).values({
      adminAddress: input.adminAddress,
      action: input.action,
      target: input.target ?? null,
      details: input.details ?? {},
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (error: any) {
    console.error("[Admin Audit] Failed to log admin action:", error.message);
  }
};

/**
 * Get admin audit logs with pagination and filtering
 */
export const getAdminAuditLogs = async (
  filters: AdminAuditLogFilters = {}
): Promise<{ logs: any[]; total: number }> => {
  const db = getDb();
  if (!db) {
    return { logs: [], total: 0 };
  }

  const {
    startDate,
    endDate,
    adminAddress,
    action,
    limit = 50,
    offset = 0,
  } = filters;

  // Build where conditions
  const conditions = [];
  
  if (startDate && endDate) {
    conditions.push(
      and(
        gte(adminAuditLog.timestamp, startDate),
        lte(adminAuditLog.timestamp, endDate)
      )
    );
  } else if (startDate) {
    conditions.push(gte(adminAuditLog.timestamp, startDate));
  } else if (endDate) {
    conditions.push(lte(adminAuditLog.timestamp, endDate));
  }

  if (adminAddress) {
    conditions.push(eq(adminAuditLog.adminAddress, adminAddress));
  }

  if (action) {
    conditions.push(eq(adminAuditLog.action, action));
  }

  // Get total count
  let countQuery = db.select().from(adminAuditLog);
  if (conditions.length > 0) {
    countQuery = countQuery.where(conditions.reduce((acc, cond) => acc ? and(acc, cond) : cond));
  }
  
  const allLogs = await countQuery;
  const total = allLogs.length;

  // Get paginated results
  let query = db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.timestamp));
  
  if (conditions.length > 0) {
    query = query.where(conditions.reduce((acc, cond) => acc ? and(acc, cond) : cond));
  }
  
  const logs = await query.limit(limit).offset(offset);

  return { logs, total };
};

/**
 * Get audit logs by admin address
 */
export const getAuditLogsByAdmin = async (
  adminAddress: string,
  limit = 50,
  offset = 0
): Promise<any[]> => {
  const db = getDb();
  if (!db) {
    return [];
  }

  return db
    .select()
    .from(adminAuditLog)
    .where(eq(adminAuditLog.adminAddress, adminAddress))
    .orderBy(desc(adminAuditLog.timestamp))
    .limit(limit)
    .offset(offset);
};
