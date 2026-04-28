import { randomUUID } from "node:crypto";

export type EnrichmentJobStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "timed_out";

export interface EnrichmentJob {
  id: string;
  status: EnrichmentJobStatus;
  createdAt: number;
  updatedAt: number;
  result?: unknown;
  error?: string;
}

/**
 * In-memory store for AI enrichment jobs (#929).
 *
 * Jobs are evicted after `MAX_TTL_MS` so a long-running process doesn't grow
 * the map unbounded. Production deployments would back this with Redis or
 * Postgres; this keeps the request path non-blocking without a new dependency.
 */
const MAX_TTL_MS = 15 * 60 * 1000; // 15 minutes
const jobs = new Map<string, EnrichmentJob>();

function evictExpired(): void {
  const cutoff = Date.now() - MAX_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.updatedAt < cutoff) {
      jobs.delete(id);
    }
  }
}

export function createEnrichmentJob(): EnrichmentJob {
  evictExpired();
  const now = Date.now();
  const job: EnrichmentJob = {
    id: randomUUID(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(job.id, job);
  return job;
}

export function setJobResult(id: string, result: unknown): void {
  const existing = jobs.get(id);
  if (!existing) return;
  jobs.set(id, {
    ...existing,
    status: "succeeded",
    result,
    updatedAt: Date.now(),
  });
}

export function setJobError(
  id: string,
  status: "failed" | "timed_out",
  error: string,
): void {
  const existing = jobs.get(id);
  if (!existing) return;
  jobs.set(id, {
    ...existing,
    status,
    error,
    updatedAt: Date.now(),
  });
}

export function getJob(id: string): EnrichmentJob | undefined {
  evictExpired();
  return jobs.get(id);
}

/** Test-only: wipe the store between tests. */
export function __resetJobStoreForTest(): void {
  jobs.clear();
}
