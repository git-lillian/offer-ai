/**
 * Audit domain — append-only records of important actions.
 */

export const AUDIT_ACTIONS = [
  "adviser_access_granted",
  "adviser_access_revoked",
  "application_status_changed",
  "adviser_assigned",
  "recommendation_overridden",
  "application_submitted_externally",
  "payment_status_changed",
  "administrator_action",
  "document_viewed",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  correlationId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}
