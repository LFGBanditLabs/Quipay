import * as cron from "node-cron";
import { getPool } from "../db/pool";
import { getAuditLogger, isAuditLoggerInitialized } from "../audit/init";

interface SchedulerScheduledTask {
  start: () => void;
  stop: () => void;
}

interface SchedulerScheduleOptions {
  scheduled?: boolean;
  timezone?: string;
  recoverMissedExecutions?: boolean;
  name?: string;
  runOnInit?: boolean;
}
import {
  getActivePayrollSchedules,
  updatePayrollSchedule,
  logSchedulerAction,
  PayrollSchedule,
} from "../db/queries";

const SCHEDULER_POLL_INTERVAL_MS = parseInt(
  process.env.SCHEDULER_POLL_MS || "60000",
  10,
);
const AUTOMATION_GATEWAY_ADDRESS = process.env.AUTOMATION_GATEWAY_ADDRESS || "";
const PAYROLL_STREAM_ADDRESS = process.env.PAYROLL_STREAM_ADDRESS || "";

interface ScheduledJob {
  id: number;
  task: SchedulerScheduledTask;
  cronExpression: string;
}

const activeJobs: Map<number, ScheduledJob> = new Map();

const log = (message: string, ...args: unknown[]) => {
  const timestamp = new Date().toISOString();
  console.log(`[Scheduler] ${timestamp} - ${message}`, ...args);
};

const logError = (message: string, error: unknown) => {
  const timestamp = new Date().toISOString();
  const errorMsg = error instanceof Error ? error.message : String(error);
  console.error(`[Scheduler] ${timestamp} - ERROR: ${message}`, errorMsg);
};

const calculateNextRun = (cronExpression: string): Date | null => {
  try {
    if (!cron.validate(cronExpression)) {
      return null;
    }
    const parts = cronExpression.split(" ");
    const minute = parts[0];
    const hour = parts[1] || "*";
    const dayOfMonth = parts[2] || "*";
    const month = parts[3] || "*";
    const dayOfWeek = parts[4] || "*";

    const now = new Date();
    const next = new Date(now);

    if (minute !== "*" && !minute.includes("/")) {
      next.setMinutes(parseInt(minute, 10), 0, 0);
    } else if (minute.includes("/")) {
      const interval = parseInt(minute.split("/")[1], 10);
      const currentMinute = now.getMinutes();
      const nextMinute = Math.ceil(currentMinute / interval) * interval;
      next.setMinutes(nextMinute, 0, 0);
    }

    if (next <= now) {
      next.setHours(next.getHours() + 1);
    }

    return next;
  } catch {
    return null;
  }
};

const triggerStreamCreation = async (
  schedule: PayrollSchedule,
): Promise<number> => {
  log(`Creating stream for schedule ${schedule.id}`, {
    employer: schedule.employer,
    worker: schedule.worker,
    rate: schedule.rate,
  });

  if (!AUTOMATION_GATEWAY_ADDRESS || !PAYROLL_STREAM_ADDRESS) {
    log(`Simulating stream creation (no contract addresses configured)`);
    return Math.floor(Math.random() * 1000000) + 1;
  }

  throw new Error(
    "Contract integration not yet implemented. Configure AUTOMATION_GATEWAY_ADDRESS and PAYROLL_STREAM_ADDRESS.",
  );
};

