import { createServiceSupabaseClient, JobQueue } from "@offer-ai/database";
import { ingestionFetchJobPayloadSchema, ingestionScheduleAllPayloadSchema } from "@offer-ai/contracts";
import type { JobHandler, JobContext } from "./registry";
import { IngestionService } from "@offer-ai/ingestion";
import { SourceRegistryRepository } from "@offer-ai/database";

/**
 * Ingestion jobs — durable, idempotent, RLS-free (service role).
 *
 * - catalog.ingest: fetch → snapshot → extract → normalize → diff → publish for one source
 * - catalog.schedule_all: enqueue one catalog.ingest per enabled source (fan-out)
 *
 * Idempotency: enqueue with idempotency_key = `catalog.ingest:${sourceId}:${date}`
 * for fan-out, or caller-provided key for single-source; re-enqueues return
 * the existing job.
 */

export const catalogIngestHandler: JobHandler = {
  kind: "catalog.ingest",
  async handle(payload, context: JobContext): Promise<void> {
    const parsed = ingestionFetchJobPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Invalid catalog.ingest payload: ${parsed.error.message}`);
    }
    const { sourceId } = parsed.data;
    const service = createServiceSupabaseClient();
    const serviceInstance = new IngestionService({ db: service as unknown as never });

    context.logger.info("catalog.ingest started", { sourceId });
    const result = await serviceInstance.run(sourceId);
    context.logger.info("catalog.ingest completed", { sourceId, ...result });
  },
};

export const catalogScheduleAllHandler: JobHandler = {
  kind: "catalog.schedule_all",
  async handle(payload, context: JobContext): Promise<void> {
    const parsed = ingestionScheduleAllPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Invalid catalog.schedule_all payload: ${parsed.error.message}`);
    }
    const { limit } = parsed.data;
    const service = createServiceSupabaseClient();
    const registry = new SourceRegistryRepository(service as unknown as never);
    const sources = await registry.listEnabledSources();
    const toEnqueue = sources.slice(0, limit);

    const queue = new JobQueue(service as unknown as never);

    // Use today's date as bucket for idempotency, so a second schedule_all
    // on the same day doesn't flood the queue.
    const bucket = new Date().toISOString().slice(0, 10);

    for (const source of toEnqueue) {
      const idempotencyKey = `catalog.ingest:${source.id}:${bucket}`;
      await queue.enqueue({
        kind: "catalog.ingest",
        payload: { sourceId: source.id },
        idempotencyKey,
        correlationId: context.correlationId ?? undefined,
      });
      context.logger.info("enqueued catalog.ingest", { sourceId: source.id, sourceName: source.name });
    }

    context.logger.info("catalog.schedule_all completed", { enqueued: toEnqueue.length, totalEnabled: sources.length });
  },
};
