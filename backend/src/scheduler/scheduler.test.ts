import {
  validateCronExpression,
  calculateNextRun,
  scheduleJob,
  unscheduleJob,
  getSchedulerStatus,
} from "./scheduler";
import { PayrollSchedule } from "../db/queries";

jest.mock("../db/pool", () => ({
  getPool: jest.fn(() => ({})),
}));

jest.mock("../db/queries", () => ({
  getActivePayrollSchedules: jest.fn(),
  updatePayrollSchedule: jest.fn(),
  logSchedulerAction: jest.fn(),
}));

describe("Scheduler Module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const status = getSchedulerStatus();
    status.jobs.forEach((job) => unscheduleJob(job.id));
  });

  afterAll(() => {
    const status = getSchedulerStatus();
    status.jobs.forEach((job) => unscheduleJob(job.id));
  });

  describe("validateCronExpression", () => {
    it("should return true for valid cron expressions", () => {
      expect(validateCronExpression("0 0 * * *")).toBe(true);
      expect(validateCronExpression("*/5 * * * *")).toBe(true);
      expect(validateCronExpression("0 9 1 * *")).toBe(true);
      expect(validateCronExpression("0 0 1 1 *")).toBe(true);
    });

    it("should return false for invalid cron expressions", () => {
      expect(validateCronExpression("invalid")).toBe(false);
      expect(validateCronExpression("* * * *")).toBe(false);
      expect(validateCronExpression("0 0 0 0 0 0")).toBe(false);
    });
  });

  describe("calculateNextRun", () => {
    it("should return a date for valid cron expressions", () => {
      const nextRun = calculateNextRun("0 0 * * *");
      expect(nextRun).toBeInstanceOf(Date);
    });

    it("should return null for invalid cron expressions", () => {
      const nextRun = calculateNextRun("invalid");
      expect(nextRun).toBeNull();
    });
  });

  describe("scheduleJob", () => {
    const mockSchedule: PayrollSchedule = {
      id: 1,
      employer: "employer_address",
      worker: "worker_address",
      token: "token_address",
      rate: "1000000",
      cron_expression: "0 0 * * *",
      duration_days: 30,
      enabled: true,
      last_run_at: null,
      next_run_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it("should schedule a job for a valid schedule", () => {
      const result = scheduleJob(mockSchedule);
      expect(result).toBe(true);

      const status = getSchedulerStatus();
      expect(status.activeJobs).toBe(1);
      expect(status.jobs[0].id).toBe(1);
    });

    it("should return false for invalid cron expression", () => {
      const invalidSchedule = {
        ...mockSchedule,
        cron_expression: "invalid",
      };
      const result = scheduleJob(invalidSchedule as PayrollSchedule);
      expect(result).toBe(false);
    });

    it("should not duplicate jobs for the same schedule", () => {
      scheduleJob(mockSchedule);
      const result = scheduleJob(mockSchedule);
      expect(result).toBe(false);

      const status = getSchedulerStatus();
      expect(status.activeJobs).toBe(1);
    });
  });

  describe("unscheduleJob", () => {
    const mockSchedule: PayrollSchedule = {
      id: 1,
      employer: "employer_address",
      worker: "worker_address",
      token: "token_address",
      rate: "1000000",
      cron_expression: "0 0 * * *",
      duration_days: 30,
      enabled: true,
      last_run_at: null,
      next_run_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it("should unschedule an existing job", () => {
      scheduleJob(mockSchedule);
      const result = unscheduleJob(1);
      expect(result).toBe(true);

      const status = getSchedulerStatus();
      expect(status.activeJobs).toBe(0);
    });

    it("should return false when job does not exist", () => {
      const result = unscheduleJob(999);
      expect(result).toBe(false);
    });
  });

  describe("getSchedulerStatus", () => {
    it("should return empty status when no jobs scheduled", () => {
      const status = getSchedulerStatus();
      expect(status.activeJobs).toBe(0);
      expect(status.jobs).toHaveLength(0);
    });

    it("should return correct status with scheduled jobs", () => {
      const mockSchedule1: PayrollSchedule = {
        id: 1,
        employer: "employer1",
        worker: "worker1",
        token: "token",
        rate: "100",
        cron_expression: "0 0 * * *",
        duration_days: 30,
        enabled: true,
        last_run_at: null,
        next_run_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockSchedule2: PayrollSchedule = {
        id: 2,
        employer: "employer2",
        worker: "worker2",
        token: "token",
        rate: "200",
        cron_expression: "*/5 * * * *",
        duration_days: 15,
        enabled: true,
        last_run_at: null,
        next_run_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      scheduleJob(mockSchedule1);
      scheduleJob(mockSchedule2);

      const status = getSchedulerStatus();
      expect(status.activeJobs).toBe(2);
      expect(status.jobs).toHaveLength(2);
      expect(status.jobs.map((j) => j.id)).toContain(1);
      expect(status.jobs.map((j) => j.id)).toContain(2);
    });
  });
});
