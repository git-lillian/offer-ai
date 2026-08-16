import { z } from "zod";

/**
 * Payload for creating an application case. The `studentId` is filled from
 * the authenticated session server-side — it is never trusted from the
 * browser.
 */
export const createApplicationCaseSchema = z.object({
  institutionId: z.string().uuid("Institution id must be a valid UUID."),
  courseId: z.string().uuid("Course id must be a valid UUID."),
  courseIntakeId: z.string().uuid("Intake id must be a valid UUID."),
  applicationCycleId: z.string().uuid("Cycle id must be a valid UUID."),
});

export type CreateApplicationCaseInput = z.infer<typeof createApplicationCaseSchema>;

export const applicationCaseStatusSchema = z.enum([
  "draft",
  "in_progress",
  "submitted",
  "under_review",
  "offer_received",
  "rejected",
  "accepted",
  "enrolled",
  "withdrawn",
  "declined_offer",
]);

export const transitionApplicationCaseSchema = z.object({
  caseId: z.string().uuid(),
  toStatus: applicationCaseStatusSchema,
  message: z.string().trim().max(500).optional(),
});

export type TransitionApplicationCaseInput = z.infer<
  typeof transitionApplicationCaseSchema
>;

export const createTaskSchema = z.object({
  caseId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  source: z.enum([
    "system_rule",
    "ai_recommendation",
    "adviser",
    "student",
    "application_workflow",
  ]),
  assigneeUserId: z.string().uuid().nullable(),
  dueAt: z.string().datetime().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const completeTaskSchema = z.object({
  taskId: z.string().uuid(),
  completionEvidence: z.string().trim().min(1).max(2000),
});

export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;
