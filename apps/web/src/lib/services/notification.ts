import "server-only";

import {
  NotificationRepository,
  NotificationPreferenceRepository,
  DeadlineWatchRepository,
  CourseIntakeRepository,
  StudentProfileRepository,
} from "@offer-ai/database";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import {
  NotificationService,
  isNotificationError,
  NotificationNotFoundError,
  NotificationValidationError,
  calculateNextReminderAt,
  updateNotificationPreference,
} from "@offer-ai/notifications";
import type {
  Notification,
  NotificationPreference,
  DeadlineWatch,
  CreateNotificationInput,
  CreateDeadlineWatchInput,
} from "@offer-ai/notifications";

type ServerClient = Awaited<ReturnType<typeof getServerClient>>;

const notificationDomain = new NotificationService();

// ── DTO mappers (domain -> API shape) ───────────────────────────────────────

export function toNotificationDto(notification: Notification) {
  return {
    id: notification.id,
    userId: notification.userId,
    channel: notification.channel,
    notificationType: notification.notificationType,
    title: notification.title,
    body: notification.body,
    payload: notification.payload,
    status: notification.status,
    scheduledAt: notification.scheduledAt.toISOString(),
    sentAt: notification.sentAt ? notification.sentAt.toISOString() : null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export function toPreferenceDto(preference: NotificationPreference) {
  return {
    userId: preference.userId,
    emailEnabled: preference.emailEnabled,
    pushEnabled: preference.pushEnabled,
    deadlineReminderDays: [...preference.deadlineReminderDays],
    createdAt: preference.createdAt.toISOString(),
  };
}

export function toWatchDto(watch: DeadlineWatch) {
  return {
    id: watch.id,
    studentId: watch.studentId,
    courseIntakeId: watch.courseIntakeId,
    watchType: watch.watchType,
    nextReminderAt: watch.nextReminderAt ? watch.nextReminderAt.toISOString() : null,
    createdAt: watch.createdAt.toISOString(),
  };
}

// ── Application service ────────────────────────────────────────────────────

export class NotificationApplicationService {
  constructor(private readonly supabase: ServerClient) {}

  private get serviceSupabase() {
    return getServiceClient();
  }

  // ── Notifications ──────────────────────────────────────────────────────

  async listNotificationsForUser(
    userId: string,
    opts: {
      limit?: number;
      page?: number;
      status?: string;
      channel?: string;
      notificationType?: string;
    } = {},
  ): Promise<{ notifications: Notification[]; total: number }> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const page = Math.max(opts.page ?? 1, 1);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (opts.status) {
      query = query.eq("status", opts.status);
    }
    if (opts.channel) {
      query = query.eq("channel", opts.channel);
    }
    if (opts.notificationType) {
      query = query.eq("notification_type", opts.notificationType);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    const notifications: Notification[] = (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      channel: row.channel as Notification["channel"],
      notificationType: row.notification_type as Notification["notificationType"],
      title: row.title,
      body: row.body,
      payload: (row.payload as Record<string, unknown>) ?? {},
      status: row.status as Notification["status"],
      scheduledAt: new Date(row.scheduled_at),
      sentAt: row.sent_at ? new Date(row.sent_at) : null,
      createdAt: new Date(row.created_at),
    }));

    return { notifications, total: count ?? notifications.length };
  }

  async countPendingForUser(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending");
    if (error) return 0;
    return count ?? 0;
  }

  async getNotificationForUser(userId: string, notificationId: string): Promise<Notification> {
    const repo = new NotificationRepository(this.supabase);
    const notification = await repo.findById(notificationId);
    if (!notification) {
      throw new NotificationNotFoundError("Notification not found.");
    }
    if (notification.userId !== userId) {
      throw new NotificationNotFoundError("Notification not found.");
    }
    return notification;
  }

  async createNotificationForUser(
    userId: string,
    input: {
      channel: CreateNotificationInput["channel"];
      notificationType: CreateNotificationInput["notificationType"];
      title: string;
      body: string;
      payload?: Record<string, unknown>;
      scheduledAt?: string | null;
    },
  ): Promise<Notification> {
    const candidate: CreateNotificationInput = {
      userId,
      channel: input.channel,
      notificationType: input.notificationType,
      title: input.title,
      body: input.body,
      payload: input.payload ?? {},
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      sentAt: null,
    };
    if (candidate.scheduledAt && Number.isNaN(candidate.scheduledAt.getTime())) {
      throw new NotificationValidationError("scheduledAt must be a valid date.", { field: "scheduledAt" });
    }
    const notification = notificationDomain.createNotification(candidate);
    const serviceRepo = new NotificationRepository(this.serviceSupabase);
    return serviceRepo.create(notification);
  }

  async markSentForUser(userId: string, notificationId: string): Promise<Notification> {
    // Verify ownership via RLS client
    const notification = await this.getNotificationForUser(userId, notificationId);
    // Domain transition
    const updated = notificationDomain.markSent(notification, new Date());
    void updated;
    const serviceRepo = new NotificationRepository(this.serviceSupabase);
    // Use service client markSent which enforces DB invariants
    const result = await serviceRepo.markSent(notificationId, new Date());
    // Validate result shape
    if (result.userId !== userId) {
      throw new NotificationNotFoundError("Notification not found.");
    }
    return result;
  }

  async markFailedForUser(userId: string, notificationId: string): Promise<Notification> {
    await this.getNotificationForUser(userId, notificationId);
    const serviceRepo = new NotificationRepository(this.serviceSupabase);
    const result = await serviceRepo.markFailed(notificationId);
    if (result.userId !== userId) {
      throw new NotificationNotFoundError("Notification not found.");
    }
    return result;
  }

  // ── Preferences ────────────────────────────────────────────────────────

  async getPreferencesForUser(userId: string): Promise<NotificationPreference | null> {
    const repo = new NotificationPreferenceRepository(this.supabase);
    return repo.findByUserId(userId);
  }

  async ensurePreferencesForUser(userId: string): Promise<NotificationPreference> {
    const repo = new NotificationPreferenceRepository(this.supabase);
    const existing = await repo.findByUserId(userId);
    if (existing) return existing;
    // Create default via domain
    const pref = notificationDomain.createPreference({ userId });
    return repo.upsert(pref);
  }

  async upsertPreferencesForUser(
    userId: string,
    input: {
      emailEnabled?: boolean;
      pushEnabled?: boolean;
      deadlineReminderDays?: number[];
    },
  ): Promise<NotificationPreference> {
    const repo = new NotificationPreferenceRepository(this.supabase);
    const existing = await repo.findByUserId(userId);
    if (existing) {
      const updated = updateNotificationPreference(existing, input);
      // repo.update expects full object
      return repo.update(updated);
    }
    // Create new via domain (applies defaults)
    const created = notificationDomain.createPreference({
      userId,
      emailEnabled: input.emailEnabled,
      pushEnabled: input.pushEnabled,
      deadlineReminderDays: input.deadlineReminderDays,
    });
    return repo.upsert(created);
  }

  async updatePreferencesForUser(
    userId: string,
    input: {
      emailEnabled?: boolean;
      pushEnabled?: boolean;
      deadlineReminderDays?: number[];
    },
  ): Promise<NotificationPreference> {
    return this.upsertPreferencesForUser(userId, input);
  }

  // ── Deadline watches ───────────────────────────────────────────────────

  async listWatchesForUser(userId: string): Promise<DeadlineWatch[]> {
    const profileRepo = new StudentProfileRepository(this.supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) {
      // No student profile yet — return empty rather than 404 for page convenience,
      // but API layer may choose to throw NotFoundError. For service we return empty.
      return [];
    }
    const repo = new DeadlineWatchRepository(this.supabase);
    return repo.listByStudent(profile.id);
  }

  async listWatchesForStudentUserOrThrow(userId: string): Promise<DeadlineWatch[]> {
    const profileRepo = new StudentProfileRepository(this.supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotificationNotFoundError("Student profile not found. Complete onboarding first.");
    }
    const repo = new DeadlineWatchRepository(this.supabase);
    return repo.listByStudent(profile.id);
  }

  async createWatchForUser(
    userId: string,
    input: {
      courseIntakeId: string;
      watchType: CreateDeadlineWatchInput["watchType"];
    },
  ): Promise<DeadlineWatch> {
    const profileRepo = new StudentProfileRepository(this.supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotificationValidationError("Student profile not found. Complete onboarding first.", {
        field: "studentId",
      });
    }

    const intakeRepo = new CourseIntakeRepository(this.supabase);
    const intake = await intakeRepo.findById(input.courseIntakeId);
    if (!intake) {
      throw new NotificationNotFoundError("Course intake not found.");
    }

    // Check duplicate
    const watchRepo = new DeadlineWatchRepository(this.supabase);
    const existing = await watchRepo.findByStudentAndIntake(profile.id, input.courseIntakeId, input.watchType);
    if (existing) {
      throw new NotificationValidationError("Watch already exists for this intake and type.", {
        field: "courseIntakeId",
      });
    }

    // Preferences for reminderDays
    const prefRepo = new NotificationPreferenceRepository(this.supabase);
    const pref = await prefRepo.findByUserId(userId);
    const reminderDays = pref?.deadlineReminderDays ?? [7, 3, 1];

    const deadline = intake.applicationDeadline;
    const nextReminderAt = calculateNextReminderAt(deadline, reminderDays, new Date());

    const domainInput: CreateDeadlineWatchInput = {
      studentId: profile.id,
      courseIntakeId: input.courseIntakeId,
      watchType: input.watchType,
      nextReminderAt,
    };

    const watch = notificationDomain.createDeadlineWatch(domainInput);
    return watchRepo.create(watch);
  }

  async deleteWatchForUser(userId: string, watchId: string): Promise<void> {
    const profileRepo = new StudentProfileRepository(this.supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotificationNotFoundError("Student profile not found.");
    }
    const repo = new DeadlineWatchRepository(this.supabase);
    const watch = await repo.findById(watchId);
    if (!watch) {
      throw new NotificationNotFoundError("Watch not found.");
    }
    if (watch.studentId !== profile.id) {
      throw new NotificationNotFoundError("Watch not found.");
    }
    await repo.delete(watchId);
  }
}

// ── Factories ────────────────────────────────────────────────────────────

export async function createNotificationService(): Promise<NotificationApplicationService> {
  const supabase = await getServerClient();
  return new NotificationApplicationService(supabase);
}

export function createNotificationServiceWithServiceRole(): NotificationApplicationService {
  // Service role client bypasses RLS; still respects domain checks
  const supabase = getServiceClient() as unknown as ServerClient;
  return new NotificationApplicationService(supabase);
}

export { isNotificationError };
