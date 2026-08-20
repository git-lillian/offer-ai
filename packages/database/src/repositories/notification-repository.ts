import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";
import type {
  Notification,
  NotificationChannel,
  NotificationType,
  NotificationStatus,
  NotificationPreference,
  DeadlineWatch,
  WatchType,
} from "@offer-ai/notifications";

type Db = SupabaseClient<Database>;

// ── Mappers ───────────────────────────────────────────────────────────────────

function toNotification(
  row: Database["public"]["Tables"]["notifications"]["Row"],
): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    channel: row.channel as NotificationChannel,
    notificationType: row.notification_type as NotificationType,
    title: row.title,
    body: row.body,
    payload: (row.payload as Record<string, unknown>) ?? {},
    status: row.status as NotificationStatus,
    scheduledAt: new Date(row.scheduled_at),
    sentAt: row.sent_at ? new Date(row.sent_at) : null,
    createdAt: new Date(row.created_at),
  };
}

function toNotificationPreference(
  row: Database["public"]["Tables"]["notification_preferences"]["Row"],
): NotificationPreference {
  return {
    userId: row.user_id,
    emailEnabled: row.email_enabled,
    pushEnabled: row.push_enabled,
    deadlineReminderDays: [...(row.deadline_reminder_days ?? [])],
    createdAt: new Date(row.created_at),
  };
}

function toDeadlineWatch(
  row: Database["public"]["Tables"]["deadline_watches"]["Row"],
): DeadlineWatch {
  return {
    id: row.id,
    studentId: row.student_id,
    courseIntakeId: row.course_intake_id,
    watchType: row.watch_type as WatchType,
    nextReminderAt: row.next_reminder_at ? new Date(row.next_reminder_at) : null,
    createdAt: new Date(row.created_at),
  };
}

// ── Notification repository ──────────────────────────────────────────────────

export class NotificationRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Notification | null> {
    const { data, error } = await this.db.from("notifications").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toNotification(data);
  }

  async listByUser(userId: string, limit = 50): Promise<Notification[]> {
    const { data, error } = await this.db
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(toNotification);
  }

  async listPendingScheduled(now: Date = new Date(), limit = 50): Promise<Notification[]> {
    const { data, error } = await this.db
      .from("notifications")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(toNotification);
  }

  async create(notification: Notification): Promise<Notification> {
    const { data, error } = await this.db
      .from("notifications")
      .insert({
        id: notification.id,
        user_id: notification.userId,
        channel: notification.channel,
        notification_type: notification.notificationType,
        title: notification.title,
        body: notification.body,
        payload: notification.payload as never,
        status: notification.status,
        scheduled_at: notification.scheduledAt.toISOString(),
        sent_at: notification.sentAt?.toISOString() ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toNotification(data);
  }

  async update(notification: Notification): Promise<Notification> {
    const { data, error } = await this.db
      .from("notifications")
      .update({
        channel: notification.channel,
        notification_type: notification.notificationType,
        title: notification.title,
        body: notification.body,
        payload: notification.payload as never,
        status: notification.status,
        scheduled_at: notification.scheduledAt.toISOString(),
        sent_at: notification.sentAt?.toISOString() ?? null,
      })
      .eq("id", notification.id)
      .select("*")
      .single();
    if (error) throw error;
    return toNotification(data);
  }

  async markSent(id: string, sentAt: Date = new Date()): Promise<Notification> {
    const { data, error } = await this.db
      .from("notifications")
      .update({ status: "sent", sent_at: sentAt.toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toNotification(data);
  }

  async markFailed(id: string): Promise<Notification> {
    const { data, error } = await this.db
      .from("notifications")
      .update({ status: "failed", sent_at: null })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toNotification(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("notifications").delete().eq("id", id);
    if (error) throw error;
  }
}

// ── Notification preference repository ───────────────────────────────────────

export class NotificationPreferenceRepository {
  constructor(private readonly db: Db) {}

  async findByUserId(userId: string): Promise<NotificationPreference | null> {
    const { data, error } = await this.db
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toNotificationPreference(data);
  }

  async upsert(preference: NotificationPreference): Promise<NotificationPreference> {
    const { data, error } = await this.db
      .from("notification_preferences")
      .upsert(
        {
          user_id: preference.userId,
          email_enabled: preference.emailEnabled,
          push_enabled: preference.pushEnabled,
          deadline_reminder_days: preference.deadlineReminderDays,
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return toNotificationPreference(data);
  }

  async create(preference: NotificationPreference): Promise<NotificationPreference> {
    const { data, error } = await this.db
      .from("notification_preferences")
      .insert({
        user_id: preference.userId,
        email_enabled: preference.emailEnabled,
        push_enabled: preference.pushEnabled,
        deadline_reminder_days: preference.deadlineReminderDays,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toNotificationPreference(data);
  }

  async update(preference: NotificationPreference): Promise<NotificationPreference> {
    const { data, error } = await this.db
      .from("notification_preferences")
      .update({
        email_enabled: preference.emailEnabled,
        push_enabled: preference.pushEnabled,
        deadline_reminder_days: preference.deadlineReminderDays,
      })
      .eq("user_id", preference.userId)
      .select("*")
      .single();
    if (error) throw error;
    return toNotificationPreference(data);
  }

  async delete(userId: string): Promise<void> {
    const { error } = await this.db.from("notification_preferences").delete().eq("user_id", userId);
    if (error) throw error;
  }
}

// ── Deadline watch repository ────────────────────────────────────────────────

export class DeadlineWatchRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<DeadlineWatch | null> {
    const { data, error } = await this.db.from("deadline_watches").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toDeadlineWatch(data);
  }

  async listByStudent(studentId: string): Promise<DeadlineWatch[]> {
    const { data, error } = await this.db
      .from("deadline_watches")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toDeadlineWatch);
  }

  async listByCourseIntake(courseIntakeId: string): Promise<DeadlineWatch[]> {
    const { data, error } = await this.db
      .from("deadline_watches")
      .select("*")
      .eq("course_intake_id", courseIntakeId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toDeadlineWatch);
  }

  async listDue(now: Date = new Date(), limit = 50): Promise<DeadlineWatch[]> {
    const { data, error } = await this.db
      .from("deadline_watches")
      .select("*")
      .lte("next_reminder_at", now.toISOString())
      .order("next_reminder_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(toDeadlineWatch);
  }

  async create(watch: DeadlineWatch): Promise<DeadlineWatch> {
    const { data, error } = await this.db
      .from("deadline_watches")
      .insert({
        id: watch.id,
        student_id: watch.studentId,
        course_intake_id: watch.courseIntakeId,
        watch_type: watch.watchType,
        next_reminder_at: watch.nextReminderAt?.toISOString() ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toDeadlineWatch(data);
  }

  async update(watch: DeadlineWatch): Promise<DeadlineWatch> {
    const { data, error } = await this.db
      .from("deadline_watches")
      .update({
        watch_type: watch.watchType,
        next_reminder_at: watch.nextReminderAt?.toISOString() ?? null,
      })
      .eq("id", watch.id)
      .select("*")
      .single();
    if (error) throw error;
    return toDeadlineWatch(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("deadline_watches").delete().eq("id", id);
    if (error) throw error;
  }

  async findByStudentAndIntake(
    studentId: string,
    courseIntakeId: string,
    watchType: WatchType,
  ): Promise<DeadlineWatch | null> {
    const { data, error } = await this.db
      .from("deadline_watches")
      .select("*")
      .eq("student_id", studentId)
      .eq("course_intake_id", courseIntakeId)
      .eq("watch_type", watchType)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toDeadlineWatch(data);
  }
}
