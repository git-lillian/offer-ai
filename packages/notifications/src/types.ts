/**
 * Notification interfaces.
 *
 * Foundation status: contract only. Delivery (email, push, in-app) is
 * future work, typically driven by `notification.send` background jobs.
 */

export const NOTIFICATION_CHANNELS = ["email", "push", "in_app", "sms"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export interface NotificationMessage {
  userId: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  referenceType: string | null;
  referenceId: string | null;
  correlationId: string | null;
}

export interface NotificationSender {
  send(message: NotificationMessage): Promise<void>;
}

export interface NotificationStore {
  enqueue(message: NotificationMessage): Promise<void>;
}
