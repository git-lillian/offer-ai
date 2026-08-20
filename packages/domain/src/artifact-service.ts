/**
 * ArtifactService — pure domain operations for the Document Studio.
 *
 * Artifacts are versioned; a previous version is never overwritten. The
 * service is framework-free: no Supabase, Next or AI SDK imports. Validation
 * uses typed DomainError subclasses so delivery layers can map them to HTTP
 * responses. Every mutation returns a new immutable object.
 */

import { ValidationError, StateTransitionError } from "./errors";
import type {
  Artifact,
  ArtifactVersion,
  ArtifactType,
  ArtifactOrigin,
  ArtifactApprovalState,
  ArtifactComment,
} from "./artifact";
import {
  ARTIFACT_TYPES,
  ARTIFACT_ORIGINS,
  ARTIFACT_APPROVAL_STATES,
} from "./artifact";

// ── Helpers ───────────────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function assertUuid(value: string, field: string): void {
  if (!isUuid(value)) {
    throw new ValidationError(`${field} must be a valid UUID.`, { field });
  }
}

function assertTrimmedTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Artifact title is required.", { field: "title" });
  }
  if (trimmed.length > 200) {
    throw new ValidationError("Artifact title must be 200 characters or fewer.", {
      field: "title",
    });
  }
  return trimmed;
}

function assertArtifactType(value: string): asserts value is ArtifactType {
  if (!(ARTIFACT_TYPES as readonly string[]).includes(value)) {
    throw new ValidationError(`Invalid artifact type "${value}".`, { field: "artifactType" });
  }
}

function assertOrigin(value: string): asserts value is ArtifactOrigin {
  if (!(ARTIFACT_ORIGINS as readonly string[]).includes(value)) {
    throw new ValidationError(`Invalid artifact origin "${value}".`, { field: "origin" });
  }
}

function assertApprovalState(value: string): asserts value is ArtifactApprovalState {
  if (!(ARTIFACT_APPROVAL_STATES as readonly string[]).includes(value)) {
    throw new ValidationError(`Invalid approval state "${value}".`, { field: "approvalState" });
  }
}

// ── Approval state machine ────────────────────────────────────────────────────

const APPROVAL_TRANSITIONS: Record<
  ArtifactApprovalState,
  readonly ArtifactApprovalState[]
> = {
  draft: ["in_review", "approved"],
  in_review: ["draft", "approved"],
  approved: ["submitted", "in_review", "draft"],
  submitted: [],
};

