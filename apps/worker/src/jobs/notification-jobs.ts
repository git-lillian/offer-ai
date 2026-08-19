/**
 * Notification jobs — durable, idempotent, RLS-free (service role).
 *
 * - notification.send: deliver a single notification via the provider abstraction
 * - deadline.check: scan deadline_watches where next_reminder_at <= now,
 *   create deadline notifications and re-schedule the next reminder.
 *
 * Delivery never happens inside an HTTP request; route handlers enqueue;
 * the worker executes. The provider abstraction keeps model/credential
 * details out of application code, mirroring `packages/ai`.
 */

import { createServiceSupabaseClient, JobQueue } from "@offer-ai/database";
import {
  NotificationRepository,
  NotificationPreferenceRepository,
  DeadlineWatchRepository,
  CourseIntakeRepository,
  CourseRepository,
  StudentProfileRepository,
} from "@offer-ai/database";
import { createNotificationProvider } from "@offer-ai/notifications";
import { sendNotification, createDeadlineNotification } from "@offer-ai/notifications";
import { calculateNextReminderAt } from "@offer-ai/notifications";
import {
  notificationSendJobPayloadSchema,
  deadlineCheckJobPayloadSchema,
} from "@offer-ai/contracts";
import type { JobContext, JobHandler } from "./registry";

/**
 * notification.send — deliver one inbox notification.
 *
 * Payload: { notificationId: uuid }
 * Idempotent: re-sending a notification that is already 'sent' is a no-op.
 * Failed deliveries throw so the job can be retried via the queue's backoff.
 */
