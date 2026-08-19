import { describe, it, expect } from "vitest";
import {
  createNotification,
  NotificationValidationError,
  validateNotification,
  calculateNextReminderAt,
  createNotificationPreference,
  createDeadlineWatch,
} from "./types";
import {
  NotificationService,
  scheduleDeadlineReminder,
  scheduleDeadlineReminders,
  createDeadlineNotification,
  sendNotification,
} from "./notification-service";
import { FakeNotificationProvider } from "./provider";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const STUDENT_ID = "22222222-2222-4222-8222-222222222222";
const INTAKE_ID = "33333333-3333-4333-8333-333333333333";

describe("Notification types", () => {
  it("creates a valid notification", () => {
    const n = createNotification({
      userId: USER_ID,
      channel: "email",
      notificationType: "deadline",
      title: "Deadline soon",
      body: "Your deadline is approaching",
    });
    expect(n.id).toBeDefined();
    expect(n.channel).toBe("email");
    expect(n.status).toBe("pending");
    expect(n.sentAt).toBeNull();
    validateNotification(n);
  });

  it("validates channel", () => {
    expect(() =>
      createNotification({
        userId: USER_ID,
        channel: "sms" as unknown as "email",
        notificationType: "system",
        title: "T",
        body: "B",
      }),
    ).toThrow(NotificationValidationError);
  });

  it("validates title length", () => {
    expect(() =>
      createNotification({
        userId: USER_ID,
        channel: "in_app",
        notificationType: "system",
        title: " ",
        body: "Body",
      }),
    ).toThrow(NotificationValidationError);
  });

  it("creates preference with defaults", () => {
    const pref = createNotificationPreference({ userId: USER_ID });
    expect(pref.emailEnabled).toBe(true);
    expect(pref.pushEnabled).toBe(true);
    expect(pref.deadlineReminderDays).toEqual([7, 3, 1]);
  });

  it("validates duplicate reminder days", () => {
    expect(() =>
      createNotificationPreference({ userId: USER_ID, deadlineReminderDays: [7, 7] }),
    ).toThrow(NotificationValidationError);
  });

  it("creates deadline watch", () => {
    const w = createDeadlineWatch({
      studentId: STUDENT_ID,
      courseIntakeId: INTAKE_ID,
      watchType: "deadline",
    });
    expect(w.watchType).toBe("deadline");
    expect(w.nextReminderAt).toBeNull();
  });
});

describe("calculateNextReminderAt", () => {
  const deadline = new Date("2026-02-01T00:00:00.000Z");

  it("returns earliest future candidate", () => {
    const now = new Date("2026-01-20T00:00:00.000Z");
    const next = calculateNextReminderAt(deadline, [7, 3, 1], now);
    // candidates: Jan25 (7), Jan29 (3), Jan31 (1) => earliest >= now is Jan25
    expect(next?.toISOString()).toBe("2026-01-25T00:00:00.000Z");
  });

  it("returns null when deadline is null", () => {
    const now = new Date("2026-01-20T00:00:00.000Z");
    expect(calculateNextReminderAt(null, [7, 3, 1], now)).toBeNull();
  });

  it("returns null when deadline already passed", () => {
    const past = new Date("2026-01-10T00:00:00.000Z");
    const now = new Date("2026-01-20T00:00:00.000Z");
    expect(calculateNextReminderAt(past, [7, 3, 1], now)).toBeNull();
  });

  it("returns null when all reminders in past", () => {
    const now = new Date("2026-01-31T12:00:00.000Z"); // after Jan31-1 but before deadline
    // deadline Feb1, reminders 7,3,1 => Jan25, Jan29, Jan31. All but maybe?
    // Now Jan31 12:00, candidates Jan25, Jan29, Jan31 00:00 -> all < now except deadline itself not candidate
    expect(calculateNextReminderAt(deadline, [7, 3, 1], now)).toBeNull();
  });

  it("picks the soonest future reminder when multiple", () => {
    const now = new Date("2026-01-26T00:00:00.000Z");
    const next = calculateNextReminderAt(deadline, [7, 3, 1], now);
    // Jan25 is past, Jan29 and Jan31 are future => picks Jan29
    expect(next?.toISOString()).toBe("2026-01-29T00:00:00.000Z");
  });

  it("handles unsorted input", () => {
    const now = new Date("2026-01-20T00:00:00.000Z");
    const next = calculateNextReminderAt(deadline, [1, 7, 3], now);
    expect(next?.toISOString()).toBe("2026-01-25T00:00:00.000Z");
  });
});

