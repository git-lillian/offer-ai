/**
 * Notification provider abstraction — interchangeable delivery backends.
 *
 * Application code never constructs a concrete email/push client directly and
 * never hard-codes provider credentials. Providers are used through this
 * interface, mirroring `packages/ai` provider abstraction.
 */

import type { Notification } from "./types";

export interface NotificationPayload {
  toUserId: string;
  channel: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
}

export interface NotificationProvider {
  readonly name: string;
  send(notification: Notification): Promise<void>;
}

export interface SentRecord {
  notification: Notification;
  sentAt: Date;
}

/**
 * Deterministic fake provider for tests and local development.
 * Records every notification passed to `send` so assertions can inspect delivery
 * without contacting an external email/push service. `shouldFail` can be
 * toggled to exercise failure handling.
 */
export class FakeNotificationProvider implements NotificationProvider {
  readonly name = "fake" as const;
  readonly sent: SentRecord[] = [];
  shouldFail = false;
  failMessage = "Fake provider simulated failure";

  async send(notification: Notification): Promise<void> {
    if (this.shouldFail) {
      throw new Error(this.failMessage);
    }
    this.sent.push({ notification: { ...notification }, sentAt: new Date() });
  }

  clear(): void {
    this.sent.length = 0;
  }

  get lastSent(): SentRecord | null {
    return this.sent[this.sent.length - 1] ?? null;
  }
}

export type NotificationProviderName = "fake" | "log";

export class LogNotificationProvider implements NotificationProvider {
  readonly name = "log" as const;

  async send(notification: Notification): Promise<void> {
    // Structured log for observability — no external call.
    // In production this would be replaced by email/push adapters.
    console.log(
      JSON.stringify({
        level: "info",
        message: "notification.send",
        channel: notification.channel,
        type: notification.notificationType,
        title: notification.title,
        userId: notification.userId,
        notificationId: notification.id,
      }),
    );
  }
}

export function createNotificationProvider(name: string = "fake"): NotificationProvider {
  if (name === "log") return new LogNotificationProvider();
  return new FakeNotificationProvider();
}