export function canTransitionApproval(
  from: ArtifactApprovalState,
  to: ArtifactApprovalState,
): boolean {
  if (from === to) return true;
  return APPROVAL_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Create artifact ───────────────────────────────────────────────────────────

export interface CreateArtifactInput {
  studentId: string;
  caseId?: string | null;
  artifactType: ArtifactType;
  title: string;
}

export function validateCreateArtifactInput(input: CreateArtifactInput): void {
  assertUuid(input.studentId, "studentId");
  if (input.caseId !== undefined && input.caseId !== null) {
    assertUuid(input.caseId, "caseId");
  }
  assertArtifactType(input.artifactType);
  assertTrimmedTitle(input.title);
}

export function createArtifact(input: CreateArtifactInput): Artifact {
  validateCreateArtifactInput(input);
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    studentId: input.studentId,
    caseId: input.caseId ?? null,
    artifactType: input.artifactType,
    title: assertTrimmedTitle(input.title),
    latestVersionId: null,
    approvalState: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

// ── Version ───────────────────────────────────────────────────────────────────

export interface CreateVersionInput {
  artifactId: string;
  content: string;
  creatorUserId: string;
  origin: ArtifactOrigin;
  promptVersion?: string | null;
  modelRunId?: string | null;
  evidenceUsed?: string[];
  approvalState?: ArtifactApprovalState;
}

export function validateCreateVersionInput(input: CreateVersionInput): void {
  assertUuid(input.artifactId, "artifactId");
  assertUuid(input.creatorUserId, "creatorUserId");
  assertOrigin(input.origin);
  const trimmed = input.content.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Version content is required.", { field: "content" });
  }
  if (trimmed.length > 100_000) {
    throw new ValidationError("Version content must be 100000 characters or fewer.", {
      field: "content",
    });
  }
  if (input.promptVersion !== undefined && input.promptVersion !== null) {
    const pv = input.promptVersion.trim();
    if (pv.length === 0) {
      throw new ValidationError("promptVersion must be non-empty when provided.", {
        field: "promptVersion",
      });
    }
    if (pv.length > 100) {
      throw new ValidationError("promptVersion must be 100 characters or fewer.", {
        field: "promptVersion",
      });
    }
  }
  if (input.modelRunId !== undefined && input.modelRunId !== null) {
    assertUuid(input.modelRunId, "modelRunId");
  }
  if (input.evidenceUsed !== undefined && input.evidenceUsed !== null) {
    if (!Array.isArray(input.evidenceUsed)) {
      throw new ValidationError("evidenceUsed must be an array.", { field: "evidenceUsed" });
    }
    if (input.evidenceUsed.length > 50) {
      throw new ValidationError("evidenceUsed must contain at most 50 items.", {
        field: "evidenceUsed",
      });
    }
    for (const item of input.evidenceUsed) {
      if (typeof item !== "string" || item.trim().length === 0) {
        throw new ValidationError("Each evidenceUsed entry must be a non-empty string.", {
          field: "evidenceUsed",
        });
      }
      if (item.length > 500) {
        throw new ValidationError("Each evidenceUsed entry must be 500 characters or fewer.", {
          field: "evidenceUsed",
        });
      }
    }
  }
  if (input.approvalState !== undefined && input.approvalState !== null) {
    assertApprovalState(input.approvalState);
  }
}

/**
 * Creates the next immutable version for an artifact.
 *
 * `nextVersionNumber` must be exactly one greater than the current maximum.
 * Callers that persist versions should derive it from the repository (e.g.
 * `max(version_number) + 1`) and pass it in; the domain enforces the
 * monotonicity invariant.
 */
export function createVersion(
  input: CreateVersionInput,
  nextVersionNumber: number,
): ArtifactVersion {
  validateCreateVersionInput(input);
  if (!Number.isInteger(nextVersionNumber) || nextVersionNumber < 1) {
    throw new ValidationError("nextVersionNumber must be an integer >= 1.", {
      field: "nextVersionNumber",
    });
  }
  return {
    id: crypto.randomUUID(),
    artifactId: input.artifactId,
    versionNumber: nextVersionNumber,
    content: input.content.trim(),
    creatorUserId: input.creatorUserId,
    origin: input.origin,
    promptVersion: input.promptVersion?.trim() ?? null,
    modelRunId: input.modelRunId ?? null,
    evidenceUsed: input.evidenceUsed ? [...input.evidenceUsed] : [],
    approvalState: input.approvalState ?? "draft",
    createdAt: new Date(),
  };
}

// ── Approval transitions (version-level) ──────────────────────────────────────

export function requestReview(version: ArtifactVersion): ArtifactVersion {
  return transitionVersionApproval(version, "in_review");
}

export function approveVersion(version: ArtifactVersion): ArtifactVersion {
  if (version.approvalState === "approved") {
    throw new StateTransitionError("Version is already approved.");
  }
  if (version.approvalState === "submitted") {
    throw new StateTransitionError("Submitted versions cannot be re-approved.");
  }
  // Allowed from draft or in_review → approved
  if (version.approvalState !== "draft" && version.approvalState !== "in_review") {
    throw new StateTransitionError(
      `Cannot approve version in state "${version.approvalState}".`,
    );
  }
  return transitionVersionApproval(version, "approved");
}

export function rejectVersion(version: ArtifactVersion): ArtifactVersion {
  if (version.approvalState === "draft") {
    throw new StateTransitionError("Version is already in draft.");
  }
  if (version.approvalState === "submitted") {
    throw new StateTransitionError("Submitted versions cannot be rejected.");
  }
  // in_review or approved → draft
  if (version.approvalState !== "in_review" && version.approvalState !== "approved") {
    throw new StateTransitionError(
      `Cannot reject version in state "${version.approvalState}".`,
    );
  }
  return transitionVersionApproval(version, "draft");
}

export function submitVersion(version: ArtifactVersion): ArtifactVersion {
  if (version.approvalState !== "approved") {
    throw new StateTransitionError("Only approved versions can be submitted.");
  }
  return transitionVersionApproval(version, "submitted");
}

export function transitionVersionApproval(
  version: ArtifactVersion,
  toState: ArtifactApprovalState,
): ArtifactVersion {
  assertApprovalState(toState);
  if (!canTransitionApproval(version.approvalState, toState)) {
    throw new StateTransitionError(
      `Cannot transition version from "${version.approvalState}" to "${toState}".`,
    );
  }
  return {
    ...version,
    approvalState: toState,
  };
}

// ── Artifact aggregate helpers ───────────────────────────────────────────────

/**
 * Returns a new artifact with its latestVersionId and approvalState synced to
 * the supplied version. The database trigger `touch_artifact_latest_version`
 * keeps `latest_version_id` consistent on insert; this helper is the domain's
 * in-memory equivalent for tests and application services that build the
 * update before persisting.
 */
export function syncArtifactAfterVersion(
  artifact: Artifact,
  version: ArtifactVersion,
): Artifact {
  if (artifact.id !== version.artifactId) {
    throw new ValidationError("Version does not belong to the given artifact.", {
      field: "artifactId",
    });
  }
  return {
    ...artifact,
    latestVersionId: version.id,
    approvalState: version.approvalState,
    updatedAt: new Date(),
  };
}

// ── Comments ──────────────────────────────────────────────────────────────────

export interface CreateCommentInput {
  artifactId: string;
  versionNumber: number;
  authorUserId: string;
  body: string;
}

export function validateCreateCommentInput(input: CreateCommentInput): void {
  assertUuid(input.artifactId, "artifactId");
  if (!Number.isInteger(input.versionNumber) || input.versionNumber < 1) {
    throw new ValidationError("versionNumber must be an integer >= 1.", {
      field: "versionNumber",
    });
  }
  assertUuid(input.authorUserId, "authorUserId");
  const trimmed = input.body.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Comment body is required.", { field: "body" });
  }
  if (trimmed.length > 5000) {
    throw new ValidationError("Comment body must be 5000 characters or fewer.", {
      field: "body",
    });
  }
}

