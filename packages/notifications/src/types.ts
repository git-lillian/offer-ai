/**
 * Notifications domain — delivery abstraction for deadline monitoring,
 * course updates, marketplace messages, billing events and system alerts.
 *
 * Framework-free: no Next/React/Supabase/Stripe imports. Validation uses
 * typed domain errors. Persistence is the caller's concern.
 */

export abstract class NotificationError extends Error {
  abstract readonly code: string;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class NotificationValidationError extends NotificationError {
  readonly code = "NOTIFICATION_VALIDATION_ERROR";
  constructor(message = "The provided notification input is invalid.", details?: Record<string, unknown>) {
    super(message, 400, details);
  }
}

export class NotificationNotFoundError extends NotificationError {
  readonly code = "NOTIFICATION_NOT_FOUND";
  constructor(message = "Notification not found.") {
    super(message, 404);
  }
}

export function isNotificationError(error: unknown): error is NotificationError {
  return error instanceof NotificationError;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const NOTIFICATION_CHANNELS = ["email", "push", "in_app"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_TYPES = ["deadline", "application", "marketplace", "billing", "system"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_STATUSES = ["pending", "sent", "failed"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const WATCH_TYPES = ["deadline", "availability"] as const;
export type WatchType = (typeof WATCH_TYPES)[number];

// ── Type guards ──────────────────────────────────────────────────────────────

export function isNotificationChannel(value: string): value is NotificationChannel {
  return (NOTIFICATION_CHANNELS as readonly string[]).includes(value);
}

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export function isNotificationStatus(value: string): value is NotificationStatus {
  return (NOTIFICATION_STATUSES as readonly string[]).includes(value);
}

export function isWatchType(value: string): value is WatchType {
  return (WATCH_TYPES as readonly string[]).includes(value);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function assertUuid(value: string, field: string): void {
  if (!isUuid(value)) {
    throw new NotificationValidationError(`${field} must be a valid UUID.`, { field });
  }
}

function assertTrimmedLength(value: string, field: string, min: number, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new NotificationValidationError(`${field} is required.`, { field });
  }
  if (trimmed.length > max) {
    throw new NotificationValidationError(`${field} must be ${max} characters or fewer.`, { field });
  }
  return trimmed;
}

function assertDate(value: Date, field: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new NotificationValidationError(`${field} must be a valid Date.`, { field });
  }
}

function assertNullableDate(value: Date | null, field: string): void {
  if (value !== null) assertDate(value, field);
}

// ── Notification ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  channel: NotificationChannel;
  notificationType: NotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  scheduledAt: Date;
  sentAt: Date | null;
  createdAt: Date;
}

export interface CreateNotificationInput {
  userId: string;
  channel: NotificationChannel;
  notificationType: NotificationType;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  status?: NotificationStatus;
  scheduledAt?: Date;
  sentAt?: Date | null;
}

export function validateCreateNotificationInput(input: CreateNotificationInput): void {
  assertUuid(input.userId, "userId");
  if (!isNotificationChannel(input.channel)) {
    throw new NotificationValidationError(`Invalid channel "${input.channel}".`, { field: "channel" });
  }
  if (!isNotificationType(input.notificationType)) {
    throw new NotificationValidationError(`Invalid notification_type "${input.notificationType}".`, {
      field: "notificationType",
    });
  }
  assertTrimmedLength(input.title, "title", 1, 200);
  assertTrimmedLength(input.body, "body", 1, 5000);
  if (input.payload !== undefined) {
    if (
      typeof input.payload !== "object" ||
      input.payload === null ||
      Array.isArray(input.payload)
    ) {
      throw new NotificationValidationError("payload must be a non-array object.", { field: "payload" });
    }
  }
  if (input.status !== undefined && !isNotificationStatus(input.status)) {
    throw new NotificationValidationError(`Invalid status "${input.status}".`, { field: "status" });
  }
  if (input.scheduledAt !== undefined) assertDate(input.scheduledAt, "scheduledAt");
  if (input.sentAt !== undefined) assertNullableDate(input.sentAt, "sentAt");
  if (input.status === "sent" && input.sentAt === null) {
    throw new NotificationValidationError("sent notification must have sentAt.", { field: "sentAt" });
  }
  if (input.status !== undefined && input.status !== "sent" && input.sentAt !== null && input.sentAt !== undefined) {
    throw new NotificationValidationError("only sent notifications may have sentAt.", { field: "sentAt" });
  }
}

export function createNotification(input: CreateNotificationInput): Notification {
  validateCreateNotificationInput(input);
  const now = new Date();
  const status = input.status ?? "pending";
  const sentAt = status === "sent" ? (input.sentAt ?? now) : null;
  // Enforce invariant: sent requires sentAt, others require null.
  if (status === "sent" && sentAt === null) {
    throw new NotificationValidationError("sent notification must have sentAt.", { field: "sentAt" });
  }
  if (status !== "sent" && sentAt !== null) {
    throw new NotificationValidationError("only sent notifications may have sentAt.", { field: "sentAt" });
  }
  return {
    id: crypto.randomUUID(),
    userId: input.userId,
    channel: input.channel,
    notificationType: input.notificationType,
    title: input.title.trim(),
    body: input.body.trim(),
    payload: input.payload ? { ...input.payload } : {},
    status,
    scheduledAt: input.scheduledAt ?? now,
    sentAt,
    createdAt: now,
  };
}

export function validateNotification(value: Notification): void {
  assertUuid(value.id, "id");
  assertUuid(value.userId, "userId");
  if (!isNotificationChannel(value.channel)) {
    throw new NotificationValidationError(`Invalid channel "${value.channel}".`, { field: "channel" });
  }
  if (!isNotificationType(value.notificationType)) {
    throw new NotificationValidationError(`Invalid type "${value.notificationType}".`, { field: "notificationType" });
  }
  assertTrimmedLength(value.title, "title", 1, 200);
  assertTrimmedLength(value.body, "body", 1, 5000);
  if (typeof value.payload !== "object" || value.payload === null || Array.isArray(value.payload)) {
    throw new NotificationValidationError("payload must be object.", { field: "payload" });
  }
  if (!isNotificationStatus(value.status)) {
    throw new NotificationValidationError(`Invalid status "${value.status}".`, { field: "status" });
  }
  assertDate(value.scheduledAt, "scheduledAt");
  assertNullableDate(value.sentAt, "sentAt");
  assertDate(value.createdAt, "createdAt");
  if (value.status === "sent" && value.sentAt === null) {
    throw new NotificationValidationError("sent must have sentAt.", { field: "sentAt" });
  }
  if (value.status !== "sent" && value.sentAt !== null) {
    throw new NotificationValidationError("non-sent must have sentAt null.", { field: "sentAt" });
  }
}

export function markNotificationSent(notification: Notification, sentAt: Date = new Date()): Notification {
  validateNotification(notification);
  assertDate(sentAt, "sentAt");
  if (notification.status === "sent") return notification;
  return {
    ...notification,
    status: "sent",
    sentAt,
  };
}

export function markNotificationFailed(notification: Notification): Notification {
  validateNotification(notification);
  return {
    ...notification,
    status: "failed",
    sentAt: null,
  };
}

export function canDeliverNotification(notification: Notification, preferences: NotificationPreference): boolean {
  validateNotification(notification);
  validateNotificationPreference(preferences);
  if (notification.channel === "email" && !preferences.emailEnabled) return false;
  if (notification.channel === "push" && !preferences.pushEnabled) return false;
  // in_app is always deliverable (inbox) even if email/push disabled.
  return true;
}

// ── NotificationPreference ───────────────────────────────────────────────────

export interface NotificationPreference {
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  deadlineReminderDays: number[];
  createdAt: Date;
}

export interface CreateNotificationPreferenceInput {
  userId: string;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  deadlineReminderDays?: number[];
}

export interface UpdateNotificationPreferenceInput {
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  deadlineReminderDays?: number[];
}

export function validateDeadlineReminderDays(value: unknown, field = "deadlineReminderDays"): number[] {
  if (!Array.isArray(value)) {
    throw new NotificationValidationError(`${field} must be an array.`, { field });
  }
  if (value.length > 10) {
    throw new NotificationValidationError(`${field} must have at most 10 entries.`, { field });
  }
  const seen = new Set<number>();
  const result: number[] = [];
  for (const entry of value) {
    if (typeof entry !== "number" || !Number.isInteger(entry)) {
      throw new NotificationValidationError(`${field} entries must be integers.`, { field });
    }
    if (entry < 0 || entry > 365) {
      throw new NotificationValidationError(`${field} entries must be between 0 and 365.`, { field });
    }
    if (seen.has(entry)) {
      throw new NotificationValidationError(`${field} must not contain duplicates.`, { field });
    }
    seen.add(entry);
    result.push(entry);
  }
  // Sort descending so largest offset (earliest reminder) first; service uses this order.
  result.sort((a, b) => b - a);
  return result;
}

export function validateCreateNotificationPreferenceInput(input: CreateNotificationPreferenceInput): void {
  assertUuid(input.userId, "userId");
  if (input.emailEnabled !== undefined && typeof input.emailEnabled !== "boolean") {
    throw new NotificationValidationError("emailEnabled must be a boolean.", { field: "emailEnabled" });
  }
  if (input.pushEnabled !== undefined && typeof input.pushEnabled !== "boolean") {
    throw new NotificationValidationError("pushEnabled must be a boolean.", { field: "pushEnabled" });
  }
  if (input.deadlineReminderDays !== undefined) {
    validateDeadlineReminderDays(input.deadlineReminderDays);
  }
}

export function createNotificationPreference(input: CreateNotificationPreferenceInput): NotificationPreference {
  validateCreateNotificationPreferenceInput(input);
  const days = input.deadlineReminderDays ? validateDeadlineReminderDays(input.deadlineReminderDays) : [7, 3, 1];
  return {
    userId: input.userId,
    emailEnabled: input.emailEnabled ?? true,
    pushEnabled: input.pushEnabled ?? true,
    deadlineReminderDays: days,
    createdAt: new Date(),
  };
}

export function validateNotificationPreference(value: NotificationPreference): void {
  assertUuid(value.userId, "userId");
  if (typeof value.emailEnabled !== "boolean") {
    throw new NotificationValidationError("emailEnabled must be boolean.", { field: "emailEnabled" });
  }
  if (typeof value.pushEnabled !== "boolean") {
    throw new NotificationValidationError("pushEnabled must be boolean.", { field: "pushEnabled" });
  }
  validateDeadlineReminderDays(value.deadlineReminderDays);
  assertDate(value.createdAt, "createdAt");
}

export function updateNotificationPreference(
  preference: NotificationPreference,
  updates: UpdateNotificationPreferenceInput,
): NotificationPreference {
  validateNotificationPreference(preference);
  if (updates.emailEnabled !== undefined && typeof updates.emailEnabled !== "boolean") {
    throw new NotificationValidationError("emailEnabled must be boolean.", { field: "emailEnabled" });
  }
  if (updates.pushEnabled !== undefined && typeof updates.pushEnabled !== "boolean") {
    throw new NotificationValidationError("pushEnabled must be boolean.", { field: "pushEnabled" });
  }
  if (updates.deadlineReminderDays !== undefined) {
    validateDeadlineReminderDays(updates.deadlineReminderDays);
  }
  return {
    ...preference,
    emailEnabled: updates.emailEnabled ?? preference.emailEnabled,
    pushEnabled: updates.pushEnabled ?? preference.pushEnabled,
    deadlineReminderDays: updates.deadlineReminderDays
      ? validateDeadlineReminderDays(updates.deadlineReminderDays)
      : preference.deadlineReminderDays,
  };
}

// ── DeadlineWatch ────────────────────────────────────────────────────────────

export interface DeadlineWatch {
  id: string;
  studentId: string;
  courseIntakeId: string;
  watchType: WatchType;
  nextReminderAt: Date | null;
  createdAt: Date;
}

export interface CreateDeadlineWatchInput {
  studentId: string;
  courseIntakeId: string;
  watchType: WatchType;
  nextReminderAt?: Date | null;
}

export function validateCreateDeadlineWatchInput(input: CreateDeadlineWatchInput): void {
  assertUuid(input.studentId, "studentId");
  assertUuid(input.courseIntakeId, "courseIntakeId");
  if (!isWatchType(input.watchType)) {
    throw new NotificationValidationError(`Invalid watch_type "${input.watchType}".`, { field: "watchType" });
  }
  if (input.nextReminderAt !== undefined) assertNullableDate(input.nextReminderAt, "nextReminderAt");
}

export function createDeadlineWatch(input: CreateDeadlineWatchInput): DeadlineWatch {
  validateCreateDeadlineWatchInput(input);
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    studentId: input.studentId,
    courseIntakeId: input.courseIntakeId,
    watchType: input.watchType,
    nextReminderAt: input.nextReminderAt ?? null,
    createdAt: now,
  };
}

export function validateDeadlineWatch(value: DeadlineWatch): void {
  assertUuid(value.id, "id");
  assertUuid(value.studentId, "studentId");
  assertUuid(value.courseIntakeId, "courseIntakeId");
  if (!isWatchType(value.watchType)) {
    throw new NotificationValidationError(`Invalid watchType "${value.watchType}".`, { field: "watchType" });
  }
  assertNullableDate(value.nextReminderAt, "nextReminderAt");
  assertDate(value.createdAt, "createdAt");
}

// ── Deadline reminder calculation (pure) ────────────────────────────────────

/**
 * Calculates the next reminder date for a deadline watch.
 *
 * Given the intake's applicationDeadline and the user's preference offsets
 * (deadlineReminderDays, e.g. [30,7,3,1]), the next reminder is the earliest
 * future date among (deadline - days) that is >= now. If all candidates are
 * in the past or deadline is null/past, returns null (no upcoming reminder).
 *
 * This is deterministic and framework-free; the service layer decides
 * persistence and notification creation.
 */
export function calculateNextReminderAt(
  deadline: Date | null,
  reminderDays: number[],
  now: Date = new Date(),
): Date | null {
  if (deadline === null) return null;
  assertDate(deadline, "deadline");
  assertDate(now, "now");
  const validatedDays = validateDeadlineReminderDays(reminderDays);
  if (deadline.getTime() <= now.getTime()) return null;
  const candidates: Date[] = [];
  for (const days of validatedDays) {
    const candidate = new Date(deadline.getTime() - days * 24 * 60 * 60 * 1000);
    if (candidate.getTime() >= now.getTime()) {
      candidates.push(candidate);
    }
  }
  if (candidates.length === 0) return null;
  // The next reminder is the soonest future candidate (minimum date >= now).
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0] ?? null;
}

// ── Legacy exports (for backwards compatibility, deprecated) ─────────────────

/** @deprecated use NotificationChannel */
export type LegacyNotificationChannel = NotificationChannel;

/** @deprecated previous minimal message shape; use Notification */
export interface NotificationMessage {
  userId: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  referenceType: string | null;
  referenceId: string | null;
  correlationId: string | null;
}

/** @deprecated use NotificationProvider (provider abstraction) */
export interface NotificationSender {
  send(message: NotificationMessage): Promise<void>;
}

/** @deprecated */
export interface NotificationStore {
  enqueue(message: NotificationMessage): Promise<void>;
}
