import { getDb } from "./pool";
import { payrollReportSchedules } from "./schema";
import { eq, desc, and } from "drizzle-orm";

export interface PayrollReportScheduleInput {
  employerId: string;
  frequency: "weekly" | "monthly";
  email: string;
  enabled?: boolean;
}

export interface PayrollReportSchedule extends PayrollReportScheduleInput {
  id: number;
  lastSentAt?: Date | null;
  nextSendAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const createReportSchedule = async (
  input: PayrollReportScheduleInput,
): Promise<PayrollReportSchedule> => {
  const db = getDb();
  if (!db) throw new Error("Database not initialized");

  const [schedule] = await db
    .insert(payrollReportSchedules)
    .values({
      ...input,
      enabled: input.enabled ?? true,
    })
    .returning();

  return schedule as PayrollReportSchedule;
};

export const getReportSchedulesByEmployer = async (
  employerId: string,
): Promise<PayrollReportSchedule[]> => {
  const db = getDb();
  if (!db) return [];

  return db
    .select()
    .from(payrollReportSchedules)
    .where(eq(payrollReportSchedules.employerId, employerId))
    .orderBy(desc(payrollReportSchedules.createdAt)) as Promise<
    PayrollReportSchedule[]
  >;
};

export const deleteReportSchedule = async (
  id: number,
): Promise<PayrollReportSchedule | null> => {
  const db = getDb();
  if (!db) return null;

  const [deleted] = await db
    .delete(payrollReportSchedules)
    .where(eq(payrollReportSchedules.id, id))
    .returning();

  return (deleted as PayrollReportSchedule) || null;
};

export const updateReportScheduleLastSent = async (
  id: number,
  nextSendAt: Date,
): Promise<void> => {
  const db = getDb();
  if (!db) return;

  await db
    .update(payrollReportSchedules)
    .set({
      lastSentAt: new Date(),
      nextSendAt,
      updatedAt: new Date(),
    })
    .where(eq(payrollReportSchedules.id, id));
};

export const getEnabledSchedulesDue = async (): Promise<
  PayrollReportSchedule[]
> => {
  const db = getDb();
  if (!db) return [];

  const now = new Date();

  return db
    .select()
    .from(payrollReportSchedules)
    .where(eq(payrollReportSchedules.enabled, true))
    .orderBy(payrollReportSchedules.nextSendAt) as Promise<
    PayrollReportSchedule[]
  >;
};
