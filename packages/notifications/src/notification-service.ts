/**
 * NotificationService — pure domain operations for notification delivery
 * and deadline monitoring.
 *
 * Framework-free: no Next/React/Supabase/Stripe imports. All functions are
 * deterministic and validate inputs with typed NotificationError subclasses.
 * Persistence is the caller's concern; the service returns new immutable objects.
 *
 * Deadline monitoring: volatile facts (deadlines) live in the catalogue with
 * provenance (`catalog_course_intakes.application_deadline`). The service
 * calculates `next_reminder_at` as `deadline - preference_days` and picks the
 * soonest future candidate (see types.calculateNextReminderAt).
 * The LLM never decides eligibility and never decides deadlines — rules and
 * catalogue data do.
 */

import {
  NotificationValidationError,
  type Notification,
  type NotificationPreference,
  type DeadlineWatch,
  type CreateNotificationInput,
  type CreateDeadlineWatchInput,
  createNotification as createNotificationEntity,
  createDeadlineWatch as createDeadlineWatchEntity,
  createNotificationPreference,
  validateNotification,
  validateNotificationPreference,
  validateDeadlineWatch,
  calculateNextReminderAt,
  markNotificationSent,
  markNotificationFailed,
  canDeliverNotification,
} from "./types";
import type { NotificationProvider } from "./provider";

export type { NotificationProvider } from "./provider";
export { FakeNotificationProvider } from "./provider";

// ── Create notification ─────────────────────────────────────────────────────

export function createNotification(input: CreateNotificationInput): Notification {
  return createNotificationEntity(input);
}

export function validateNotificationEntity(notification: Notification): void {
  validateNotification(notification);
}

// ── Send via provider ───────────────────────────────────────────────────────

/**
 * Sends a notification through the provider abstraction.
 * Respects the recipient's channel preference (email/push) via canDeliverNotification:
 * if the channel is disabled, the notification is not sent and the original
 * pending notification is returned unchanged (caller may skip or mark failed).
 * Throws NotificationValidationError for invalid inputs; rethrows provider errors
 * as-is so the caller (worker) can mark the notification failed and retry.
 */
export async function sendNotification(
  notification: Notification,
  provider: NotificationProvider,
  preferences?: NotificationPreference | null,
): Promise<Notification> {
  validateNotification(notification);
  if (!provider || typeof provider.send !== "function") {
    throw new NotificationValidationError("provider must implement send().", { field: "provider" });
  }
  if (preferences) {
    validateNotificationPreference(preferences);
    if (!canDeliverNotification(notification, preferences)) {
      // Channel disabled — do not attempt delivery; caller may choose to mark
      // as failed or keep pending. We return the original notification unchanged
      // so tests can assert the skip. Worker will not mark sent.
      return notification;
    }
  }
  await provider.send(notification);
  return markNotificationSent(notification, new Date());
}

export function markSent(notification: Notification, sentAt: Date = new Date()): Notification {
  return markNotificationSent(notification, sentAt);
}

export function markFailed(notification: Notification): Notification {
  return markNotificationFailed(notification);
}

// ── Deadline reminder scheduling ────────────────────────────────────────────

/**
 * Calculates the next_reminder_at for a single deadline watch.
 * Pure: does not mutate, does not persist.
 *
 * @param watch - the watch to schedule
 * @param deadline - intake's application_deadline (null when unknown/closed)
 * @param reminderDays - preference deadline_reminder_days (e.g. [7,3,1])
 * @param now - injection for determinism in tests
 */
export function scheduleDeadlineReminder(
  watch: DeadlineWatch,
  deadline: Date | null,
  reminderDays: number[],
  now: Date = new Date(),
): DeadlineWatch {
  validateDeadlineWatch(watch);
  if (deadline !== null && !(deadline instanceof Date)) {
    throw new NotificationValidationError("deadline must be Date or null.", { field: "deadline" });
  }
  if (deadline instanceof Date && Number.isNaN(deadline.getTime())) {
    throw new NotificationValidationError("deadline must be valid date.", { field: "deadline" });
  }
  const nextReminderAt = calculateNextReminderAt(deadline, reminderDays, now);
  return {
    ...watch,
    nextReminderAt,
  };
}

/**
 * Batch version: given multiple watches and a resolver for deadline + preferences,
 * calculates next_reminder_at for each. The caller supplies:
 * - getDeadline: (watch) => deadline | null
 * - getReminderDays: (watch) => number[]  (from student's NotificationPreference)
 *
 * Returns a new array (does not mutate input).
 */
