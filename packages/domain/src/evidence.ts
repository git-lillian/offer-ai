/**
 * Evidence model — a first-class link between every important student claim
 * and its source.
 *
 * Provenance tracking: AI-extracted facts are NEVER automatically verified.
 * The pipeline is: machine_extracted → student reviews → student confirms →
 * human_verified.
 */

export const EVIDENCE_TYPES = [
  "transcript",
  "qualification_certificate",
  "language_test_certificate",
  "user_confirmation",
  "adviser_confirmation",
  "existing_cv",
  "reference",
  "portfolio",
  "employment_letter",
  "other",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const SOURCE_TYPES = [
  "uploaded_document",
  "user_input",
  "ai_extraction",
  "adviser_input",
  "external_system",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const VERIFICATION_STATUSES = [
  "unverified",
  "machine_extracted",
  "machine_validated",
  "human_verified",
  "superseded",
  "rejected",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export interface EvidenceItem {
  id: string;
  studentId: string;
  evidenceType: EvidenceType;
  sourceType: SourceType;
  sourceDocumentId: string | null;
  description: string;
  verificationStatus: VerificationStatus;
  verifiedByUserId: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function isEvidenceType(value: string): value is EvidenceType {
  return (EVIDENCE_TYPES as readonly string[]).includes(value);
}

export function isSourceType(value: string): value is SourceType {
  return (SOURCE_TYPES as readonly string[]).includes(value);
}

export function isVerificationStatus(value: string): value is VerificationStatus {
  return (VERIFICATION_STATUSES as readonly string[]).includes(value);
}
