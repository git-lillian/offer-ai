import { z } from "zod";

/**
 * Document studio contracts — validates every boundary with zod.
 *
 * Artifacts are versioned documents (CV, personal statement, SOP, …) with
 * an approval lifecycle draft → in_review → approved → submitted. The domain
 * never hides provenance: every version carries its origin (human/ai/hybrid)
 * and optional evidence references.
 */

export const artifactTypeSchema = z.enum([
  "cv",
  "personal_statement",
  "statement_of_purpose",
  "supplementary_answer",
  "reference_draft",
  "portfolio_text",
  "application_note",
]);

export const artifactOriginSchema = z.enum(["human", "ai", "hybrid"]);

export const artifactApprovalStateSchema = z.enum([
  "draft",
  "in_review",
  "approved",
  "submitted",
]);

// ── Create artifact ─────────────────────────────────────────────────────────

export const createArtifactSchema = z.object({
  studentId: z.string().uuid("studentId must be a valid UUID.").optional(),
  caseId: z.string().uuid("caseId must be a valid UUID.").nullable().optional(),
  artifactType: artifactTypeSchema,
  title: z.string().trim().min(1, "Title is required.").max(200),
});

export type CreateArtifactInput = z.infer<typeof createArtifactSchema>;

// ── Create version ──────────────────────────────────────────────────────────

export const createVersionSchema = z.object({
  artifactId: z.string().uuid("artifactId must be a valid UUID."),
  content: z.string().trim().min(1, "Content is required.").max(100_000),
  origin: artifactOriginSchema.default("human"),
  promptVersion: z.string().trim().min(1).max(100).nullable().optional(),
  modelRunId: z.string().uuid().nullable().optional(),
  evidenceUsed: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
});

export type CreateVersionInput = z.infer<typeof createVersionSchema>;

// ── Approval transitions ────────────────────────────────────────────────────

export const approveVersionSchema = z.object({
  artifactId: z.string().uuid(),
  versionId: z.string().uuid(),
});

export type ApproveVersionInput = z.infer<typeof approveVersionSchema>;

export const rejectVersionSchema = z.object({
  artifactId: z.string().uuid(),
  versionId: z.string().uuid(),
  reason: z.string().trim().max(1000).optional(),
});

export type RejectVersionInput = z.infer<typeof rejectVersionSchema>;

// ── Listing ─────────────────────────────────────────────────────────────────

export const listArtifactsSchema = z.object({
  studentId: z.string().uuid("studentId must be a valid UUID.").optional(),
  caseId: z.string().uuid().nullable().optional(),
  artifactType: artifactTypeSchema.optional(),
  approvalState: artifactApprovalStateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListArtifactsInput = z.infer<typeof listArtifactsSchema>;

// ── DTOs ────────────────────────────────────────────────────────────────────

export const artifactDtoSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  caseId: z.string().uuid().nullable(),
  artifactType: artifactTypeSchema,
  title: z.string(),
  latestVersionId: z.string().uuid().nullable(),
  approvalState: artifactApprovalStateSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ArtifactDto = z.infer<typeof artifactDtoSchema>;

export const artifactVersionDtoSchema = z.object({
  id: z.string().uuid(),
  artifactId: z.string().uuid(),
  versionNumber: z.number().int().min(1),
  content: z.string(),
  creatorUserId: z.string().uuid(),
  origin: artifactOriginSchema,
  promptVersion: z.string().nullable(),
  modelRunId: z.string().uuid().nullable(),
  evidenceUsed: z.array(z.string()),
  approvalState: artifactApprovalStateSchema,
  createdAt: z.string().datetime(),
});

export type ArtifactVersionDto = z.infer<typeof artifactVersionDtoSchema>;

export const artifactCommentDtoSchema = z.object({
  id: z.string().uuid(),
  artifactId: z.string().uuid(),
  versionNumber: z.number().int().min(1),
  authorUserId: z.string().uuid(),
  body: z.string(),
  createdAt: z.string().datetime(),
});

export type ArtifactCommentDto = z.infer<typeof artifactCommentDtoSchema>;

export const listArtifactsResponseSchema = z.object({
  artifacts: z.array(artifactDtoSchema),
  total: z.number().int().nonnegative(),
});

export type ListArtifactsResponse = z.infer<typeof listArtifactsResponseSchema>;

export const listVersionsResponseSchema = z.object({
  versions: z.array(artifactVersionDtoSchema),
});

export type ListVersionsResponse = z.infer<typeof listVersionsResponseSchema>;

// ── Worker payload ──────────────────────────────────────────────────────────

export const generateArtifactJobPayloadSchema = z.object({
  artifactId: z.string().uuid("artifactId must be a valid UUID."),
  studentId: z.string().uuid("studentId must be a valid UUID."),
  artifactType: artifactTypeSchema,
  prompt: z.string().trim().min(1).max(5000).optional(),
  promptVersion: z.string().trim().min(1).max(50).optional(),
  caseId: z.string().uuid().nullable().optional(),
  versionNumber: z.number().int().min(1).optional(),
  correlationId: z.string().uuid().optional(),
});

export type GenerateArtifactJobPayload = z.infer<typeof generateArtifactJobPayloadSchema>;

// ── Comments ────────────────────────────────────────────────────────────────

export const createCommentSchema = z.object({
  artifactId: z.string().uuid(),
  versionNumber: z.number().int().min(1),
  body: z.string().trim().min(1).max(5000),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
