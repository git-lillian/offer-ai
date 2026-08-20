import { describe, expect, it } from "vitest";
import {
  createTask,
  assignTask,
  completeTaskWithValidation,
  rescheduleTask,
  cancelTask,
  transitionTask,
  validateCreateTaskInput,
} from "./application-task-service";
import {
  buildChecklistForNewCase,
  buildDefaultMilestonesForNewCase,
  buildOsForNewCase,
  createMilestone,
  canTransitionMilestone,
  completeMilestone,
  transitionMilestone,
} from "./application-os";
import { ValidationError, StateTransitionError } from "./errors";
import type { Course, CourseIntake, CourseRequirement } from "./catalogue";

const CASE_ID = "550e8400-e29b-41d4-a716-446655440001";
const ASSIGNEE = "550e8400-e29b-41d4-a716-446655440002";

function makeCourse(overrides?: Partial<Course>): Course {
  return {
    id: "550e8400-e29b-41d4-a716-446655440010",
    institutionId: "550e8400-e29b-41d4-a716-446655440020",
    subjectId: null,
    title: "BSc Computer Science",
    slug: "bsc-computer-science",
    level: "undergraduate",
    durationMonths: 36,
    tuitionFee: 12000,
    currencyCode: "GBP",
    applicationRoutes: ["ucas", "institution_direct"],
    internationalApplicantsSupported: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeIntake(overrides?: Partial<CourseIntake>): CourseIntake {
  return {
    id: "550e8400-e29b-41d4-a716-446655440030",
    courseId: "550e8400-e29b-41d4-a716-446655440010",
    applicationCycleId: "550e8400-e29b-41d4-a716-446655440040",
    intakeMonth: 9,
    intakeYear: 2027,
    applicationDeadline: new Date("2027-01-15T00:00:00.000Z"),
    tuitionFee: 12000,
    feeCurrencyCode: "GBP",
    closed: false,
    ...overrides,
  };
}

function makeRequirement(kind: CourseRequirement["kind"], sourceText = "Requirement text"): CourseRequirement {
  return {
    id: crypto.randomUUID(),
    courseId: "550e8400-e29b-41d4-a716-446655440010",
    kind,
    structured: null,
    sourceText,
    sourceId: null,
    effectiveFrom: new Date("2026-01-01"),
    effectiveTo: null,
    observedAt: new Date(),
    publishedAt: new Date(),
    supersededById: null,
    verificationStatus: "human_verified",
  };
}

describe("ApplicationTaskService", () => {
  it("creates a task with defaults", () => {
    const task = createTask({
      caseId: CASE_ID,
      title: "Upload transcript",
      source: "system_rule",
    });
    expect(task.caseId).toBe(CASE_ID);
    expect(task.title).toBe("Upload transcript");
    expect(task.status).toBe("pending");
    expect(task.priority).toBe("medium");
    expect(task.assigneeUserId).toBeNull();
    expect(task.dueAt).toBeNull();
  });

  it("trims title and description", () => {
    const task = createTask({
      caseId: CASE_ID,
      title: "  Draft PS  ",
      description: "  hello  ",
      source: "application_workflow",
      priority: "high",
    });
    expect(task.title).toBe("Draft PS");
    expect(task.description).toBe("hello");
  });

  it("throws ValidationError for invalid caseId", () => {
    expect(() =>
      createTask({ caseId: "not-a-uuid", title: "t", source: "student" }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for empty title", () => {
    expect(() =>
      createTask({ caseId: CASE_ID, title: "   ", source: "student" }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for invalid assignee", () => {
    expect(() =>
      createTask({
        caseId: CASE_ID,
        title: "t",
        source: "student",
        assigneeUserId: "bad",
      }),
    ).toThrow(ValidationError);
  });

  it("validates via validateCreateTaskInput", () => {
    expect(() =>
      validateCreateTaskInput({
        caseId: CASE_ID,
        title: "ok",
        source: "student",
        dueAt: new Date("invalid"),
      }),
    ).toThrow(ValidationError);
  });

  it("assigns a task", () => {
    const task = createTask({ caseId: CASE_ID, title: "t", source: "adviser" });
    const assigned = assignTask(task, ASSIGNEE);
    expect(assigned.assigneeUserId).toBe(ASSIGNEE);
    expect(assigned.updatedAt.getTime()).toBeGreaterThanOrEqual(task.updatedAt.getTime());
  });

  it("throws when assigning with invalid uuid", () => {
    const task = createTask({ caseId: CASE_ID, title: "t", source: "adviser" });
    expect(() => assignTask(task, "bad")).toThrow(ValidationError);
  });

  it("throws when assigning a completed task", () => {
    const task = createTask({ caseId: CASE_ID, title: "t", source: "adviser" });
    const done = completeTaskWithValidation(task, "evidence");
    expect(() => assignTask(done, ASSIGNEE)).toThrow(StateTransitionError);
  });

  it("completes a pending task with evidence", () => {
    const task = createTask({ caseId: CASE_ID, title: "t", source: "system_rule", priority: "high" });
    const done = completeTaskWithValidation(task, " Transcript uploaded ");
    expect(done.status).toBe("completed");
    expect(done.completionEvidence).toBe("Transcript uploaded");
    expect(done.completedAt).not.toBeNull();
  });

  it("throws ValidationError when completing without evidence", () => {
    const task = createTask({ caseId: CASE_ID, title: "t", source: "system_rule" });
    expect(() => completeTaskWithValidation(task, "   ")).toThrow(ValidationError);
  });

  it("throws StateTransitionError when completing already completed", () => {
    const task = createTask({ caseId: CASE_ID, title: "t", source: "system_rule" });
    const done = completeTaskWithValidation(task, "ev");
    expect(() => completeTaskWithValidation(done, "ev2")).toThrow(StateTransitionError);
  });

  it("reschedules a task", () => {
    const task = createTask({ caseId: CASE_ID, title: "t", source: "student" });
    const newDue = new Date("2027-02-01T00:00:00.000Z");
    const rescheduled = rescheduleTask(task, newDue);
    expect(rescheduled.dueAt?.toISOString()).toBe(newDue.toISOString());
  });

  it("throws when rescheduling a cancelled task", () => {
    const task = createTask({ caseId: CASE_ID, title: "t", source: "student" });
    const cancelled = cancelTask(task);
    expect(() => rescheduleTask(cancelled, new Date())).toThrow(StateTransitionError);
  });

  it("cancelTask respects state machine", () => {
    const pending = createTask({ caseId: CASE_ID, title: "t", source: "student" });
    const cancelled = cancelTask(pending);
    expect(cancelled.status).toBe("cancelled");
    expect(() => cancelTask(cancelled)).toThrow(StateTransitionError);
  });

  it("transitionTask blocks completing via status", () => {
    const task = createTask({ caseId: CASE_ID, title: "t", source: "student" });
    expect(() => transitionTask(task, "completed")).toThrow(ValidationError);
  });

  it("transitionTask allows pending -> in_progress", () => {
    const task = createTask({ caseId: CASE_ID, title: "t", source: "student" });
    const next = transitionTask(task, "in_progress");
    expect(next.status).toBe("in_progress");
  });

  it("transitionTask throws for invalid transitions", () => {
    const task = createTask({ caseId: CASE_ID, title: "t", source: "student" });
    const done = completeTaskWithValidation(task, "ev");
    expect(() => transitionTask(done, "pending")).toThrow(StateTransitionError);
  });
});

describe("Application OS checklist", () => {
  it("builds checklist for undergraduate with academic + language requirements", () => {
    const course = makeCourse();
    const intake = makeIntake();
    const reqs: CourseRequirement[] = [
      makeRequirement("academic", "AAB at A-Level"),
      makeRequirement("language", "IELTS 6.5"),
      makeRequirement("application", "Reference required"),
    ];
    const tasks = buildChecklistForNewCase({
      caseId: CASE_ID,
      course,
      intake,
      requirements: reqs,
    });
    const titles = tasks.map((t) => t.title);
    expect(titles).toContain("Complete application form");
    expect(titles).toContain("Upload academic transcript");
    expect(titles).toContain("Provide English proficiency evidence");
    expect(titles).toContain("Draft personal statement");
    expect(titles).toContain("Secure academic reference");
    // All tasks belong to same case and have valid priorities
    for (const t of tasks) {
      expect(t.caseId).toBe(CASE_ID);
      expect(["low", "medium", "high", "urgent"]).toContain(t.priority);
    }
    // dueAt derived from intake deadline
    const transcript = tasks.find((t) => t.title === "Upload academic transcript");
    expect(transcript?.dueAt?.toISOString()).toBe(new Date("2026-12-16T00:00:00.000Z").toISOString());
  });

  it("builds checklist for phd without requirements", () => {
    const course = makeCourse({ level: "phd", title: "PhD AI" });
    const intake = makeIntake({ applicationDeadline: null });
    const tasks = buildChecklistForNewCase({
      caseId: CASE_ID,
      course,
      intake,
      requirements: [],
    });
    const titles = tasks.map((t) => t.title);
    expect(titles).toContain("Complete application form");
    expect(titles).toContain("Draft research proposal / statement of purpose");
    expect(titles).toContain("Update CV");
    // no dueAt when no deadline
    expect(tasks.every((t) => t.dueAt === null)).toBe(true);
  });

  it("throws ValidationError for invalid caseId in checklist", () => {
    expect(() =>
      buildChecklistForNewCase({
        caseId: "bad",
        course: makeCourse(),
        intake: makeIntake(),
        requirements: [],
      }),
    ).toThrow(ValidationError);
  });

  it("builds default milestones", () => {
    const intake = makeIntake();
    const milestones = buildDefaultMilestonesForNewCase(CASE_ID, intake);
    expect(milestones).toHaveLength(3);
    expect(milestones[0]?.title).toBe("Prepare documents");
    expect(milestones[1]?.title).toBe("Submit application");
    expect(milestones[2]?.title).toBe("Await decision");
    expect(milestones[0]?.sortOrder).toBe(0);
    expect(milestones[1]?.sortOrder).toBe(1);
    expect(milestones[1]?.dueAt?.toISOString()).toBe(intake.applicationDeadline?.toISOString());
  });

  it("builds OS bundle with tasks + milestones", () => {
    const bundle = buildOsForNewCase({
      caseId: CASE_ID,
      course: makeCourse(),
      intake: makeIntake(),
      requirements: [makeRequirement("academic")],
    });
    expect(bundle.tasks.length).toBeGreaterThan(0);
    expect(bundle.milestones.length).toBe(3);
  });
});

describe("ApplicationMilestone", () => {
  it("creates a milestone", () => {
    const m = createMilestone({ caseId: CASE_ID, title: " My Milestone " });
    expect(m.title).toBe("My Milestone");
    expect(m.status).toBe("pending");
    expect(m.sortOrder).toBe(0);
  });

  it("throws ValidationError for empty title", () => {
    expect(() => createMilestone({ caseId: CASE_ID, title: " " })).toThrow(ValidationError);
  });

  it("throws ValidationError for invalid caseId", () => {
    expect(() => createMilestone({ caseId: "bad", title: "t" })).toThrow(ValidationError);
  });

  it("allows pending -> in_progress -> completed", () => {
    let m = createMilestone({ caseId: CASE_ID, title: "t" });
    expect(canTransitionMilestone("pending", "in_progress")).toBe(true);
    m = transitionMilestone(m, "in_progress");
    expect(m.status).toBe("in_progress");
    m = completeMilestone(m);
    expect(m.status).toBe("completed");
  });

  it("throws StateTransitionError for invalid milestone transition", () => {
    const m = createMilestone({ caseId: CASE_ID, title: "t", status: "completed" });
    expect(() => transitionMilestone(m, "pending")).toThrow(StateTransitionError);
    expect(() => completeMilestone(m)).toThrow(StateTransitionError);
  });

  it("throws ValidationError for invalid milestone status", () => {
    const m = createMilestone({ caseId: CASE_ID, title: "t" });
    expect(() => transitionMilestone(m, "bad" as never)).toThrow(ValidationError);
  });

  it("canTransitionMilestone is reflexive", () => {
    expect(canTransitionMilestone("pending", "pending")).toBe(true);
    expect(canTransitionMilestone("completed", "completed")).toBe(true);
  });
});
