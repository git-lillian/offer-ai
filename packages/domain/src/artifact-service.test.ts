import { describe, expect, it } from "vitest";
import {
  createArtifact,
  createVersion,
  approveVersion,
  rejectVersion,
  canTransitionApproval,
  transitionVersionApproval,
  requestReview,
  submitVersion,
  syncArtifactAfterVersion,
  createComment,
  validateCreateArtifactInput,
  validateCreateVersionInput,
} from "./artifact-service";
import { ValidationError, StateTransitionError } from "./errors";
import type { Artifact, ArtifactVersion } from "./artifact";

const STUDENT_ID = "550e8400-e29b-41d4-a716-446655440001";
const CASE_ID = "550e8400-e29b-41d4-a716-446655440002";
const CREATOR = "550e8400-e29b-41d4-a716-446655440003";
const ARTIFACT_ID = "550e8400-e29b-41d4-a716-446655440010";

function makeArtifact(overrides?: Partial<Artifact>): Artifact {
  return {
    id: ARTIFACT_ID,
    studentId: STUDENT_ID,
    caseId: CASE_ID,
    artifactType: "personal_statement",
    title: "My PS",
    latestVersionId: null,
    approvalState: "draft",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeVersion(
  overrides?: Partial<ArtifactVersion>,
  versionNumber = 1,
): ArtifactVersion {
  return {
    id: crypto.randomUUID(),
    artifactId: ARTIFACT_ID,
    versionNumber,
    content: "Original content for testing.",
    creatorUserId: CREATOR,
    origin: "human",
    promptVersion: null,
    modelRunId: null,
    evidenceUsed: [],
    approvalState: "draft",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("createArtifact", () => {
  it("creates an artifact with defaults", () => {
    const artifact = createArtifact({
      studentId: STUDENT_ID,
      artifactType: "cv",
      title: "My CV",
    });
    expect(artifact.studentId).toBe(STUDENT_ID);
    expect(artifact.caseId).toBeNull();
    expect(artifact.artifactType).toBe("cv");
    expect(artifact.title).toBe("My CV");
    expect(artifact.approvalState).toBe("draft");
    expect(artifact.latestVersionId).toBeNull();
    expect(artifact.id).toBeDefined();
  });

  it("trims title and respects caseId", () => {
    const artifact = createArtifact({
      studentId: STUDENT_ID,
      caseId: CASE_ID,
      artifactType: "personal_statement",
      title: "  My PS  ",
    });
    expect(artifact.title).toBe("My PS");
    expect(artifact.caseId).toBe(CASE_ID);
  });

  it("throws ValidationError for invalid studentId", () => {
    expect(() =>
      createArtifact({ studentId: "bad", artifactType: "cv", title: "t" }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for invalid caseId", () => {
    expect(() =>
      createArtifact({
        studentId: STUDENT_ID,
        caseId: "bad",
        artifactType: "cv",
        title: "t",
      }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for empty title", () => {
    expect(() =>
      createArtifact({ studentId: STUDENT_ID, artifactType: "cv", title: "   " }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for invalid artifact type", () => {
    expect(() =>
      createArtifact({
        studentId: STUDENT_ID,
        artifactType: "bad" as never,
        title: "t",
      }),
    ).toThrow(ValidationError);
  });

  it("validates via validateCreateArtifactInput", () => {
    expect(() =>
      validateCreateArtifactInput({ studentId: STUDENT_ID, artifactType: "cv", title: "ok" }),
    ).not.toThrow();
  });
});

describe("createVersion", () => {
  it("creates a version with nextVersionNumber", () => {
    const version = createVersion(
      {
        artifactId: ARTIFACT_ID,
        content: "Hello world",
        creatorUserId: CREATOR,
        origin: "human",
      },
      1,
    );
    expect(version.artifactId).toBe(ARTIFACT_ID);
    expect(version.versionNumber).toBe(1);
    expect(version.content).toBe("Hello world");
    expect(version.origin).toBe("human");
    expect(version.approvalState).toBe("draft");
  });

  it("trims content and respects optional fields", () => {
    const version = createVersion(
      {
        artifactId: ARTIFACT_ID,
        content: "  trimmed  ",
        creatorUserId: CREATOR,
        origin: "ai",
        promptVersion: "v1",
        evidenceUsed: ["ev-1"],
      },
      2,
    );
    expect(version.content).toBe("trimmed");
    expect(version.promptVersion).toBe("v1");
    expect(version.evidenceUsed).toEqual(["ev-1"]);
  });

  it("throws ValidationError for empty content", () => {
    expect(() =>
      createVersion(
        { artifactId: ARTIFACT_ID, content: "   ", creatorUserId: CREATOR, origin: "human" },
        1,
      ),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for invalid origin", () => {
    expect(() =>
      createVersion(
        {
          artifactId: ARTIFACT_ID,
          content: "ok",
          creatorUserId: CREATOR,
          origin: "bad" as never,
        },
        1,
      ),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for invalid artifactId", () => {
    expect(() =>
      createVersion({ artifactId: "bad", content: "ok", creatorUserId: CREATOR, origin: "human" }, 1),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for invalid nextVersionNumber", () => {
    expect(() =>
      createVersion(
        { artifactId: ARTIFACT_ID, content: "ok", creatorUserId: CREATOR, origin: "human" },
        0,
      ),
    ).toThrow(ValidationError);
  });

  it("validates via validateCreateVersionInput", () => {
    expect(() =>
      validateCreateVersionInput({
        artifactId: ARTIFACT_ID,
        content: "ok",
        creatorUserId: CREATOR,
        origin: "human",
      }),
    ).not.toThrow();
  });

  it("throws for evidenceUsed not an array", () => {
    expect(() =>
      createVersion(
        {
          artifactId: ARTIFACT_ID,
          content: "ok",
          creatorUserId: CREATOR,
          origin: "human",
          evidenceUsed: "not-array" as never,
        },
        1,
      ),
    ).toThrow(ValidationError);
  });
});

describe("approval transitions", () => {
  it("canTransitionApproval covers the matrix", () => {
    expect(canTransitionApproval("draft", "in_review")).toBe(true);
    expect(canTransitionApproval("in_review", "approved")).toBe(true);
    expect(canTransitionApproval("approved", "submitted")).toBe(true);
    expect(canTransitionApproval("draft", "submitted")).toBe(false);
    expect(canTransitionApproval("submitted", "draft")).toBe(false);
    expect(canTransitionApproval("draft", "draft")).toBe(true);
  });

  it("requestReview moves draft → in_review", () => {
    const v = makeVersion({ approvalState: "draft" });
    const next = requestReview(v);
    expect(next.approvalState).toBe("in_review");
  });

  it("approveVersion from draft succeeds", () => {
    const v = makeVersion({ approvalState: "draft" });
    const approved = approveVersion(v);
    expect(approved.approvalState).toBe("approved");
  });

  it("approveVersion from in_review succeeds", () => {
    const v = makeVersion({ approvalState: "in_review" });
    const approved = approveVersion(v);
    expect(approved.approvalState).toBe("approved");
  });

  it("approveVersion throws if already approved", () => {
    const v = makeVersion({ approvalState: "approved" });
    expect(() => approveVersion(v)).toThrow(StateTransitionError);
  });

  it("approveVersion throws if submitted", () => {
    const v = makeVersion({ approvalState: "submitted" });
    expect(() => approveVersion(v)).toThrow(StateTransitionError);
  });

  it("rejectVersion from in_review → draft", () => {
    const v = makeVersion({ approvalState: "in_review" });
    const rejected = rejectVersion(v);
    expect(rejected.approvalState).toBe("draft");
  });

  it("rejectVersion from approved → draft", () => {
    const v = makeVersion({ approvalState: "approved" });
    const rejected = rejectVersion(v);
    expect(rejected.approvalState).toBe("draft");
  });

  it("rejectVersion throws if already draft", () => {
    const v = makeVersion({ approvalState: "draft" });
    expect(() => rejectVersion(v)).toThrow(StateTransitionError);
  });

  it("rejectVersion throws if submitted", () => {
    const v = makeVersion({ approvalState: "submitted" });
    expect(() => rejectVersion(v)).toThrow(StateTransitionError);
  });

  it("submitVersion only from approved", () => {
    const v = makeVersion({ approvalState: "approved" });
    const submitted = submitVersion(v);
    expect(submitted.approvalState).toBe("submitted");
  });

  it("submitVersion throws if not approved", () => {
    const v = makeVersion({ approvalState: "draft" });
    expect(() => submitVersion(v)).toThrow(StateTransitionError);
  });

  it("transitionVersionApproval throws for illegal transition", () => {
    const v = makeVersion({ approvalState: "draft" });
    expect(() => transitionVersionApproval(v, "submitted")).toThrow(StateTransitionError);
  });

  it("transitionVersionApproval validates target state", () => {
    const v = makeVersion({ approvalState: "draft" });
    expect(() => transitionVersionApproval(v, "bad" as never)).toThrow(ValidationError);
  });
});

describe("syncArtifactAfterVersion", () => {
  it("syncs latestVersionId and approvalState", () => {
    const artifact = makeArtifact({ approvalState: "draft", latestVersionId: null });
    const version = makeVersion({ approvalState: "approved" }, 2);
    const synced = syncArtifactAfterVersion(artifact, version);
    expect(synced.latestVersionId).toBe(version.id);
    expect(synced.approvalState).toBe("approved");
    expect(synced.updatedAt.getTime()).toBeGreaterThanOrEqual(artifact.updatedAt.getTime());
  });

  it("throws if version belongs to different artifact", () => {
    const artifact = makeArtifact();
    const version = makeVersion({ artifactId: "550e8400-e29b-41d4-a716-446655440099" });
    expect(() => syncArtifactAfterVersion(artifact, version)).toThrow(ValidationError);
  });
});

describe("createComment", () => {
  it("creates a comment with trimmed body", () => {
    const comment = createComment({
      artifactId: ARTIFACT_ID,
      versionNumber: 1,
      authorUserId: CREATOR,
      body: "  Nice draft  ",
    });
    expect(comment.body).toBe("Nice draft");
    expect(comment.versionNumber).toBe(1);
    expect(comment.authorUserId).toBe(CREATOR);
  });

  it("throws ValidationError for empty body", () => {
    expect(() =>
      createComment({
        artifactId: ARTIFACT_ID,
        versionNumber: 1,
        authorUserId: CREATOR,
        body: "   ",
      }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for invalid artifactId", () => {
    expect(() =>
      createComment({ artifactId: "bad", versionNumber: 1, authorUserId: CREATOR, body: "hi" }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for versionNumber < 1", () => {
    expect(() =>
      createComment({ artifactId: ARTIFACT_ID, versionNumber: 0, authorUserId: CREATOR, body: "hi" }),
    ).toThrow(ValidationError);
  });
});
