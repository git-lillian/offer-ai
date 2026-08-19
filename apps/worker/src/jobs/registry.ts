/**
 * Job handlers — one module per job kind. Handlers are idempotent: running
 * the same logical operation twice must not produce duplicate side effects.
 */

import type { DemoEchoJobPayload } from "@offer-ai/contracts";
import { demoEchoJobPayloadSchema } from "@offer-ai/contracts";
import type { Logger } from "@offer-ai/config";
import { catalogIngestHandler, catalogScheduleAllHandler } from "./catalog-jobs";
import { generateArtifactHandler } from "./artifact-jobs";
import { explainEligibilityHandler } from "./adviser-jobs";
import { notificationSendHandler, deadlineCheckHandler } from "./notification-jobs";

export interface JobContext {
  logger: Logger;
  correlationId?: string | null;
}

export interface JobHandler {
  kind: string;
  handle(payload: unknown, context: JobContext): Promise<void>;
}

/**
 * Harmless demonstration job: validates its payload, logs it and completes.
 * Exists to prove the enqueue → consume → idempotent-completion loop.
 */
export const demoEchoHandler: JobHandler = {
  kind: "demo.echo",
  async handle(payload, context) {
    const parsed = demoEchoJobPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Invalid demo.echo payload: ${parsed.error.message}`);
    }
    const data = parsed.data as DemoEchoJobPayload;
    context.logger.info("demo.echo processed", { message: data.message });
  },
};

const registry = new Map<string, JobHandler>();

for (const handler of [
  demoEchoHandler,
  catalogIngestHandler,
  catalogScheduleAllHandler,
  generateArtifactHandler,
  explainEligibilityHandler,
  notificationSendHandler,
  deadlineCheckHandler,
]) {
  registry.set(handler.kind, handler);
}

export function getHandler(kind: string): JobHandler | null {
  return registry.get(kind) ?? null;
}

export function listKinds(): string[] {
  return [...registry.keys()];
}
