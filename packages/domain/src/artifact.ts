/**
 * Artifact domain — generic versioned application documents.
 *
 * CVs, personal statements, SOPs and supplementary answers share one model:
 * an artifact with immutable versions. A previously submitted/reviewed
 * version is never overwritten.
 */

export const ARTIFACT_TYPES = [
  "cv",
  "personal_statement",
  "statement_of_purpose",
  "supplementary_answer",
  "reference_draft",
  "portfolio_text",
  "application_note",
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const ARTIFACT_ORIGINS = [
  "human",
  "ai",
  "hybrid",
] as const;

export type ArtifactOrigin = (typeof ARTIFACT_ORIGINS)[number];

export const ARTIFACT_APPROVAL_STATES = [
  "draft",
  "in_review",
  "approved",
  "submitted",
] as const;

export type ArtifactApprovalState = (typeof ARTIFACT_APPROVAL_STATES)[number];

export interface Artifact {
  id: string;
  studentId: string;
  caseId: string | null;
  artifactType: ArtifactType;
  title: string;
  latestVersionId: string | null;
  approvalState: ArtifactApprovalState;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArtifactVersion {
  id: string;
  artifactId: string;
  versionNumber: number;
  content: string;
  creatorUserId: string;
  origin: ArtifactOrigin;
  promptVersion: string | null;
  modelRunId: string | null;
  evidenceUsed: string[];
  approvalState: ArtifactApprovalState;
  createdAt: Date;
}

export function isArtifactType(value: string): value is ArtifactType {
  return (ARTIFACT_TYPES as readonly string[]).includes(value);
}

export function isArtifactOrigin(value: string): value is ArtifactOrigin {
  return (ARTIFACT_ORIGINS as readonly string[]).includes(value);
}
