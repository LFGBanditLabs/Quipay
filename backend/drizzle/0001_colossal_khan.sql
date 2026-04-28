CREATE TABLE "admin_audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"admin_address" text NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employers" (
	"employer_id" text PRIMARY KEY NOT NULL,
	"business_name" text NOT NULL,
	"registration_number" text NOT NULL,
	"country_code" text NOT NULL,
	"contact_name" text,
	"contact_email" text,
	"verification_status" text DEFAULT 'pending' NOT NULL,
	"verification_reason" text,
	"verification_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employers_registration_number_unique" UNIQUE("registration_number"),
	CONSTRAINT "employer_verification_status_check" CHECK (verification_status IN ('pending', 'verified', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"endpoint" text NOT NULL,
	"status_code" integer NOT NULL,
	"response_body" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metrics_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_proofs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"stream_id" bigint NOT NULL,
	"cid" text NOT NULL,
	"ipfs_url" text NOT NULL,
	"gateway_url" text NOT NULL,
	"proof_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_proofs_stream_id_unique" UNIQUE("stream_id")
);
--> statement-breakpoint
CREATE TABLE "payroll_report_schedules" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"employer_id" text NOT NULL,
	"frequency" text NOT NULL,
	"email" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_sent_at" timestamp with time zone,
	"next_send_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stream_audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"stream_id" bigint NOT NULL,
	"changed_by" text NOT NULL,
	"action" text NOT NULL,
	"old_status" text,
	"new_status" text,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_notification_settings" (
	"worker" text PRIMARY KEY NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"cliff_unlock_alerts" boolean DEFAULT true NOT NULL,
	"stream_ending_alerts" boolean DEFAULT true NOT NULL,
	"low_runway_alerts" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_streams" RENAME COLUMN "employer" TO "employer_address";--> statement-breakpoint
ALTER TABLE "payroll_streams" RENAME COLUMN "worker" TO "worker_address";--> statement-breakpoint
DROP INDEX "idx_streams_employer";--> statement-breakpoint
DROP INDEX "idx_streams_worker";--> statement-breakpoint
DROP INDEX "idx_streams_employer_status";--> statement-breakpoint
DROP INDEX "idx_streams_worker_status";--> statement-breakpoint
DROP INDEX "idx_streams_employer_created";--> statement-breakpoint
DROP INDEX "idx_streams_worker_created";--> statement-breakpoint
DROP INDEX "idx_streams_employer_worker";--> statement-breakpoint
ALTER TABLE "payroll_streams" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "payroll_streams" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payroll_streams" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "payroll_streams" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "payroll_proofs" ADD CONSTRAINT "payroll_proofs_stream_id_payroll_streams_stream_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."payroll_streams"("stream_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_audit_log" ADD CONSTRAINT "stream_audit_log_stream_id_payroll_streams_stream_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."payroll_streams"("stream_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_audit_admin" ON "admin_audit_log" USING btree ("admin_address");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_action" ON "admin_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_timestamp" ON "admin_audit_log" USING btree ("timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_admin_audit_admin_timestamp" ON "admin_audit_log" USING btree ("admin_address","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_employers_status" ON "employers" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "idx_employers_country_status" ON "employers" USING btree ("country_code","verification_status");--> statement-breakpoint
CREATE INDEX "idx_employers_updated_at" ON "employers" USING btree ("updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_idempotency_key_endpoint" ON "idempotency_keys" USING btree ("idempotency_key","endpoint");--> statement-breakpoint
CREATE INDEX "idx_idempotency_expires_at" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_metric_snapshots_captured_at" ON "metric_snapshots" USING btree ("captured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_metric_snapshots_created_at" ON "metric_snapshots" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_proofs_stream_id" ON "payroll_proofs" USING btree ("stream_id");--> statement-breakpoint
CREATE INDEX "idx_proofs_cid" ON "payroll_proofs" USING btree ("cid");--> statement-breakpoint
CREATE INDEX "idx_report_schedules_employer" ON "payroll_report_schedules" USING btree ("employer_id");--> statement-breakpoint
CREATE INDEX "idx_report_schedules_enabled" ON "payroll_report_schedules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "idx_report_schedules_next_send" ON "payroll_report_schedules" USING btree ("next_send_at");--> statement-breakpoint
CREATE INDEX "idx_stream_audit_stream_id" ON "stream_audit_log" USING btree ("stream_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_stream_audit_changed_by" ON "stream_audit_log" USING btree ("changed_by");--> statement-breakpoint
CREATE INDEX "idx_worker_notification_settings_updated" ON "worker_notification_settings" USING btree ("updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "ux_payroll_streams_active_employer_worker" ON "payroll_streams" USING btree ("employer_address","worker_address") WHERE "payroll_streams"."status" = 'active';--> statement-breakpoint
CREATE INDEX "idx_streams_employer" ON "payroll_streams" USING btree ("employer_address");--> statement-breakpoint
CREATE INDEX "idx_streams_worker" ON "payroll_streams" USING btree ("worker_address");--> statement-breakpoint
CREATE INDEX "idx_streams_employer_status" ON "payroll_streams" USING btree ("employer_address","status");--> statement-breakpoint
CREATE INDEX "idx_streams_worker_status" ON "payroll_streams" USING btree ("worker_address","status");--> statement-breakpoint
CREATE INDEX "idx_streams_employer_created" ON "payroll_streams" USING btree ("employer_address","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_streams_worker_created" ON "payroll_streams" USING btree ("worker_address","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_streams_employer_worker" ON "payroll_streams" USING btree ("employer_address","worker_address");--> statement-breakpoint
ALTER TABLE "payroll_streams" ADD CONSTRAINT "payroll_streams_total_amount_positive_check" CHECK ("payroll_streams"."total_amount" > 0);--> statement-breakpoint
ALTER TABLE "payroll_streams" ADD CONSTRAINT "payroll_streams_status_check" CHECK ("payroll_streams"."status" IN ('active', 'paused', 'cancelled', 'completed'));