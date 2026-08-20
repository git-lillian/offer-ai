import { z } from "zod";

/**
 * Opportunity contracts — validates every boundary with zod.
 *
 * Opportunities are public catalogue data; student_opportunities are private
 * owner-scoped joins (saved/applied/completed). Gap analysis is deterministic
 * and never decides eligibility — it surfaces actionable suggestions.
 */

// ── Shared enums ──────────────────────────────────────────────────────────

export const opportunityTypeSchema = z.enum([
  "internship",
  "volunteering",
  "course",
  "competition",
  "research",
]);

export type OpportunityTypeInput = z.infer<typeof opportunityTypeSchema>;

export const studentOpportunityStatusSchema = z.enum([
  "saved",
  "applied",
  "completed",
]);

export type StudentOpportunityStatusInput = z.infer<typeof studentOpportunityStatusSchema>;

// ── Opportunity DTO ───────────────────────────────────────────────────────

export const opportunityDtoSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  providerName: z.string().min(1).max(200),
  opportunityType: opportunityTypeSchema,
  locationCountryCode: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  isRemote: z.boolean(),
  durationMonths: z.number().int().min(0).max(120).nullable(),
  description: z.string().max(5000),
  url: z.string().url().max(2048).nullable(),
  createdAt: z.string().datetime(),
});

export type OpportunityDto = z.infer<typeof opportunityDtoSchema>;

// ── Student opportunity DTO ───────────────────────────────────────────────

export const studentOpportunityDtoSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  opportunityId: z.string().uuid(),
  status: studentOpportunityStatusSchema,
  appliedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type StudentOpportunityDto = z.infer<typeof studentOpportunityDtoSchema>;

// ── List opportunities ────────────────────────────────────────────────────

function emptyToUndefined(value: unknown): unknown {
  return value === "" || value === null ? undefined : value;
}

function optionalString(max = 120) {
  return z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
}

export const listOpportunitiesSchema = z.object({
  query: optionalString(200),
  opportunityType: z.preprocess(emptyToUndefined, opportunityTypeSchema.optional()),
  locationCountryCode: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^[A-Z]{2}$/).optional(),
  ),
  isRemote: z
    .preprocess((value) => {
      if (value === "" || value === null || value === undefined) return undefined;
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    }, z.boolean().optional()),
  providerName: optionalString(200),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListOpportunitiesInput = z.infer<typeof listOpportunitiesSchema>;

export const listOpportunitiesResponseSchema = z.object({
  opportunities: z.array(opportunityDtoSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type ListOpportunitiesResponse = z.infer<typeof listOpportunitiesResponseSchema>;

// ── Save / update student opportunity ────────────────────────────────────

export const saveOpportunitySchema = z.object({
  opportunityId: z.string().uuid("opportunityId must be a valid UUID."),
});

export type SaveOpportunityInput = z.infer<typeof saveOpportunitySchema>;

export const updateStudentOpportunitySchema = z.object({
  studentOpportunityId: z.string().uuid(),
  status: studentOpportunityStatusSchema,
  appliedAt: z.string().datetime().nullable().optional(),
});

export type UpdateStudentOpportunityInput = z.infer<typeof updateStudentOpportunitySchema>;

export const listStudentOpportunitiesSchema = z.object({
  studentId: z.string().uuid().optional(),
  status: studentOpportunityStatusSchema.optional(),
  opportunityType: opportunityTypeSchema.optional(),
});

export type ListStudentOpportunitiesInput = z.infer<typeof listStudentOpportunitiesSchema>;

export const listStudentOpportunitiesResponseSchema = z.object({
  studentOpportunities: z.array(studentOpportunityDtoSchema),
  opportunities: z.array(opportunityDtoSchema),
});

export type ListStudentOpportunitiesResponse = z.infer<typeof listStudentOpportunitiesResponseSchema>;

// ── Gap analysis ─────────────────────────────────────────────────────────

export const gapSeveritySchema = z.enum(["gap", "suggestion", "info"]);

export const experienceGapDtoSchema = z.object({
  code: z.string().min(1).max(80),
  message: z.string().min(1).max(500),
  severity: gapSeveritySchema,
  suggestedOpportunityTypes: z.array(opportunityTypeSchema),
});

export type ExperienceGapDto = z.infer<typeof experienceGapDtoSchema>;

export const gapAnalysisRequestSchema = z.object({
  studentId: z.string().uuid().optional(),
  courseIds: z
    .array(z.string().uuid())
    .max(20, "At most 20 courses may be analysed.")
    .optional(),
});

export type GapAnalysisRequest = z.infer<typeof gapAnalysisRequestSchema>;

export const gapAnalysisResponseSchema = z.object({
  gaps: z.array(experienceGapDtoSchema),
  suggestedOpportunityTypes: z.array(opportunityTypeSchema),
  summary: z.string().min(1).max(1000),
});

export type GapAnalysisResponse = z.infer<typeof gapAnalysisResponseSchema>;
