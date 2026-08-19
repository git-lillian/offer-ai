import { z } from "zod";

/**
 * Application OS contracts — validates every boundary with zod.
 *
 * The OS treats tasks and milestones as first-class aggregates:
 * - tasks: checklist items (transcript, PS, reference…)
 * - milestones: timeline checkpoints (prepare → submit → await)
 */

export const applicationOsTaskSourceSchema = z.enum([
  "system_rule",
  "ai_recommendation",
  "adviser",
  "student",
  "application_workflow",
]);

export const applicationOsTaskPrioritySchema = z.enum([
  "low",
  "medium",
  "high",
  "urgent",
]);

export const applicationOsTaskStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

export const applicationOsMilestoneStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

// ── Tasks ───────────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  caseId: z.string().uuid("caseId must be a valid UUID."),
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().trim().max(2000).default(""),
  source: applicationOsTaskSourceSchema,
  assigneeUserId: z.string().uuid().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  priority: applicationOsTaskPrioritySchema.default("medium"),
});

export type CreateOsTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  priority: applicationOsTaskPrioritySchema.optional(),
  status: applicationOsTaskStatusSchema.optional(),
  completionEvidence: z.string().trim().max(2000).optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const completeOsTaskSchema = z.object({
  taskId: z.string().uuid(),
  completionEvidence: z.string().trim().min(1).max(2000),
});

export type CompleteOsTaskInput = z.infer<typeof completeOsTaskSchema>;

export const rescheduleTaskSchema = z.object({
  taskId: z.string().uuid(),
  dueAt: z.string().datetime().nullable(),
});

export type RescheduleTaskInput = z.infer<typeof rescheduleTaskSchema>;

export const listTasksSchema = z.object({
  caseId: z.string().uuid(),
  status: applicationOsTaskStatusSchema.optional(),
  priority: applicationOsTaskPrioritySchema.optional(),
  assigneeUserId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListTasksInput = z.infer<typeof listTasksSchema>;

export const listTasksResponseSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string().uuid(),
      caseId: z.string().uuid(),
      title: z.string(),
      description: z.string(),
      source: applicationOsTaskSourceSchema,
      assigneeUserId: z.string().uuid().nullable(),
      dueAt: z.string().datetime().nullable(),
      priority: applicationOsTaskPrioritySchema,
      status: applicationOsTaskStatusSchema,
      completionEvidence: z.string().nullable(),
      completedAt: z.string().datetime().nullable(),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
    }),
  ),
  total: z.number().int().nonnegative(),
});

export type ListTasksResponse = z.infer<typeof listTasksResponseSchema>;

// ── Milestones ──────────────────────────────────────────────────────────

export const createMilestoneSchema = z.object({
  caseId: z.string().uuid("caseId must be a valid UUID."),
  title: z.string().trim().min(1, "Title is required.").max(200),
  dueAt: z.string().datetime().nullable().optional(),
  status: applicationOsMilestoneStatusSchema.default("pending"),
  sortOrder: z.number().int().min(0).default(0),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

export const updateMilestoneSchema = z.object({
  milestoneId: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  status: applicationOsMilestoneStatusSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;

export const listMilestonesSchema = z.object({
  caseId: z.string().uuid(),
});

export type ListMilestonesInput = z.infer<typeof listMilestonesSchema>;

export const milestoneDtoSchema = z.object({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
  title: z.string(),
  dueAt: z.string().datetime().nullable(),
  status: applicationOsMilestoneStatusSchema,
  sortOrder: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MilestoneDto = z.infer<typeof milestoneDtoSchema>;

export const listMilestonesResponseSchema = z.object({
  milestones: z.array(milestoneDtoSchema),
});

export type ListMilestonesResponse = z.infer<typeof listMilestonesResponseSchema>;