describe("scheduleDeadlineReminder", () => {
  it("calculates next_reminder_at based on deadline minus preference days", () => {
    const watch = createDeadlineWatch({
      studentId: STUDENT_ID,
      courseIntakeId: INTAKE_ID,
      watchType: "deadline",
    });
    const deadline = new Date("2026-09-15T00:00:00.000Z");
    const now = new Date("2026-09-01T00:00:00.000Z");
    const updated = scheduleDeadlineReminder(watch, deadline, [7, 3, 1], now);
    // candidates: Sep8, Sep12, Sep14 => picks Sep8
    expect(updated.nextReminderAt?.toISOString()).toBe("2026-09-08T00:00:00.000Z");
    // original unchanged
    expect(watch.nextReminderAt).toBeNull();
  });

  it("returns null when deadline is null", () => {
    const watch = createDeadlineWatch({
      studentId: STUDENT_ID,
      courseIntakeId: INTAKE_ID,
      watchType: "availability",
    });
    const now = new Date("2026-09-01T00:00:00.000Z");
    const updated = scheduleDeadlineReminder(watch, null, [7, 3, 1], now);
    expect(updated.nextReminderAt).toBeNull();
  });
});

describe("scheduleDeadlineReminders batch", () => {
  it("batch updates all watches", () => {
    const w1 = createDeadlineWatch({ studentId: STUDENT_ID, courseIntakeId: INTAKE_ID, watchType: "deadline" });
    const w2 = createDeadlineWatch({ studentId: STUDENT_ID, courseIntakeId: INTAKE_ID, watchType: "availability" });
    const deadline = new Date("2026-12-01T00:00:00.000Z");
    const now = new Date("2026-11-20T00:00:00.000Z");
    const result = scheduleDeadlineReminders(
      [w1, w2],
      () => deadline,
      () => [7, 3, 1],
      now,
    );
    expect(result).toHaveLength(2);
    expect(result[0]?.nextReminderAt?.toISOString()).toBe("2026-11-24T00:00:00.000Z"); // 7 days before
    expect(result[1]?.nextReminderAt?.toISOString()).toBe("2026-11-24T00:00:00.000Z");
  });
});

describe("NotificationService send", () => {
  it("sends via provider and marks sent", async () => {
    const service = new NotificationService();
    const provider = new FakeNotificationProvider();
    const n = service.createNotification({
      userId: USER_ID,
      channel: "email",
      notificationType: "billing",
      title: "Invoice paid",
      body: "Your invoice was paid",
    });
    const sent = await service.sendNotification(n, provider);
    expect(sent.status).toBe("sent");
    expect(sent.sentAt).toBeInstanceOf(Date);
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]?.notification.title).toBe("Invoice paid");
  });

  it("respects preferences (email disabled skips)", async () => {
    const provider = new FakeNotificationProvider();
    const n = createNotification({
      userId: USER_ID,
      channel: "email",
      notificationType: "application",
      title: "Update",
      body: "Status changed",
    });
    const pref = createNotificationPreference({ userId: USER_ID, emailEnabled: false });
    const result = await sendNotification(n, provider, pref);
    expect(result.status).toBe("pending");
    expect(provider.sent).toHaveLength(0);
  });

  it("in_app always deliverable even when email/push disabled", async () => {
    const provider = new FakeNotificationProvider();
    const n = createNotification({
      userId: USER_ID,
      channel: "in_app",
      notificationType: "system",
      title: "Hello",
      body: "World",
    });
    const pref = createNotificationPreference({ userId: USER_ID, emailEnabled: false, pushEnabled: false });
    const result = await sendNotification(n, provider, pref);
    expect(result.status).toBe("sent");
    expect(provider.sent).toHaveLength(1);
  });

  it("propagates provider failure", async () => {
    const provider = new FakeNotificationProvider();
    provider.shouldFail = true;
    const n = createNotification({
      userId: USER_ID,
      channel: "push",
      notificationType: "marketplace",
      title: "New message",
      body: "You have a new message",
    });
    await expect(sendNotification(n, provider)).rejects.toThrow("Fake provider simulated failure");
  });

  it("createDeadlineNotification builds title and payload", () => {
    const watch = createDeadlineWatch({
      studentId: STUDENT_ID,
      courseIntakeId: INTAKE_ID,
      watchType: "deadline",
    });
    const deadline = new Date("2026-10-15T00:00:00.000Z");
    const n = createDeadlineNotification({
      userId: USER_ID,
      watch,
      deadline,
      courseTitle: "BSc Computer Science",
      intakeYear: 2026,
    });
    expect(n.notificationType).toBe("deadline");
    expect(n.title).toContain("BSc Computer Science");
    expect(n.payload["deadline"]).toBe(deadline.toISOString());
    expect(n.channel).toBe("in_app");
  });
});

describe("NotificationService facade", () => {
  it("calculates next reminder via class", () => {
    const service = new NotificationService();
    const deadline = new Date("2026-05-01T00:00:00.000Z");
    const now = new Date("2026-04-20T00:00:00.000Z");
    const next = service.calculateNextReminderAt(deadline, [7, 3, 1], now);
    expect(next?.toISOString()).toBe("2026-04-24T00:00:00.000Z");
  });
});
