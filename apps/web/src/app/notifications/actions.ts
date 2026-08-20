"use server";

import { revalidatePath } from "next/cache";
import {
  createNotificationSchema,
  updateNotificationPreferenceSchema,
  createDeadlineWatchSchema,
} from "@offer-ai/contracts";
import { isNotificationError } from "@offer-ai/notifications";
import { requireUser } from "@/lib/auth";
import { createNotificationService } from "@/lib/services/notification";

export type NotificationActionState = {
  error?: string;
  ok?: boolean;
  notificationId?: string;
  watchId?: string;
};

function parseDeadlineDays(raw: FormDataEntryValue | null): number[] | undefined {
  if (raw === null || raw === "") return undefined;
  const str = String(raw).trim();
  if (str === "") return undefined;
  // Accept comma or space separated
  const parts = str
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const nums: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (Number.isNaN(n) || !Number.isInteger(n)) return undefined; // let zod catch
    nums.push(n);
  }
  return nums;
}

// ── Notifications ─────────────────────────────────────────────────────────

export async function markSentAction(formData: FormData): Promise<NotificationActionState> {
  const notificationId = String(formData.get("notificationId") ?? "").trim();
  if (!notificationId) return { error: "notificationId is required." };
  try {
    const user = await requireUser();
    const service = await createNotificationService();
    const result = await service.markSentForUser(user.id, notificationId);
    revalidatePath("/notifications");
    return { ok: true, notificationId: result.id };
  } catch (error) {
    if (isNotificationError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to mark notification as sent." };
  }
}

export async function markFailedAction(formData: FormData): Promise<NotificationActionState> {
  const notificationId = String(formData.get("notificationId") ?? "").trim();
  if (!notificationId) return { error: "notificationId is required." };
  try {
    const user = await requireUser();
    const service = await createNotificationService();
    const result = await service.markFailedForUser(user.id, notificationId);
    revalidatePath("/notifications");
    return { ok: true, notificationId: result.id };
  } catch (error) {
    if (isNotificationError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to mark notification as failed." };
  }
}

export async function createNotificationAction(
  _prevState: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  try {
    const user = await requireUser();
    const raw = {
      channel: formData.get("channel"),
      notificationType: formData.get("notificationType"),
      title: formData.get("title"),
      body: formData.get("body"),
      payload: (() => {
        const v = formData.get("payload");
        if (!v) return {};
        try {
          const parsed = JSON.parse(String(v));
          if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
        } catch {
          return {};
        }
        return {};
      })(),
      scheduledAt: formData.get("scheduledAt") ? String(formData.get("scheduledAt")) : null,
    };
    const parsed = createNotificationSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }
    const service = await createNotificationService();
    const notification = await service.createNotificationForUser(user.id, {
      channel: parsed.data.channel,
      notificationType: parsed.data.notificationType,
      title: parsed.data.title,
      body: parsed.data.body,
      payload: parsed.data.payload,
      scheduledAt: parsed.data.scheduledAt ?? null,
    });
    revalidatePath("/notifications");
    return { ok: true, notificationId: notification.id };
  } catch (error) {
    if (isNotificationError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to create notification." };
  }
}

// ── Preferences ──────────────────────────────────────────────────────────

export async function updatePreferencesAction(
  _prevState: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  try {
    const user = await requireUser();
    // Checkbox semantics: when checked formData contains "true"/"on", when unchecked it's absent => false
    const emailEnabled = String(formData.get("emailEnabled") ?? "") === "true" || String(formData.get("emailEnabled") ?? "") === "on";
    const pushEnabled = String(formData.get("pushEnabled") ?? "") === "true" || String(formData.get("pushEnabled") ?? "") === "on";
    const daysRaw = formData.get("deadlineReminderDays");
    const deadlineReminderDays = parseDeadlineDays(daysRaw);

    const candidate: Record<string, unknown> = {
      emailEnabled,
      pushEnabled,
    };
    if (daysRaw !== null && String(daysRaw).trim() !== "") {
      // If parsing produced undefined but input was non-empty, treat as validation error via zod by passing raw array with string
      if (deadlineReminderDays === undefined) {
        // Force zod error: pass invalid array with string
        candidate.deadlineReminderDays = String(daysRaw)
          .split(",")
          .map((s) => s.trim());
      } else {
        candidate.deadlineReminderDays = deadlineReminderDays;
      }
    }

    const parsed = updateNotificationPreferenceSchema.safeParse(candidate);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const service = await createNotificationService();
    await service.upsertPreferencesForUser(user.id, parsed.data);
    revalidatePath("/notifications/preferences");
    revalidatePath("/notifications");
    return { ok: true };
  } catch (error) {
    if (isNotificationError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to update preferences." };
  }
}

// ── Watches ───────────────────────────────────────────────────────────────

export async function createWatchAction(
  _prevState: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  try {
    const user = await requireUser();
    const raw = {
      courseIntakeId: String(formData.get("courseIntakeId") ?? "").trim(),
      watchType: String(formData.get("watchType") ?? "deadline"),
    };
    const parsed = createDeadlineWatchSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }
    const service = await createNotificationService();
    const watch = await service.createWatchForUser(user.id, {
      courseIntakeId: parsed.data.courseIntakeId,
      watchType: parsed.data.watchType,
    });
    revalidatePath("/notifications/watches");
    revalidatePath("/notifications");
    return { ok: true, watchId: watch.id };
  } catch (error) {
    if (isNotificationError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to create watch." };
  }
}

export async function deleteWatchAction(formData: FormData): Promise<NotificationActionState> {
  const watchId = String(formData.get("watchId") ?? "").trim();
  if (!watchId) return { error: "watchId is required." };
  try {
    const user = await requireUser();
    const service = await createNotificationService();
    await service.deleteWatchForUser(user.id, watchId);
    revalidatePath("/notifications/watches");
    revalidatePath("/notifications");
    return { ok: true, watchId };
  } catch (error) {
    if (isNotificationError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to delete watch." };
  }
}

// Aliases for ergonomic imports matching prompt description
export const markSent = markSentAction;
export const markFailed = markFailedAction;
export const updatePreferences = updatePreferencesAction;
export const createWatch = createWatchAction;
export const deleteWatch = deleteWatchAction;
