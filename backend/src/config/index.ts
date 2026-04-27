import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const DEFAULT_AUDIT_REDACTED_FIELDS = [
  "password",
  "secret",
  "privatekey",
  "private_key",
  "seedphrase",
  "seed_phrase",
  "mnemonic",
  "token",
  "apikey",
  "api_key",
  "auth",
  "authorization",
];

const AUDIT_SCHEMA_FIELDS = new Set([
  // audit_logs columns
  "timestamp",
  "log_level",
  "message",
  "action_type",
  "employer",
  "context",
  "transaction_hash",
  "block_number",
  "error_message",
  "error_code",
  "error_stack",
  "created_at",
  // known LogContext fields
  "worker",
  "token",
  "amount",
  "duration",
  "stream_id",
  "contract_address",
  "function_name",
  "parameters",
  "balance",
  "liabilities",
  "runway_days",
  "daily_burn_rate",
  "alert_sent",
  "check_type",
  "schedule_id",
  "cron_expression",
  "execution_time",
  "task_name",
  "duration_ms",
  "status_code",
  "result",
  // sensitive aliases supported by default redaction
  "password",
  "secret",
  "privatekey",
  "private_key",
  "seedphrase",
  "seed_phrase",
  "mnemonic",
  "apikey",
  "api_key",
  "auth",
  "authorization",
]);

function parseCsvList(value: string | undefined): string[] {
  if (!value) return [];

  return value
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
}

function getAuditRedactedFields(): string[] {
  const overrideFields = parseCsvList(process.env.AUDIT_REDACTED_FIELDS);

  const fields =
    overrideFields.length > 0
      ? overrideFields
      : [
          ...DEFAULT_AUDIT_REDACTED_FIELDS,
          ...parseCsvList(process.env.LOG_REDACT_FIELDS),
        ];

  const deduped = Array.from(
    new Set(fields.map((field) => field.toLowerCase())),
  );

  deduped.forEach((field) => {
    if (!AUDIT_SCHEMA_FIELDS.has(field)) {
      console.warn(
        `[AuditLogger] Redaction field \"${field}\" not found in audit schema; it will still be redacted when present.`,
      );
    }
  });

  return deduped;
}

export const config = {
  port: process.env.PORT || 3000,
  stellar: {
    network: process.env.STELLAR_NETWORK || "TESTNET",
    rpcUrl:
      process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
  },
  audit: {
    redactedFields: getAuditRedactedFields(),
  },
};
