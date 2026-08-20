import { z } from "zod";

/**
 * Notification contracts — validates every notification & deadline boundary with zod.
 *
 * Notifications deliver deadline monitoring, course updates, marketplace messages,
 * billing events and system alerts. Payloads, preferences and watches are
 * validated at the API and worker queue boundaries.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export const notificationChannelSchema = z.enum(["email", "push", "in_app"]);
export type NotificationChannelInput = z.infer<typeof notificationChannelSchema>;

export const notificationTypeSchema = z.enum([
  "deadline",
  "application",
  "marketplace",
  "billing",
  "system",
]);
export type NotificationTypeInput = z.infer<typeof notificationTypeSchema>;

export const notificationStatusSchema = z.enum(["pending", "sent", "failed"]);
export type NotificationStatusInput = z.infer<typeof notificationStatusSchema>;

export const watchTypeSchema = z.enum(["deadline", "availability"]);
export type WatchTypeInput = z.infer<typeof watchTypeSchema>;

// ── Notification DTO ─────────────────────────────────────────────────────────

export const notificationDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  channel: notificationChannelSchema,
  notificationType: notificationTypeSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  payload: z.record(z.unknown()),
  status: notificationStatusSchema,
  scheduledAt: z.string().datetime(),
  sentAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type NotificationDto = z.infer<typeof notificationDtoSchema>;

// ── Create notification ──────────────────────────────────────────────────────

export const createNotificationSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID.").optional(),
  channel: notificationChannelSchema,
  notificationType: notificationTypeSchema,
  title: z.string().trim().min(1, "title is required.").max(200),
  body: z.string().trim().min(1, "body is required.").max(5000),
  payload: z.record(z.unknown()).default({}),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

export const listNotificationsSchema = z.object({
  userId: z.string().uuid().optional(),
  status: notificationStatusSchema.optional(),
  channel: notificationChannelSchema.optional(),
  notificationType: notificationTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;

export const listNotificationsResponseSchema = z.object({
  notifications: z.array(notificationDtoSchema),
});

export type ListNotificationsResponse = z.infer<typeof listNotificationsResponseSchema>;

export const markNotificationSentSchema = z.object({
  notificationId: z.string().uuid(),
});

export type MarkNotificationSentInput = z.infer<typeof markNotificationSentSchema>;

// ── Notification preferences ─────────────────────────────────────────────────

export const notificationPreferenceDtoSchema = z.object({
  userId: z.string().uuid(),
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  deadlineReminderDays: z.array(z.number().int().min(0).max(365)).max(10),
  createdAt: z.string().datetime(),
});

export type NotificationPreferenceDto = z.infer<typeof notificationPreferenceDtoSchema>;

export const createNotificationPreferenceSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID.").optional(),
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  deadlineReminderDays: z
    .array(z.number().int().min(0, "days must be >= 0").max(365, "days must be <= 365"))
    .max(10)
    .optional()
    .refine(
      (arr) => {
        if (!arr) return true;
        return new Set(arr).size === arr.length;
      },
      { message: "deadlineReminderDays must not contain duplicates." },
    ),
});

export type CreateNotificationPreferenceInput = z.infer<typeof createNotificationPreferenceSchema>;

export const updateNotificationPreferenceSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  deadlineReminderDays: z
    .array(z.number().int().min(0).max(365))
    .max(10)
    .optional()
    .refine(
      (arr) => {
        if (!arr) return true;
        return new Set(arr).size === arr.length;
      },
      { message: "deadlineReminderDays must not contain duplicates." },
    ),
});

export type UpdateNotificationPreferenceInput = z.infer<typeof updateNotificationPreferenceSchema>;

// ── Deadline watches ─────────────────────────────────────────────────────────

export const deadlineWatchDtoSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  courseIntakeId: z.string().uuid(),
  watchType: watchTypeSchema,
  nextReminderAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type DeadlineWatchDto = z.infer<typeof deadlineWatchDtoSchema>;

export const createDeadlineWatchSchema = z.object({
  studentId: z.string().uuid("studentId must be a valid UUID.").optional(),
  courseIntakeId: z.string().uuid("courseIntakeId must be a valid UUID."),
  watchType: watchTypeSchema,
});

export type CreateDeadlineWatchInput = z.infer<typeof createDeadlineWatchSchema>;

export const updateDeadlineWatchSchema = z.object({
  watchId: z.string().uuid(),
  watchType: watchTypeSchema.optional(),
  nextReminderAt: z.string().datetime().nullable().optional(),
});

export type UpdateDeadlineWatchInput = z.infer<typeof updateDeadlineWatchSchema>;

export const listDeadlineWatchesSchema = z.object({
  studentId: z.string().uuid().optional(),
  courseIntakeId: z.string().uuid().optional(),
  watchType: watchTypeSchema.optional(),
});

export type ListDeadlineWatchesInput = z.infer<typeof listDeadlineWatchesSchema>;

export const listDeadlineWatchesResponseSchema = z.object({
  watches: z.array(deadlineWatchDtoSchema),
});

export type ListDeadlineWatchesResponse = z.infer<typeof listDeadlineWatchesResponseSchema>;

// ── Worker job payloads ──────────────────────────────────────────────────────

export const notificationSendJobPayloadSchema = z.object({
  notificationId: z.string().uuid("notificationId must be a valid UUID."),
});

export type NotificationSendJobPayload = z.infer<typeof notificationSendJobPayloadSchema>;

export const deadlineCheckJobPayloadSchema = z.object({
  studentId: z.string().uuid().optional(),
  courseIntakeId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export type DeadlineCheckJobPayload = z.infer<typeof deadlineCheckJobPayloadSchema>;
