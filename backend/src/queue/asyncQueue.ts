import PQueue from "p-queue";
import { pushToDLQ } from "../db/dlq";

/**
 * Shared in-memory queue for handling background async tasks.
 * Concurrency controls how many jobs run simultaneously.
 */
const queueConcurrency = Number.parseInt(
  process.env.QUEUE_CONCURRENCY || "5",
  10,
);

export const globalQueue = new PQueue({
  concurrency:
    Number.isFinite(queueConcurrency) && queueConcurrency > 0
      ? queueConcurrency
      : 5,
});

let queueShuttingDown = false;

export interface JobOptions {
  /** The descriptive job type for logging and the DLQ */
  jobType: string;
  /** The primary data for this job */
  payload: Record<string, unknown>;
  /** Optional extra metadata to contextualize the error */
  context?: Record<string, unknown>;
  /** Max retries before pushing to DLQ */
  maxRetries?: number;
  /** Initial delay in ms for exponential backoff */
  baseDelayMs?: number;
}

/**
 * Enqueues a job that will be retried on failure using exponential backoff.
 * If the job fails entirely after all retries, the payload and error stack
 * will be recorded in the Database Dead Letter Queue (DLQ).
 *
 * @param jobFn The async function to execute.
 * @param options Job details like type, payload, context, and retries.
 */
export const enqueueJob = <T>(
  jobFn: () => Promise<T>,
  options: JobOptions,
): Promise<void> => {
  if (queueShuttingDown) {
    return Promise.reject(
      new Error(
        `Queue is shutting down and cannot accept '${options.jobType}' jobs`,
      ),
    );
  }

  const {
    jobType,
    payload,
    context = {},
    maxRetries = 3,
    baseDelayMs = 1000,
  } = options;

  return globalQueue.add(async () => {
    let attempt = 1;

    while (attempt <= maxRetries) {
      try {
        await jobFn();
        // Success: exit the enclosing add()
        return;
      } catch (err: unknown) {
        const errObj = err instanceof Error ? err : new Error(String(err));

        console.error(
          `[Queue Job: ${jobType}] ❌ Error on attempt ${attempt}/${maxRetries}: ${errObj.message}`,
        );

        if (attempt >= maxRetries) {
          console.error(
            `[Queue Job: ${jobType}] 🚫 Terminal failure. Pushing to DLQ...`,
          );

          try {
            await pushToDLQ(jobType, payload, errObj.stack, {
              ...context,
              attempts: attempt,
              last_error: errObj.message,
            });
            console.log(
              `[Queue Job: ${jobType}] 📥 Successfully recorded in DLQ.`,
            );
          } catch (dlqErr: unknown) {
            // Failsafe in case DB insertion fails
            const dlqMsg =
              dlqErr instanceof Error ? dlqErr.message : String(dlqErr);
            console.error(
              `[CRITICAL DLQ ERROR] Failed to push terminally failed job to DLQ: ${dlqMsg}`,
            );
          }

          return;
        }

        // Apply exponential backoff
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`[Queue Job: ${jobType}] ⏳ Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
      }
    }
  });
};

export const beginQueueShutdown = (): void => {
  queueShuttingDown = true;
  globalQueue.pause();
};

export const waitForQueueToDrain = async (
  timeoutMs = 30_000,
): Promise<void> => {
  const timeout = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      reject(
        new Error(`Timed out waiting for queue to drain after ${timeoutMs}ms`),
      );
    }, timeoutMs);
  });

  await Promise.race([globalQueue.onIdle(), timeout]);
};

export const getQueueStats = () => ({
  size: globalQueue.size,
  pending: globalQueue.pending,
  isPaused: globalQueue.isPaused,
});