const executeScheduledPayroll = async (
  schedule: PayrollSchedule,
): Promise<void> => {
  const startTime = Date.now();
  let status: "success" | "failed" | "skipped" = "success";
  let streamId: number | undefined;
  let errorMessage: string | undefined;

  // Log task started
  if (isAuditLoggerInitialized()) {
    try {
      const auditLogger = getAuditLogger();
      await auditLogger.logSchedulerEvent({
        scheduleId: schedule.id,
        action: "task_started",
        taskName: `payroll-schedule-${schedule.id}`,
        employer: schedule.employer,
      });
    } catch (err) {
      logError("Failed to log scheduler task start", err);
    }
  }

  try {
    log(`Executing scheduled payroll for schedule ${schedule.id}`);

    const now = new Date();
    const durationSeconds = schedule.duration_days * 24 * 60 * 60;
    const startTs = Math.floor(now.getTime() / 1000);
    const endTs = startTs + durationSeconds;

    log(`Stream parameters:`, {
      startTs,
      endTs,
      durationDays: schedule.duration_days,
    });

    streamId = await triggerStreamCreation(schedule);

    log(`Stream created successfully with ID: ${streamId}`);

    const nextRun = calculateNextRun(schedule.cron_expression);
    await updatePayrollSchedule({
      id: schedule.id,
      lastRunAt: now,
      nextRunAt: nextRun || undefined,
    });

    // Log task completed
    if (isAuditLoggerInitialized()) {
      try {
        const auditLogger = getAuditLogger();
        const executionTime = Date.now() - startTime;
        await auditLogger.logSchedulerEvent({
          scheduleId: schedule.id,
          action: "task_completed",
          taskName: `payroll-schedule-${schedule.id}`,
          employer: schedule.employer,
          executionTime,
        });
      } catch (err) {
        logError("Failed to log scheduler task completion", err);
      }
    }
  } catch (error) {
    status = "failed";
    errorMessage = error instanceof Error ? error.message : String(error);
    logError(
      `Failed to execute scheduled payroll for schedule ${schedule.id}`,
      error,
    );

    // Log task failed
    if (isAuditLoggerInitialized()) {
      try {
        const auditLogger = getAuditLogger();
        await auditLogger.logSchedulerEvent({
          scheduleId: schedule.id,
          action: "task_failed",
          taskName: `payroll-schedule-${schedule.id}`,
          employer: schedule.employer,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      } catch (err) {
        logError("Failed to log scheduler task failure", err);
      }
    }

    try {
      await updatePayrollSchedule({
        id: schedule.id,
        lastRunAt: new Date(),
      });
    } catch (updateError) {
      logError(`Failed to update schedule after error`, updateError);
    }
  }

  const executionTime = Date.now() - startTime;

  await logSchedulerAction({
    scheduleId: schedule.id,
    action: "stream_creation",
    status,
    streamId,
    errorMessage,
    executionTime,
  });
};

const validateCronExpression = (expression: string): boolean => {
  return cron.validate(expression);
};

const scheduleJob = (schedule: PayrollSchedule): boolean => {
  if (!validateCronExpression(schedule.cron_expression)) {
    logError(
      `Invalid cron expression for schedule ${schedule.id}: ${schedule.cron_expression}`,
      null,
    );
    return false;
  }

  if (activeJobs.has(schedule.id)) {
    log(`Job already active for schedule ${schedule.id}, skipping`);
    return false;
  }

  try {
    const options: SchedulerScheduleOptions = {
      scheduled: true,
      timezone: "UTC",
    };

    const task = cron.schedule(
      schedule.cron_expression,
      async () => {
        await executeScheduledPayroll(schedule);
      },
      options,
    );

    activeJobs.set(schedule.id, {
      id: schedule.id,
      task,
      cronExpression: schedule.cron_expression,
    });

    log(
      `Scheduled job for schedule ${schedule.id} with cron: ${schedule.cron_expression}`,
    );
    return true;
  } catch (error) {
    logError(`Failed to schedule job for schedule ${schedule.id}`, error);
    return false;
  }
};

const unscheduleJob = (scheduleId: number): boolean => {
  const job = activeJobs.get(scheduleId);
  if (!job) {
    return false;
  }

  try {
    job.task.stop();
    activeJobs.delete(scheduleId);
    log(`Unscheduled job for schedule ${scheduleId}`);
    return true;
  } catch (error) {
    logError(`Failed to unschedule job for schedule ${scheduleId}`, error);
    return false;
  }
};

const refreshJobs = async (): Promise<void> => {
  try {
    const schedules = await getActivePayrollSchedules();
    log(`Found ${schedules.length} active schedules`);

    const activeScheduleIds = new Set(schedules.map((s) => s.id));

    for (const [scheduleId] of activeJobs) {
      if (!activeScheduleIds.has(scheduleId)) {
        unscheduleJob(scheduleId);
      }
    }

    for (const schedule of schedules) {
      const existingJob = activeJobs.get(schedule.id);
      if (!existingJob) {
        scheduleJob(schedule);
      } else if (existingJob.cronExpression !== schedule.cron_expression) {
        log(
          `Cron expression changed for schedule ${schedule.id}, rescheduling`,
        );
        unscheduleJob(schedule.id);
        scheduleJob(schedule);
      }
    }
  } catch (error) {
    logError(`Failed to refresh scheduled jobs`, error);
  }
};

const startHealthCheck = (): void => {
  setInterval(
    () => {
      log(`Health check - Active jobs: ${activeJobs.size}`);
    },
    5 * 60 * 1000,
  );
};

export const startScheduler = async (): Promise<void> => {
  if (!getPool()) {
    console.warn(
      "[Scheduler] ⚠️ Database not configured — scheduler disabled.",
    );
    return;
  }

  log("🚀 Starting payroll scheduler...");

  await refreshJobs();

  setInterval(refreshJobs, SCHEDULER_POLL_INTERVAL_MS);

  startHealthCheck();

  log(
    `✅ Payroll scheduler started. Polling every ${SCHEDULER_POLL_INTERVAL_MS}ms`,
  );
};

export const stopScheduler = (): void => {
  log("Stopping payroll scheduler...");

  for (const [scheduleId] of activeJobs) {
    unscheduleJob(scheduleId);
  }

  log("Payroll scheduler stopped");
};

export const getSchedulerStatus = (): {
  activeJobs: number;
  jobs: Array<{ id: number; cronExpression: string }>;
} => {
  const jobs = Array.from(activeJobs.values()).map((job) => ({
    id: job.id,
    cronExpression: job.cronExpression,
  }));

  return {
    activeJobs: activeJobs.size,
    jobs,
  };
};

export {
  validateCronExpression,
  scheduleJob,
  unscheduleJob,
  executeScheduledPayroll,
  calculateNextRun,
};
