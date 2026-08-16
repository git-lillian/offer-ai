import { describe, expect, it } from "vitest";
import {
  canTransition,
  transitionCaseStatus,
} from "./application-case";
import { StateTransitionError } from "./errors";
import { completeTask } from "./application-task";

describe("application case status transitions", () => {
  it("allows valid transitions", () => {
    expect(canTransition("draft", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "submitted")).toBe(true);
    expect(canTransition("submitted", "under_review")).toBe(true);
    expect(canTransition("under_review", "offer_received")).toBe(true);
    expect(canTransition("offer_received", "accepted")).toBe(true);
    expect(canTransition("accepted", "enrolled")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("draft", "enrolled")).toBe(false);
    expect(canTransition("enrolled", "draft")).toBe(false);
    expect(canTransition("rejected", "offer_received")).toBe(false);
  });

  it("produces an append-only event for a valid transition", () => {
    const event = transitionCaseStatus("draft", "in_progress", "user-1", "Starting work");
    expect(event.status).toBe("in_progress");
    expect(event.actorUserId).toBe("user-1");
    expect(event.message).toBe("Starting work");
    expect(event.metadata).toEqual({ fromStatus: "draft" });
  });

  it("throws StateTransitionError for invalid transitions", () => {
    expect(() =>
      transitionCaseStatus("enrolled", "draft", "user-1"),
    ).toThrow(StateTransitionError);
  });
});

describe("application task completion", () => {
  const baseTask = {
    id: "task-1",
    caseId: "case-1",
    title: "Upload transcript",
    description: "",
    source: "system_rule" as const,
    assigneeUserId: null,
    dueAt: null,
    priority: "high" as const,
    status: "pending" as const,
    completionEvidence: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("completes a pending task with evidence", () => {
    const done = completeTask(baseTask, "Transcript uploaded (checksum abc)");
    expect(done.status).toBe("completed");
    expect(done.completionEvidence).toBe("Transcript uploaded (checksum abc)");
    expect(done.completedAt).not.toBeNull();
  });

  it("throws when completing an already completed task", () => {
    const done = completeTask(baseTask, "evidence");
    expect(() => completeTask(done, "more evidence")).toThrow(StateTransitionError);
  });
});
