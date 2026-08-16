/**
 * Offer.ai background worker.
 *
 * Polls the Postgres-backed `background_jobs` queue, claims work with
 * FOR UPDATE SKIP LOCKED semantics (via RLS-free service access), executes
 * registered handlers and records outcomes. See
 * docs/architecture/background-jobs.md.
 */

import { createServiceSupabaseClient, JobQueue, type Database } from "@offer-ai/database";
import { createLogger, getServerEnv } from "@offer-ai/config";
import { getHandler } from "./jobs/registry";
import { loadRootEnv } from "@offer-ai/config";

loadRootEnv();

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2_000);
const BATCH_SIZE = Number(process.env.WORKER_BATCH_SIZE ?? 5);

async function run(): Promise<void> {
  const env = getServerEnv();
  const logger = createLogger(env.LOG_LEVEL).child({ service: "worker" });

  const service = createServiceSupabaseClient();
  const queue = new JobQueue(service);

  logger.info("worker started", {
    pollIntervalMs: POLL_INTERVAL_MS,
    batchSize: BATCH_SIZE,
    provider: env.AI_PROVIDER,
  });

  while (true) {
    try {
      const jobs = await queue.claimBatch(BATCH_SIZE);
      for (const job of jobs) {
        await processJob(job, queue, logger);
      }
    } catch (error) {
      logger.error("worker poll failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

async function processJob(
  job: Database["public"]["Tables"]["background_jobs"]["Row"],
  queue: JobQueue,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const jobLogger = logger.child({
    jobId: job.id,
    kind: job.kind,
    correlationId: job.correlation_id ?? undefined,
  });

  const handler = getHandler(job.kind);
  if (!handler) {
    jobLogger.error("no handler registered for job kind");
    await queue.markFailed(job.id, `No handler for job kind "${job.kind}".`);
    return;
  }

  const attempts = job.attempts + 1;
  await queue.markRunning(job.id, attempts);

  const startedAt = Date.now();
  try {
    await handler.handle(job.payload, { logger: jobLogger, correlationId: job.correlation_id });
    await queue.markCompleted(job.id);
    jobLogger.info("job completed", { durationMs: Date.now() - startedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    jobLogger.error("job failed", {
      error: message,
      attempt: attempts,
      maxAttempts: job.max_attempts,
      durationMs: Date.now() - startedAt,
    });

    if (attempts < job.max_attempts) {
      await queue.scheduleRetry(job.id, message, attempts);
    } else {
      await queue.markFailed(job.id, message);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

run().catch((error) => {
  console.error("worker crashed:", error);
  process.exit(1);
});
