/**
 * Access grants and consent — explicit, revocable access relationships.
 *
 * An adviser/guardian never gains blanket access to a student's account;
 * access is scoped, expiring and revocable. Consent is a first-class record,
 * not a checkbox.
 */

export const ACCESS_GRANT_SCOPES = [
  "profile",
  "case",
  "document",
  "service",
] as const;

export type AccessGrantScope = (typeof ACCESS_GRANT_SCOPES)[number];

export const ACCESS_GRANT_STATUSES = [
  "active",
  "revoked",
  "expired",
] as const;

export type AccessGrantStatus = (typeof ACCESS_GRANT_STATUSES)[number];

export interface AccessGrant {
  id: string;
  studentId: string;
  granteeUserId: string;
  scope: AccessGrantScope;
  scopeId: string | null; // case/document id when scope is specific
  grantedByUserId: string;
  grantedAt: Date;
  expiresAt: Date | null;
  status: AccessGrantStatus;
  revokedByUserId: string | null;
  revokedAt: Date | null;
}

export const CONSENT_TYPES = [
  "adviser_access",
  "guardian_access",
  "marketplace_data_sharing",
  "communication_preferences",
  "marketing_optional",
  "research_analytics",
] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: ConsentType;
  policyVersion: string;
  grantedAt: Date;
  revokedAt: Date | null;
  source: string;
}

export function isAccessGrantScope(value: string): value is AccessGrantScope {
  return (ACCESS_GRANT_SCOPES as readonly string[]).includes(value);
}

export function isConsentType(value: string): value is ConsentType {
  return (CONSENT_TYPES as readonly string[]).includes(value);
}

export function isGrantActive(
  grant: Pick<AccessGrant, "status" | "expiresAt">,
  now: Date = new Date(),
): boolean {
  if (grant.status !== "active") return false;
  if (grant.expiresAt !== null && grant.expiresAt <= now) return false;
  return true;
}
