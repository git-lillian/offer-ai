import { z } from "zod";

export const enqueueJobSchema = z.object({
  kind: z.string().min(1).max(100),
  payload: z.record(z.unknown()).default({}),
  idempotencyKey: z.string().min(1).max(200).optional(),
});

export type EnqueueJobInput = z.infer<typeof enqueueJobSchema>;

export const demoEchoJobPayloadSchema = z.object({
  message: z.string().min(1).max(1000),
});

export type DemoEchoJobPayload = z.infer<typeof demoEchoJobPayloadSchema>;
