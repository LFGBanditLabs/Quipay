import { Router, Request, Response } from "express";
import { AIGateway } from "./services/aiGateway";
import { validateRequest } from "./middleware/validation";
import { strictRateLimiter } from "./middleware/rateLimiter";
import {
  aiParseCommandSchema,
  aiExecuteCommandSchema,
} from "./schemas/ai.schema";
import { enqueueJob } from "./queue/asyncQueue";
import {
  createEnrichmentJob,
  getJob,
  setJobError,
  setJobResult,
} from "./services/aiJobStore";

export const aiRouter = Router();
const aiGateway = new AIGateway();

/** AI gateway timeout inside the queue worker, in milliseconds (#929). */
export const AI_GATEWAY_TIMEOUT_MS = 30_000;

function withTimeout<T>(
  label: string,
  ms: number,
  work: Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * @api {post} /ai/parse Enqueue a natural-language command for AI parsing
 * @apiDescription
 * Returns immediately with `enrichment_job_id` (#929). The actual AI gateway
 * call happens on the shared async queue with a 30-second timeout; poll
 * `GET /api/ai/jobs/:id` for the result.
 */
aiRouter.post(
  "/parse",
  strictRateLimiter,
  validateRequest({ body: aiParseCommandSchema }),
  async (req: Request, res: Response) => {
    const { command } = req.body;
    const job = createEnrichmentJob();

    enqueueJob(
      async () => {
        try {
          const parsed = await withTimeout(
            "aiGateway.parseCommand",
            AI_GATEWAY_TIMEOUT_MS,
            aiGateway.parseCommand(command),
          );
          const refined = await withTimeout(
            "aiGateway.verifyAndRefine",
            AI_GATEWAY_TIMEOUT_MS,
            aiGateway.verifyAndRefine(parsed),
          );
          setJobResult(job.id, refined);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          const status = message.includes("timed out") ? "timed_out" : "failed";
          setJobError(job.id, status, message);
          throw err;
        }
      },
      {
        jobType: "ai.parseCommand",
        payload: { jobId: job.id },
        context: { command },
      },
    ).catch(() => {
      // enqueueJob already records terminal failures in the DLQ; we surface
      // the per-job status via setJobError above. Swallow to avoid an
      // unhandled rejection from the fire-and-forget enqueue call.
    });

    return res.status(202).json({
      enrichment_job_id: job.id,
      status: job.status,
      poll_url: `/ai/jobs/${job.id}`,
    });
  },
);

/**
 * @api {get} /ai/jobs/:id Poll the status / result of an AI enrichment job
 */
aiRouter.get("/jobs/:id", (req: Request, res: Response) => {
  const id = String(req.params.id);
  const job = getJob(id);
  if (!job) {
    return res.status(404).json({ error: "enrichment job not found" });
  }
  return res.json({
    id: job.id,
    status: job.status,
    result: job.result ?? null,
    error: job.error ?? null,
    createdAt: new Date(job.createdAt).toISOString(),
    updatedAt: new Date(job.updatedAt).toISOString(),
  });
});

/**
 * @api {post} /ai/execute Execute (or confirm) an AI-parsed command
 * @apiDescription In a real implementation, this would trigger the actual on-chain transaction.
 * For now, it serves as a placeholder for the confirmation flow.
 */
aiRouter.post(
  "/execute",
  strictRateLimiter,
  validateRequest({ body: aiExecuteCommandSchema }),
  (req: Request, res: Response) => {
    const { intentId, confirmed } = req.body;

    if (!confirmed) {
      return res.json({
        status: "cancelled",
        message: "Transaction aborted by user.",
      });
    }

    // Placeholder for transaction execution logic
    res.json({
      status: "success",
      message: "Command sent to execution engine.",
      txHash: "SIMULATED_TX_HASH_" + Math.random().toString(36).substring(7),
    });
  },
);