export function scheduleDeadlineReminders(
  watches: readonly DeadlineWatch[],
  getDeadline: (watch: DeadlineWatch) => Date | null,
  getReminderDays: (watch: DeadlineWatch) => number[],
  now: Date = new Date(),
): DeadlineWatch[] {
  if (!Array.isArray(watches)) {
    throw new NotificationValidationError("watches must be an array.", { field: "watches" });
  }
  return watches.map((watch) => {
    const deadline = getDeadline(watch);
    const days = getReminderDays(watch);
    return scheduleDeadlineReminder(watch, deadline, days, now);
  });
}

// ── Deadline watch creation ─────────────────────────────────────────────────

export function createDeadlineWatch(input: CreateDeadlineWatchInput): DeadlineWatch {
  return createDeadlineWatchEntity(input);
}

/**
 * Creates a notification from a due deadline watch.
 * The caller (worker) typically creates one notification per watch whose
 * next_reminder_at <= now, using the intake's deadline and course title
 * to craft a useful inbox message.
 */
export function createDeadlineNotification(input: {
  userId: string;
  watch: DeadlineWatch;
  deadline: Date | null;
  courseTitle?: string;
  intakeYear?: number;
  scheduledAt?: Date;
}): Notification {
  if (!input.watch) {
    throw new NotificationValidationError("watch is required.", { field: "watch" });
  }
  validateDeadlineWatch(input.watch);
  if (input.deadline !== null && !(input.deadline instanceof Date)) {
    throw new NotificationValidationError("deadline must be Date or null.", { field: "deadline" });
  }
  const courseLabel = input.courseTitle ? ` for ${input.courseTitle}` : "";
  const yearLabel = input.intakeYear ? ` (${String(input.intakeYear)})` : "";
  const deadlineLabel = input.deadline ? input.deadline.toISOString().slice(0, 10) : "soon";
  const title = `Application deadline approaching${courseLabel}${yearLabel}`;
  const body =
    input.deadline !== null
      ? `Your watched course${courseLabel} has an application deadline on ${deadlineLabel}. Please review your application and ensure all requirements are met.`
      : `Your watched course${courseLabel} deadline is approaching. Please check the course page for the latest deadline.`;
  return createNotificationEntity({
    userId: input.userId,
    channel: "in_app",
    notificationType: "deadline",
    title,
    body,
    payload: {
      watchId: input.watch.id,
      studentId: input.watch.studentId,
      courseIntakeId: input.watch.courseIntakeId,
      watchType: input.watch.watchType,
      deadline: input.deadline ? input.deadline.toISOString() : null,
    },
    scheduledAt: input.scheduledAt ?? new Date(),
  });
}

// ── Preferences ─────────────────────────────────────────────────────────────

export function createPreference(input: Parameters<typeof createNotificationPreference>[0]): NotificationPreference {
  return createNotificationPreference(input);
}

// ── Class façade (optional, mirrors BillingService/MarketplaceService) ───────

export class NotificationService {
  createNotification(input: CreateNotificationInput): Notification {
    return createNotification(input);
  }

  async sendNotification(
    notification: Notification,
    provider: NotificationProvider,
    preferences?: NotificationPreference | null,
  ): Promise<Notification> {
    return sendNotification(notification, provider, preferences);
  }

  markSent(notification: Notification, sentAt?: Date): Notification {
    return markSent(notification, sentAt);
  }

  markFailed(notification: Notification): Notification {
    return markFailed(notification);
  }

  scheduleDeadlineReminder(
    watch: DeadlineWatch,
    deadline: Date | null,
    reminderDays: number[],
    now?: Date,
  ): DeadlineWatch {
    return scheduleDeadlineReminder(watch, deadline, reminderDays, now);
  }

  scheduleDeadlineReminders(
    watches: readonly DeadlineWatch[],
    getDeadline: (watch: DeadlineWatch) => Date | null,
    getReminderDays: (watch: DeadlineWatch) => number[],
    now?: Date,
  ): DeadlineWatch[] {
    return scheduleDeadlineReminders(watches, getDeadline, getReminderDays, now);
  }

  createDeadlineWatch(input: CreateDeadlineWatchInput): DeadlineWatch {
    return createDeadlineWatch(input);
  }

  createDeadlineNotification(input: Parameters<typeof createDeadlineNotification>[0]): Notification {
    return createDeadlineNotification(input);
  }

  createPreference(input: Parameters<typeof createNotificationPreference>[0]): NotificationPreference {
    return createPreference(input);
  }

  calculateNextReminderAt(
    deadline: Date | null,
    reminderDays: number[],
    now?: Date,
  ): Date | null {
    return calculateNextReminderAt(deadline, reminderDays, now);
  }
}
