import { z } from "zod";

/**
 * Zod runtime schemas for the row shapes returned by `db/queries.ts` (#930).
 *
 * Each exported schema mirrors the corresponding `interface` exported from
 * `queries.ts`; the inferred TypeScript type is re-exported so call sites can
 * keep using the same identifier without a dual import.
 *
 * Schemas are intentionally permissive at the boundaries the SQL layer is
 * known to round-trip:
 *   - PostgreSQL `bigint`/`numeric` arrive as strings → `z.string()`
 *   - PostgreSQL `count(*)` arrives as a string in node-pg by default; tolerate
 *     both representations via `z.union([z.number(), z.string()])` and let
 *     the caller coerce as needed.
 *
 * As more queries are migrated to `validateRows`/`validateRow`, add their
 * schemas here so the Drizzle schema and the runtime guard stay in lockstep.
 */

const numericText = z.union([z.string(), z.number()]).transform((v) => String(v));

export const overallStatsSchema = z.object({
  total_streams: z.union([z.number(), z.string()]),
  active_streams: z.union([z.number(), z.string()]),
  completed_streams: z.union([z.number(), z.string()]),
  cancelled_streams: z.union([z.number(), z.string()]),
  total_volume: numericText,
  total_withdrawn: numericText,
});
export type OverallStatsRow = z.infer<typeof overallStatsSchema>;

export const employerPayrollSummarySchema = z.object({
  total_streams: z.union([z.number(), z.string()]),
  active_streams: z.union([z.number(), z.string()]),
  completed_streams: z.union([z.number(), z.string()]),
  cancelled_streams: z.union([z.number(), z.string()]),
  total_volume: numericText,
  total_withdrawn: numericText,
});
export type EmployerPayrollSummaryRow = z.infer<typeof employerPayrollSummarySchema>;

export const trendPointSchema = z.object({
  bucket: z.string(),
  volume: numericText,
  stream_count: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  withdrawal_count: z.union([z.number(), z.string()]).transform((v) => Number(v)),
});
export type TrendPointRow = z.infer<typeof trendPointSchema>;

export const streamRecordSchema = z.object({
  stream_id: z.string(),
  employer_address: z.string(),
  worker_address: z.string(),
  total_amount: numericText,
  withdrawn_amount: numericText,
  start_ts: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  end_ts: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  status: z.string(),
  created_at: z.union([z.string(), z.date()]),
});
export type StreamRecordRow = z.infer<typeof streamRecordSchema>;
