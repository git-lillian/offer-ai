import { z } from "zod";
import { recommendationDtoSchema } from "./recommendation";

/**
 * AI admissions adviser contracts — validates every boundary with zod.
 *
 * The adviser explains deterministic eligibility (rules decide, LLM explains).
 * Requests are validated at the API boundary; job payloads at the queue boundary.
 */

export const explainEligibilityRequestSchema = z.object({
  studentId: z.string().uuid("studentId must be a valid UUID."),
  courseId: z.string().uuid("courseId must be a valid UUID."),
  correlationId: z.string().uuid().optional(),
});

export type ExplainEligibilityRequest = z.infer<typeof explainEligibilityRequestSchema>;

export const adviserProvenanceSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  latencyMs: z.number().int().nonnegative().nullable(),
  correlationId: z.string().nullable(),
});

export type AdviserProvenance = z.infer<typeof adviserProvenanceSchema>;

export const explainEligibilityResponseSchema = z.object({
  explanation: z.string().trim().min(1).max(5000),
  provenance: adviserProvenanceSchema,
});

export type ExplainEligibilityResponse = z.infer<typeof explainEligibilityResponseSchema>;

/**
 * Structured explanation output — zod validated at the AI boundary.
 * Used when AdviserService calls generateStructured.
 */
export const adviserStructuredOutputSchema = z.object({
  explanation: z.string().trim().min(20).max(5000),
  // Optional summary points — helps guard hallucination by scoping output.
  keyPoints: z.array(z.string().trim().min(1).max(280)).max(6).optional(),
});

export type AdviserStructuredOutput = z.infer<typeof adviserStructuredOutputSchema>;

/**
 * Worker job payload for background generation.
 *
 * The worker fetches the student/course to build contexts, but the
 * deterministic recommendation (with reasons/blockers) is carried in the
 * payload so the LLM only explains — it never recomputes eligibility.
 */
export const explainEligibilityJobPayloadSchema = z.object({
  studentId: z.string().uuid("studentId must be a valid UUID."),
  courseId: z.string().uuid("courseId must be a valid UUID."),
  recommendation: recommendationDtoSchema,
  correlationId: z.string().uuid().optional(),
});

export type ExplainEligibilityJobPayload = z.infer<typeof explainEligibilityJobPayloadSchema>;
