import {
  pgTable,
  text,
  bigint,
  timestamp,
  numeric,
  integer,
  boolean,
  bigserial,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Track the last ingested ledger per contract (for idempotent sync)
export const syncCursors = pgTable("sync_cursors", {
  contractId: text("contract_id").primaryKey(),
  lastLedger: bigint("last_ledger", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Mirror of on-chain payroll_stream entries
export const payrollStreams = pgTable(
  "payroll_streams",
  {
    streamId: bigint("stream_id", { mode: "number" }).primaryKey(),
    employer: text("employer").notNull(),
    worker: text("worker").notNull(),
    totalAmount: numeric("total_amount").notNull(), // stored in stroops (1e-7 XLM equivalent)
    withdrawnAmount: numeric("withdrawn_amount").notNull().default("0"),
    startTs: bigint("start_ts", { mode: "number" }).notNull(), // unix seconds (on-chain ledger timestamp)
    endTs: bigint("end_ts", { mode: "number" }).notNull(),
    status: text("status").notNull().default("active"), // active | completed | cancelled
    closedAt: bigint("closed_at", { mode: "number" }),
    ledgerCreated: bigint("ledger_created", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_streams_employer").on(table.employer),
    index("idx_streams_worker").on(table.worker),
    index("idx_streams_status").on(table.status),
    index("idx_streams_created_at").on(table.createdAt.desc()),
    index("idx_streams_start_ts").on(table.startTs),
    index("idx_streams_employer_status").on(table.employer, table.status),
    index("idx_streams_worker_status").on(table.worker, table.status),
    index("idx_streams_employer_created").on(
      table.employer,
      table.createdAt.desc(),
    ),
    index("idx_streams_worker_created").on(
      table.worker,
      table.createdAt.desc(),
    ),
    index("idx_streams_employer_worker").on(table.employer, table.worker),
  ],
);

// Per-withdrawal events
export const withdrawals = pgTable(
  "withdrawals",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    streamId: bigint("stream_id", { mode: "number" })
      .notNull()
      .references(() => payrollStreams.streamId),
    worker: text("worker").notNull(),
    amount: numeric("amount").notNull(),
    ledger: bigint("ledger", { mode: "number" }).notNull(),
    ledgerTs: bigint("ledger_ts", { mode: "number" }).notNull(), // unix seconds
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_withdrawals_stream").on(table.streamId),
    index("idx_withdrawals_worker").on(table.worker),
    index("idx_withdrawals_created_at").on(table.createdAt.desc()),
    index("idx_withdrawals_worker_created").on(
      table.worker,
      table.createdAt.desc(),
    ),
    index("idx_withdrawals_stream_created").on(
      table.streamId,
      table.createdAt.desc(),
    ),
  ],
);

// Vault deposit / payout events
export const vaultEvents = pgTable(
  "vault_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    eventType: text("event_type").notNull(), // 'deposit' | 'payout'
    address: text("address").notNull(), // from / to
    token: text("token").notNull(),
    amount: numeric("amount").notNull(),
    ledger: bigint("ledger", { mode: "number" }).notNull(),
    ledgerTs: bigint("ledger_ts", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_vault_address").on(table.address),
    index("idx_vault_event_type").on(table.eventType),
    index("idx_vault_created_at").on(table.createdAt.desc()),
    index("idx_vault_address_hash").using("hash", table.address),
  ],
);

// Payroll schedules for automated stream creation
export const payrollSchedules = pgTable(
  "payroll_schedules",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    employer: text("employer").notNull(),
    worker: text("worker").notNull(),
    token: text("token").notNull(),
    rate: numeric("rate").notNull(),
    cronExpression: text("cron_expression").notNull(),
    durationDays: integer("duration_days").notNull().default(30),
    enabled: boolean("enabled").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_schedules_employer").on(table.employer),
    index("idx_schedules_enabled").on(table.enabled),
    index("idx_schedules_next_run").on(table.nextRunAt),
  ],
);

// Scheduler execution logs
export const schedulerLogs = pgTable(
  "scheduler_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    scheduleId: bigint("schedule_id", { mode: "number" })
      .notNull()
      .references(() => payrollSchedules.id),
    action: text("action").notNull(),
    status: text("status").notNull(),
    streamId: bigint("stream_id", { mode: "number" }),
    errorMessage: text("error_message"),
    executionTime: integer("execution_time"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_scheduler_logs_schedule").on(table.scheduleId),
    index("idx_scheduler_logs_status").on(table.status),
    index("idx_scheduler_logs_created_at").on(table.createdAt.desc()),
    index("idx_scheduler_logs_schedule_created").on(
      table.scheduleId,
      table.createdAt.desc(),
    ),
  ],
);

// Treasury balances (employer deposits)
export const treasuryBalances = pgTable("treasury_balances", {
  employer: text("employer").primaryKey(),
  balance: numeric("balance").notNull().default("0"),
  token: text("token").notNull().default("USDC"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Treasury monitor logs
export const treasuryMonitorLog = pgTable(
  "treasury_monitor_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    employer: text("employer").notNull(),
    balance: numeric("balance").notNull(),
    liabilities: numeric("liabilities").notNull(),
    runwayDays: numeric("runway_days"),
    alertSent: boolean("alert_sent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_monitor_log_employer").on(table.employer),
    index("idx_monitor_log_created").on(table.createdAt.desc()),
  ],
);

// Audit logs for comprehensive action tracking
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
    logLevel: text("log_level").notNull(),
    message: text("message").notNull(),
    actionType: text("action_type").notNull(),
    employer: text("employer"),
    context: jsonb("context").notNull().default({}),
    transactionHash: text("transaction_hash"),
    blockNumber: bigint("block_number", { mode: "number" }),
    errorMessage: text("error_message"),
    errorCode: text("error_code"),
    errorStack: text("error_stack"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_audit_logs_timestamp").on(table.timestamp.desc()),
    index("idx_audit_logs_level").on(table.logLevel),
    index("idx_audit_logs_employer").on(table.employer),
    index("idx_audit_logs_action_type").on(table.actionType),
    index("idx_audit_logs_created_at").on(table.createdAt.desc()),
    index("idx_audit_logs_context").using("gin", table.context),
    index("idx_audit_logs_employer_timestamp").on(
      table.employer,
      table.timestamp.desc(),
    ),
    index("idx_audit_logs_action_created").on(
      table.actionType,
      table.createdAt.desc(),
    ),
    check("log_level_check", sql`log_level IN ('INFO', 'WARN', 'ERROR')`),
  ],
);
