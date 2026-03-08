CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"log_level" text NOT NULL,
	"message" text NOT NULL,
	"action_type" text NOT NULL,
	"employer" text,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"transaction_hash" text,
	"block_number" bigint,
	"error_message" text,
	"error_code" text,
	"error_stack" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "log_level_check" CHECK (log_level IN ('INFO', 'WARN', 'ERROR'))
);
--> statement-breakpoint
CREATE TABLE "payroll_schedules" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"employer" text NOT NULL,
	"worker" text NOT NULL,
	"token" text NOT NULL,
	"rate" numeric NOT NULL,
	"cron_expression" text NOT NULL,
	"duration_days" integer DEFAULT 30 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_streams" (
	"stream_id" bigint PRIMARY KEY NOT NULL,
	"employer" text NOT NULL,
	"worker" text NOT NULL,
	"total_amount" numeric NOT NULL,
	"withdrawn_amount" numeric DEFAULT '0' NOT NULL,
	"start_ts" bigint NOT NULL,
	"end_ts" bigint NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"closed_at" bigint,
	"ledger_created" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduler_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"schedule_id" bigint NOT NULL,
	"action" text NOT NULL,
	"status" text NOT NULL,
	"stream_id" bigint,
	"error_message" text,
	"execution_time" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_cursors" (
	"contract_id" text PRIMARY KEY NOT NULL,
	"last_ledger" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_balances" (
	"employer" text PRIMARY KEY NOT NULL,
	"balance" numeric DEFAULT '0' NOT NULL,
	"token" text DEFAULT 'USDC' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_monitor_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"employer" text NOT NULL,
	"balance" numeric NOT NULL,
	"liabilities" numeric NOT NULL,
	"runway_days" numeric,
	"alert_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"address" text NOT NULL,
	"token" text NOT NULL,
	"amount" numeric NOT NULL,
	"ledger" bigint NOT NULL,
	"ledger_ts" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"stream_id" bigint NOT NULL,
	"worker" text NOT NULL,
	"amount" numeric NOT NULL,
	"ledger" bigint NOT NULL,
	"ledger_ts" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scheduler_logs" ADD CONSTRAINT "scheduler_logs_schedule_id_payroll_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."payroll_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_stream_id_payroll_streams_stream_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."payroll_streams"("stream_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_timestamp" ON "audit_logs" USING btree ("timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_audit_logs_level" ON "audit_logs" USING btree ("log_level");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_employer" ON "audit_logs" USING btree ("employer");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action_type" ON "audit_logs" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_audit_logs_context" ON "audit_logs" USING gin ("context");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_employer_timestamp" ON "audit_logs" USING btree ("employer","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action_created" ON "audit_logs" USING btree ("action_type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_schedules_employer" ON "payroll_schedules" USING btree ("employer");--> statement-breakpoint
CREATE INDEX "idx_schedules_enabled" ON "payroll_schedules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "idx_schedules_next_run" ON "payroll_schedules" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "idx_streams_employer" ON "payroll_streams" USING btree ("employer");--> statement-breakpoint
CREATE INDEX "idx_streams_worker" ON "payroll_streams" USING btree ("worker");--> statement-breakpoint
CREATE INDEX "idx_streams_status" ON "payroll_streams" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_streams_created_at" ON "payroll_streams" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_streams_start_ts" ON "payroll_streams" USING btree ("start_ts");--> statement-breakpoint
CREATE INDEX "idx_streams_employer_status" ON "payroll_streams" USING btree ("employer","status");--> statement-breakpoint
CREATE INDEX "idx_streams_worker_status" ON "payroll_streams" USING btree ("worker","status");--> statement-breakpoint
CREATE INDEX "idx_streams_employer_created" ON "payroll_streams" USING btree ("employer","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_streams_worker_created" ON "payroll_streams" USING btree ("worker","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_streams_employer_worker" ON "payroll_streams" USING btree ("employer","worker");--> statement-breakpoint
CREATE INDEX "idx_scheduler_logs_schedule" ON "scheduler_logs" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "idx_scheduler_logs_status" ON "scheduler_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scheduler_logs_created_at" ON "scheduler_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_scheduler_logs_schedule_created" ON "scheduler_logs" USING btree ("schedule_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_monitor_log_employer" ON "treasury_monitor_log" USING btree ("employer");--> statement-breakpoint
CREATE INDEX "idx_monitor_log_created" ON "treasury_monitor_log" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_vault_address" ON "vault_events" USING btree ("address");--> statement-breakpoint
CREATE INDEX "idx_vault_event_type" ON "vault_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_vault_created_at" ON "vault_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_vault_address_hash" ON "vault_events" USING hash ("address");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_stream" ON "withdrawals" USING btree ("stream_id");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_worker" ON "withdrawals" USING btree ("worker");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_created_at" ON "withdrawals" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_withdrawals_worker_created" ON "withdrawals" USING btree ("worker","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_withdrawals_stream_created" ON "withdrawals" USING btree ("stream_id","created_at" DESC NULLS LAST);