export const notificationSendHandler: JobHandler = {
  kind: "notification.send",
  async handle(payload, context: JobContext): Promise<void> {
    const parsed = notificationSendJobPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Invalid notification.send payload: ${parsed.error.message}`);
    }
    const { notificationId } = parsed.data;

    context.logger.info("notification.send started", { notificationId });

    const service = createServiceSupabaseClient();
    const notificationRepo = new NotificationRepository(service as unknown as never);
    const preferenceRepo = new NotificationPreferenceRepository(service as unknown as never);

    const notification = await notificationRepo.findById(notificationId);
    if (!notification) {
      throw new Error(`Notification not found: ${notificationId}`);
    }

    // Already delivered — idempotent completion.
    if (notification.status === "sent") {
      context.logger.info("notification already sent, skipping", { notificationId });
      return;
    }

    // Respect user's channel preference (email/push). In-app always deliverable.
    const preferences = await preferenceRepo.findByUserId(notification.userId);

    // Provider abstraction — never construct email client inline.
    // Factory keeps credentials out of application code; defaults to fake/log.
    const providerName = process.env.NOTIFICATION_PROVIDER ?? "log";
    const provider = createNotificationProvider(providerName);

    try {
      const sent = await sendNotification(notification, provider, preferences ?? null);
      // If channel was disabled, sendNotification returns original pending without provider call.
      if (sent.status === "sent") {
        await notificationRepo.markSent(sent.id, sent.sentAt ?? new Date());
        context.logger.info("notification sent", {
          notificationId,
          channel: notification.channel,
          type: notification.notificationType,
        });
      } else {
        // Channel disabled — mark as failed so it does not retry forever, but log clearly.
        await notificationRepo.markFailed(notification.id);
        context.logger.info("notification skipped (channel disabled)", {
          notificationId,
          channel: notification.channel,
        });
      }
    } catch (error) {
      // Provider threw — mark failed and rethrow so the queue can retry with backoff.
      const message = error instanceof Error ? error.message : String(error);
      try {
        await notificationRepo.markFailed(notification.id);
      } catch (markError) {
        context.logger.error("failed to mark notification failed", {
          notificationId,
          error: markError instanceof Error ? markError.message : String(markError),
        });
      }
      throw new Error(`notification.send failed: ${message}`);
    }
  },
};

/**
 * deadline.check — scan deadline watches and emit reminder notifications.
 *
 * Payload: { studentId?: uuid, courseIntakeId?: uuid, limit?: number }
 * - If studentId or courseIntakeId filtered, only those watches are scanned.
 * - Otherwise scans watches where next_reminder_at <= now (due).
 * - For each due watch, creates an in_app deadline notification, enqueues
 *   notification.send, and recalculates next_reminder_at.
 *
 * Idempotent: re-running after a successful watch update will not re-emit
 * the same reminder because next_reminder_at is advanced beyond now.
 */
export const deadlineCheckHandler: JobHandler = {
  kind: "deadline.check",
  async handle(payload, context: JobContext): Promise<void> {
    const parsed = deadlineCheckJobPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Invalid deadline.check payload: ${parsed.error.message}`);
    }
    const { studentId, courseIntakeId, limit } = parsed.data;
    const cappedLimit = Math.min(limit, 50);

    context.logger.info("deadline.check started", { studentId, courseIntakeId, limit: cappedLimit });

    const service = createServiceSupabaseClient();
    const watchRepo = new DeadlineWatchRepository(service as unknown as never);
    const intakeRepo = new CourseIntakeRepository(service as unknown as never);
    const courseRepo = new CourseRepository(service as unknown as never);
    const studentRepo = new StudentProfileRepository(service as unknown as never);
    const preferenceRepo = new NotificationPreferenceRepository(service as unknown as never);
    const notificationRepo = new NotificationRepository(service as unknown as never);
    const queue = new JobQueue(service as unknown as never);

    // Resolve watches to check.
    let watches;
    if (studentId) {
      const all = await watchRepo.listByStudent(studentId);
      watches = all
        .filter((w) => !courseIntakeId || w.courseIntakeId === courseIntakeId)
        .filter((w) => w.nextReminderAt !== null && w.nextReminderAt.getTime() <= Date.now())
        .slice(0, cappedLimit);
    } else if (courseIntakeId) {
      const all = await watchRepo.listByCourseIntake(courseIntakeId);
      watches = all
        .filter((w) => w.nextReminderAt !== null && w.nextReminderAt.getTime() <= Date.now())
        .slice(0, cappedLimit);
    } else {
      watches = await watchRepo.listDue(new Date(), cappedLimit);
    }

    context.logger.info("deadline.check watches due", { count: watches.length });

    let emitted = 0;
    for (const watch of watches) {
      // Fetch intake deadline (volatile fact with provenance — never hard-coded)
      const intake = await intakeRepo.findById(watch.courseIntakeId);
      if (!intake) {
        context.logger.warn("deadline watch intake not found, skipping", {
          watchId: watch.id,
          courseIntakeId: watch.courseIntakeId,
        });
        continue;
      }

      // Fetch student profile to resolve auth user for notification.user_id
      const student = await studentRepo.findById(watch.studentId);
      if (!student || !student.userId) {
        context.logger.info("deadline watch student unclaimed or not found, skipping", {
          watchId: watch.id,
          studentId: watch.studentId,
        });
        // Still advance nextReminderAt so the unclaimed watch does not spin forever.
        // Calculate next reminder based on existing deadline + default days [7,3,1]
        const fallbackDays = [7, 3, 1];
        const next = calculateNextReminderAt(intake.applicationDeadline, fallbackDays, new Date());
        await watchRepo.update({ ...watch, nextReminderAt: next });
        continue;
      }

      const userId = student.userId;

      // Fetch preferences for deadline offsets; default to [7,3,1] if none.
      const pref = await preferenceRepo.findByUserId(userId);
      const reminderDays = pref?.deadlineReminderDays ?? [7, 3, 1];

      // Only emit if the watch is actually due (next_reminder_at <= now).
      // The listDue query already filtered, but respect the field for student-filtered path.
      if (watch.nextReminderAt && watch.nextReminderAt.getTime() > Date.now()) {
        continue;
      }

      // Watch type 'availability' does not have a deadline; skip deadline notifications.
      // In v1 we only emit for deadline watches with a known deadline.
      if (watch.watchType === "availability") {
        context.logger.info("deadline watch type availability, no deadline notification", {
          watchId: watch.id,
        });
        continue;
      }

      if (!intake.applicationDeadline) {
        context.logger.info("deadline watch intake has no deadline, skipping", {
          watchId: watch.id,
          courseIntakeId: watch.courseIntakeId,
        });
        // Keep nextReminderAt null so it doesn't retry constantly.
        if (watch.nextReminderAt !== null) {
          await watchRepo.update({ ...watch, nextReminderAt: null });
        }
        continue;
      }

      // Fetch course title for a helpful notification (optional, never fails the job).
      let courseTitle: string | undefined;
      try {
        const course = await courseRepo.findById(intake.courseId);
        courseTitle = course?.title;
      } catch {
        courseTitle = undefined;
      }

      // Create the in_app notification via domain helper (validates boundaries).
      const notification = createDeadlineNotification({
        userId,
        watch,
        deadline: intake.applicationDeadline,
        courseTitle,
        intakeYear: intake.intakeYear,
      });

      // Persist notification (service_role bypasses RLS).
      const saved = await notificationRepo.create(notification);

      // Enqueue delivery. Idempotency key prevents duplicate sends if deadline.check
      // is retried after a crash between create and enqueue.
      const idempotencyKey = `notification.send:${saved.id}`;
      await queue.enqueue({
        kind: "notification.send",
        payload: { notificationId: saved.id },
        idempotencyKey,
        correlationId: context.correlationId ?? undefined,
      });

      // Advance watch to next reminder.
      const nextReminderAt = calculateNextReminderAt(
        intake.applicationDeadline,
        reminderDays,
        new Date(),
      );
      await watchRepo.update({ ...watch, nextReminderAt });

      context.logger.info("deadline reminder emitted", {
        watchId: watch.id,
        notificationId: saved.id,
        studentId: watch.studentId,
        courseIntakeId: watch.courseIntakeId,
        nextReminderAt: nextReminderAt?.toISOString() ?? null,
      });
      emitted += 1;
    }

    context.logger.info("deadline.check completed", { checked: watches.length, emitted });
  },
};