export function createComment(input: CreateCommentInput): ArtifactComment {
  validateCreateCommentInput(input);
  return {
    id: crypto.randomUUID(),
    artifactId: input.artifactId,
    versionNumber: input.versionNumber,
    authorUserId: input.authorUserId,
    body: input.body.trim(),
    createdAt: new Date(),
  };
}

export function validateArtifact(artifact: Artifact): void {
  assertUuid(artifact.id, "id");
  assertUuid(artifact.studentId, "studentId");
  if (artifact.caseId !== null) assertUuid(artifact.caseId, "caseId");
  assertArtifactType(artifact.artifactType);
  assertTrimmedTitle(artifact.title);
  assertApprovalState(artifact.approvalState);
  if (artifact.latestVersionId !== null) assertUuid(artifact.latestVersionId, "latestVersionId");
  if (!(artifact.createdAt instanceof Date) || Number.isNaN(artifact.createdAt.getTime())) {
    throw new ValidationError("createdAt must be a valid Date.", { field: "createdAt" });
  }
  if (!(artifact.updatedAt instanceof Date) || Number.isNaN(artifact.updatedAt.getTime())) {
    throw new ValidationError("updatedAt must be a valid Date.", { field: "updatedAt" });
  }
}

export function validateVersion(version: ArtifactVersion): void {
  assertUuid(version.id, "id");
  assertUuid(version.artifactId, "artifactId");
  if (!Number.isInteger(version.versionNumber) || version.versionNumber < 1) {
    throw new ValidationError("versionNumber must be an integer >= 1.", { field: "versionNumber" });
  }
  if (version.content.trim().length === 0) {
    throw new ValidationError("content is required.", { field: "content" });
  }
  assertUuid(version.creatorUserId, "creatorUserId");
  assertOrigin(version.origin);
  assertApprovalState(version.approvalState);
  if (!(version.createdAt instanceof Date) || Number.isNaN(version.createdAt.getTime())) {
    throw new ValidationError("createdAt must be a valid Date.", { field: "createdAt" });
  }
}
