import { z } from "zod";

export const ingestionFetchJobPayloadSchema = z.object({
  sourceId: z.string().uuid(),
});

export type IngestionFetchJobPayload = z.infer<typeof ingestionFetchJobPayloadSchema>;

export const ingestionScheduleAllPayloadSchema = z.object({
  limit: z.number().int().min(1).max(50).default(5),
  triggeredBy: z.string().min(1).max(100).optional(),
});

export type IngestionScheduleAllPayload = z.infer<typeof ingestionScheduleAllPayloadSchema>;

export const ingestionReviewDecisionSchema = z.object({
  requirementId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  reviewerUserId: z.string().uuid(),
  note: z.string().max(1000).optional(),
});

export type IngestionReviewDecision = z.infer<typeof ingestionReviewDecisionSchema>;
