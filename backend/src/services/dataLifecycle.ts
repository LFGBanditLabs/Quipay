import * as cron from "node-cron";
import { getPool } from "../db/pool";
import { closeArchivePool } from "../db/archivePool";
import {
  runArchiveRetentionCycle,
  runMetricSnapshotCycle,
} from "./archiveService";
import { logServiceInfo, logServiceWarn } from "../audit/serviceLogger";

interface ScheduledTask {
  start: () => void;
  stop: () => void;
  destroy?: () => void;
}

const ARCHIVE_RETENTION_ENABLED =
  process.env.ARCHIVE_RETENTION_ENABLED !== "false";
const METRIC_SNAPSHOT_ENABLED = process.env.METRIC_SNAPSHOT_ENABLED !== "false";
const ARCHIVE_RETENTION_CRON =
  process.env.ARCHIVE_RETENTION_CRON || "0 3 * * *";
const METRIC_SNAPSHOT_CRON = process.env.METRIC_SNAPSHOT_CRON || "*/5 * * * *";

let archiveTask: ScheduledTask | null = null;
let metricSnapshotTask: ScheduledTask | null = null;

export const startDataLifecycleJobs = async (): Promise<void> => {
  if (!getPool()) {
    await logServiceWarn(
      "DataLifecycle",
      "Database not configured, skipping retention and metrics snapshot jobs",
    );
    return;
  }

  if (ARCHIVE_RETENTION_ENABLED && !archiveTask) {
    archiveTask = cron.schedule(
      ARCHIVE_RETENTION_CRON,
      () => {
        void runArchiveRetentionCycle();
      },
      { timezone: "UTC" },
    );

    await logServiceInfo("DataLifecycle", "Archive retention cron started", {
      cron_expression: ARCHIVE_RETENTION_CRON,
    });
  }

  if (METRIC_SNAPSHOT_ENABLED && !metricSnapshotTask) {
    metricSnapshotTask = cron.schedule(
      METRIC_SNAPSHOT_CRON,
      () => {
        void runMetricSnapshotCycle();
      },
      { timezone: "UTC" },
    );

    await logServiceInfo("DataLifecycle", "Metric snapshot cron started", {
      cron_expression: METRIC_SNAPSHOT_CRON,
    });
  }
};

export const stopDataLifecycleJobs = async (): Promise<void> => {
  archiveTask?.stop();
  archiveTask?.destroy?.();
  archiveTask = null;

  metricSnapshotTask?.stop();
  metricSnapshotTask?.destroy?.();
  metricSnapshotTask = null;

  await closeArchivePool();
};
