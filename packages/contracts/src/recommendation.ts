import { z } from "zod";

export const saveCourseSchema = z.object({
  courseId: z.string().uuid("Course id must be a valid UUID."),
});

export type SaveCourseInput = z.infer<typeof saveCourseSchema>;

export const unsaveCourseSchema = z.object({
  courseId: z.string().uuid("Course id must be a valid UUID."),
});

export type UnsaveCourseInput = z.infer<typeof unsaveCourseSchema>;

export const generateRecommendationsRequestSchema = z.object({
  /** Max 20 courses per request to bound deterministic work in the request. */
  courseIds: z.array(z.string().uuid()).min(1).max(20),
  /** Optional student id — when omitted the server derives it from the session. */
  studentId: z.string().uuid().optional(),
});

export type GenerateRecommendationsRequest = z.infer<typeof generateRecommendationsRequestSchema>;

export const recommendationReasonSchema = z.object({
  code: z.string().min(1).max(80),
  message: z.string().min(1).max(500),
});

export const recommendationBlockerSchema = z.object({
  code: z.string().min(1).max(80),
  message: z.string().min(1).max(500),
  severity: z.enum(["hard", "soft"]),
});

export const missingInformationSchema = z.object({
  field: z.string().min(1).max(80),
  message: z.string().min(1).max(500),
});

export const eligibilityOutcomeSchema = z.enum(["eligible", "ineligible", "uncertain"]);
export const strategyBandSchema = z.enum(["aspirational", "target", "safer"]);

export const recommendationDtoSchema = z.object({
  courseId: z.string().uuid(),
  eligibility: eligibilityOutcomeSchema,
  strategyBand: strategyBandSchema,
  score: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(1),
  reasons: z.array(recommendationReasonSchema),
  blockers: z.array(recommendationBlockerSchema),
  missingInformation: z.array(missingInformationSchema),
  profileVersion: z.string().min(1),
  catalogueVersion: z.string().min(1),
  rulesVersion: z.string().min(1),
});

export type RecommendationDto = z.infer<typeof recommendationDtoSchema>;

export const recommendationListResponseSchema = z.object({
  recommendations: z.array(recommendationDtoSchema),
});

export type RecommendationListResponse = z.infer<typeof recommendationListResponseSchema>;

export const savedCourseDtoSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  courseId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export type SavedCourseDto = z.infer<typeof savedCourseDtoSchema>;

export const listSavedCoursesResponseSchema = z.object({
  savedCourses: z.array(savedCourseDtoSchema),
  courseIds: z.array(z.string().uuid()),
});

export type ListSavedCoursesResponse = z.infer<typeof listSavedCoursesResponseSchema>;
