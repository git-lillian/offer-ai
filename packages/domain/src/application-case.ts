/**
 * Application case domain — one student's application to one course for one
 * intake/cycle.
 *
 * Current status is stored for efficient querying; the authoritative
 * history is the append-only application event stream. A student can have
 * multiple cases.
 */

import { StateTransitionError } from "./errors";

export const APPLICATION_CASE_STATUSES = [
  "draft",
  "in_progress",
  "submitted",
  "under_review",
  "offer_received",
  "rejected",
  "accepted",
  "enrolled",
  "withdrawn",
  "declined_offer",
] as const;

export type ApplicationCaseStatus = (typeof APPLICATION_CASE_STATUSES)[number];

export const APPLICATION_ROUTES = [
  "ucs",
  "institution_direct",
  "agent_portal",
  "other",
] as const;

export type ApplicationRoute = (typeof APPLICATION_ROUTES)[number];

export interface ApplicationCase {
  id: string;
  studentId: string;
  institutionId: string;
  courseId: string;
  courseIntakeId: string;
  applicationCycleId: string;
  applicationRoute: ApplicationRoute;
  currentStatus: ApplicationCaseStatus;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const APPLICATION_EVENT_TYPES = [
  "created",
  "status_changed",
  "submitted",
  "document_added",
  "note_added",
  "decision",
  "offer_condition_set",
  "other",
] as const;

export type ApplicationEventType = (typeof APPLICATION_EVENT_TYPES)[number];

/** Append-only event; never mutated. */
export interface ApplicationEvent {
  id: string;
  caseId: string;
  eventType: ApplicationEventType;
  status: ApplicationCaseStatus;
  actorUserId: string;
  message: string;
  metadata: Record<string, unknown> | null;
  occurredAt: Date;
}

/**
 * Allowed status transitions. A case may move between any of these pairs;
 * everything else is rejected by `transitionCaseStatus`.
 */
const STATUS_TRANSITIONS: Record<ApplicationCaseStatus, readonly ApplicationCaseStatus[]> = {
  draft: ["in_progress", "withdrawn"],
  in_progress: ["draft", "submitted", "withdrawn"],
  submitted: ["under_review", "withdrawn"],
  under_review: ["offer_received", "rejected", "withdrawn"],
  offer_received: ["accepted", "declined_offer", "withdrawn"],
  accepted: ["enrolled", "declined_offer", "withdrawn"],
  rejected: ["withdrawn"],
  enrolled: [],
  withdrawn: [],
  declined_offer: [],
};

export function canTransition(
  from: ApplicationCaseStatus,
  to: ApplicationCaseStatus,
): boolean {
  if (from === to) return true;
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Domain service: transitions an application case status, returning the
 * append-only event that records the change.
 */
export function transitionCaseStatus(
  currentStatus: ApplicationCaseStatus,
  to: ApplicationCaseStatus,
  actorUserId: string,
  message?: string,
): ApplicationEvent {
  if (!canTransition(currentStatus, to)) {
    throw new StateTransitionError(
      `Cannot transition application case from "${currentStatus}" to "${to}".`,
    );
  }

  return {
    id: crypto.randomUUID(),
    caseId: "", // filled by the repository/service on persistence
    eventType: to === "submitted" ? "submitted" : to === "offer_received" || to === "rejected" ? "decision" : "status_changed",
    status: to,
    actorUserId,
    message:
      message ?? `Status changed from "${currentStatus}" to "${to}".`,
    metadata: { fromStatus: currentStatus },
    occurredAt: new Date(),
  };
}

export function isApplicationCaseStatus(value: string): value is ApplicationCaseStatus {
  return (APPLICATION_CASE_STATUSES as readonly string[]).includes(value);
}

export function isApplicationRoute(value: string): value is ApplicationRoute {
  return (APPLICATION_ROUTES as readonly string[]).includes(value);
}

export function isApplicationEventType(value: string): value is ApplicationEventType {
  return (APPLICATION_EVENT_TYPES as readonly string[]).includes(value);
}
