import * as cron from "node-cron";
import {
  getEnabledSchedulesDue,
  updateReportScheduleLastSent,
} from "../db/payrollReportSchedule";
import {
  sendPayrollReportEmail,
  PayrollReportData,
} from "../services/payrollReportService";
import { serviceLogger } from "../audit/serviceLogger";

/**
 * Calculate next send date based on frequency
 */
const calculateNextSendDate = (frequency: "weekly" | "monthly"): Date => {
  const now = new Date();

  if (frequency === "weekly") {
    // Send every Monday at 9 AM
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + ((1 - now.getDay() + 7) % 7 || 7));
    nextMonday.setHours(9, 0, 0, 0);
    return nextMonday;
  } else {
    // Send on 1st of next month at 9 AM
    const nextMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1,
      9,
      0,
      0,
    );
    return nextMonth;
  }
};

/**
 * Generate mock report data (in production, this would query the database)
 */
const generateReportData = async (
  employerId: string,
): Promise<PayrollReportData> => {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(now.getDate() - 30);

  // Mock data - replace with actual DB queries
  return {
    employerId,
    periodStart,
    periodEnd: now,
    totalPaid: "0",
    activeStreams: 0,
    completedStreams: 0,
    workers: [],
  };
};

/**
 * Process scheduled payroll reports
 */
export const processScheduledReports = async (): Promise<void> => {
  try {
    const schedules = await getEnabledSchedulesDue();

    for (const schedule of schedules) {
      try {
        const reportData = await generateReportData(schedule.employerId);

        const sent = await sendPayrollReportEmail(schedule.email, reportData);

        if (sent) {
          const nextSendAt = calculateNextSendDate(
            schedule.frequency as "weekly" | "monthly",
          );
          await updateReportScheduleLastSent(schedule.id, nextSendAt);

          await serviceLogger.info(
            "PayrollReport",
            `Sent scheduled report to ${schedule.email}`,
            {
              scheduleId: schedule.id,
              employerId: schedule.employerId,
              frequency: schedule.frequency,
            },
          );
        }
      } catch (error: any) {
        await serviceLogger.error(
          "PayrollReport",
          `Failed to send report for schedule ${schedule.id}`,
          error,
          {
            scheduleId: schedule.id,
            employerId: schedule.employerId,
          },
        );
      }
    }
  } catch (error: any) {
    await serviceLogger.error(
      "PayrollReport",
      "Failed to process scheduled reports",
      error,
    );
  }
};

let reportCronJob: cron.ScheduledTask | null = null;

/**
 * Start the payroll report scheduler
 * Runs daily at midnight to check for due reports
 */
export const startPayrollReportScheduler = (): void => {
  if (reportCronJob) {
    console.log("[PayrollReportScheduler] Already running");
    return;
  }

  // Run daily at midnight
  reportCronJob = cron.schedule("0 0 * * *", async () => {
    console.log("[PayrollReportScheduler] Processing scheduled reports...");
    await processScheduledReports();
  });

  console.log("[PayrollReportScheduler] Started - runs daily at midnight");
};

/**
 * Stop the payroll report scheduler
 */
export const stopPayrollReportScheduler = (): void => {
  if (reportCronJob) {
    reportCronJob.stop();
    reportCronJob = null;
    console.log("[PayrollReportScheduler] Stopped");
  }
};
