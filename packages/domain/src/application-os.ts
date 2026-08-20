/**
 * Application OS — checklist + milestone orchestration for a new case.
 *
 * Tasks are the OS checklist; milestones are the timeline checkpoints that
 * group progress. Both are first-class, framework-free. The OS composes
 * tasks deterministically from course + catalogue requirements so the LLM
 * never silently invents eligibility.
 */

import type { Course, CourseIntake, CourseRequirement } from "./catalogue";
import type {
  ApplicationTask,
  ApplicationTaskPriority,
  ApplicationTaskSource,
} from "./application-task";
import { ValidationError, StateTransitionError } from "./errors";
import { createTask as createDomainTask } from "./application-task-service";

// ── Milestones ────────────────────────────────────────────────────────────

export const APPLICATION_MILESTONE_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type ApplicationMilestoneStatus =
  (typeof APPLICATION_MILESTONE_STATUSES)[number];

export interface ApplicationMilestone {
  id: string;
  caseId: string;
  title: string;
  dueAt: Date | null;
  status: ApplicationMilestoneStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const MILESTONE_TRANSITIONS: Record<
  ApplicationMilestoneStatus,
  readonly ApplicationMilestoneStatus[]
> = {
  pending: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed", "cancelled", "pending"],
  completed: [],
  cancelled: [],
};

export function canTransitionMilestone(
  from: ApplicationMilestoneStatus,
  to: ApplicationMilestoneStatus,
): boolean {
  if (from === to) return true;
  return MILESTONE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isApplicationMilestoneStatus(
  value: string,
): value is ApplicationMilestoneStatus {
  return (APPLICATION_MILESTONE_STATUSES as readonly string[]).includes(value);
}

export interface CreateMilestoneInput {
  caseId: string;
  title: string;
  dueAt?: Date | null;
  sortOrder?: number;
  status?: ApplicationMilestoneStatus;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function validateCreateMilestoneInput(input: CreateMilestoneInput): void {
  if (!isUuid(input.caseId)) {
    throw new ValidationError("Milestone caseId must be a valid UUID.", {
      field: "caseId",
    });
  }
  const trimmed = input.title.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Milestone title is required.", { field: "title" });
  }
  if (trimmed.length > 200) {
    throw new ValidationError("Milestone title must be 200 characters or fewer.", {
      field: "title",
    });
  }
  if (input.sortOrder !== undefined && (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)) {
    throw new ValidationError("sortOrder must be a non-negative integer.", {
      field: "sortOrder",
    });
  }
  if (input.status !== undefined && !isApplicationMilestoneStatus(input.status)) {
    throw new ValidationError(`Invalid milestone status "${input.status}".`, {
      field: "status",
    });
  }
  if (input.dueAt !== undefined && input.dueAt !== null && !(input.dueAt instanceof Date)) {
    throw new ValidationError("dueAt must be a Date or null.", { field: "dueAt" });
  }
  if (input.dueAt instanceof Date && Number.isNaN(input.dueAt.getTime())) {
    throw new ValidationError("dueAt must be a valid date.", { field: "dueAt" });
  }
}

export function createMilestone(input: CreateMilestoneInput): ApplicationMilestone {
  validateCreateMilestoneInput(input);
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    caseId: input.caseId,
    title: input.title.trim(),
    dueAt: input.dueAt ?? null,
    status: input.status ?? "pending",
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function transitionMilestone(
  milestone: ApplicationMilestone,
  toStatus: ApplicationMilestoneStatus,
): ApplicationMilestone {
  if (!isApplicationMilestoneStatus(toStatus)) {
    throw new ValidationError(`Invalid milestone status "${toStatus}".`, {
      field: "status",
    });
  }
  if (!canTransitionMilestone(milestone.status, toStatus)) {
    throw new StateTransitionError(
      `Cannot transition milestone from "${milestone.status}" to "${toStatus}".`,
    );
  }
  return {
    ...milestone,
    status: toStatus,
    updatedAt: new Date(),
  };
}

export function completeMilestone(
  milestone: ApplicationMilestone,
): ApplicationMilestone {
  if (milestone.status === "completed") {
    throw new StateTransitionError("Milestone is already completed.");
  }
  if (!canTransitionMilestone(milestone.status, "completed")) {
    throw new StateTransitionError(
      `Cannot complete milestone in status "${milestone.status}".`,
    );
  }
  return {
    ...milestone,
    status: "completed",
    updatedAt: new Date(),
  };
}

// ── Task checklist generation ───────────────────────────────────────────

export interface BuildChecklistInput {
  caseId: string;
  course: Course;
  intake: CourseIntake | null;
  requirements: CourseRequirement[];
}

export interface ChecklistTaskBlueprint {
  title: string;
  description: string;
  source: ApplicationTaskSource;
  priority: ApplicationTaskPriority;
  dueAt: Date | null;
}

function daysBefore(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function hasRequirementKind(
  requirements: CourseRequirement[],
  kind: string,
): boolean {
  return requirements.some((r) => r.kind === kind);
}

function requirementSourceText(
  requirements: CourseRequirement[],
  kind: string,
): string | null {
  const match = requirements.find((r) => r.kind === kind);
  return match?.sourceText ?? null;
}

/**
 * Builds the deterministic OS checklist for a freshly created case.
 *
 * Rules are intentionally small and transparent:
 * - Never hard-codes deadlines; derives due dates from the intake's
 *   catalogue deadline (volatile fact lives in the DB).
 * - Never decides eligibility; only surfaces evidence-gathering steps
 *   implied by the structured requirements.
 * - The LLM may explain these tasks, but the rule owns whether they
 *   exist.
 */
export function buildChecklistForNewCase(input: BuildChecklistInput): ApplicationTask[] {
  if (!isUuid(input.caseId)) {
    throw new ValidationError("caseId must be a valid UUID.", { field: "caseId" });
  }
  const blueprints: ChecklistTaskBlueprint[] = [];
  const deadline = input.intake?.applicationDeadline ?? null;

  // Always: application form.
  blueprints.push({
    title: "Complete application form",
    description: `Prepare and review the application for ${input.course.title}.`,
    source: "application_workflow",
    priority: "high",
    dueAt: deadline ? daysBefore(deadline, 14) : null,
  });

  // Transcript / academic evidence.
  if (hasRequirementKind(input.requirements, "academic")) {
    const src = requirementSourceText(input.requirements, "academic");
    blueprints.push({
      title: "Upload academic transcript",
      description: src
        ? `Meets academic requirement: ${src.slice(0, 180)}`
        : "Meets the academic requirement published for this course.",
      source: "system_rule",
      priority: "high",
      dueAt: deadline ? daysBefore(deadline, 30) : null,
    });
  } else {
    blueprints.push({
      title: "Gather academic documents",
      description: "Collect transcripts and certificates referenced by the course catalogue.",
      source: "system_rule",
      priority: "medium",
      dueAt: deadline ? daysBefore(deadline, 30) : null,
    });
  }

  // Language proof.
  if (hasRequirementKind(input.requirements, "language")) {
    const src = requirementSourceText(input.requirements, "language");
    blueprints.push({
      title: "Provide English proficiency evidence",
      description: src
        ? `Language requirement: ${src.slice(0, 180)}`
        : "Upload an approved English test result.",
      source: "system_rule",
      priority: "high",
      dueAt: deadline ? daysBefore(deadline, 28) : null,
    });
  }

  // Personal statement / SOP depends on level.
  const level = input.course.level;
  if (
    level === "undergraduate" ||
    level === "postgraduate_taught" ||
    level === "foundation"
  ) {
    blueprints.push({
      title: "Draft personal statement",
      description: "Write a compelling personal statement tailored to this course.",
      source: "application_workflow",
      priority: "high",
      dueAt: deadline ? daysBefore(deadline, 21) : null,
    });
  } else if (level === "postgraduate_research" || level === "phd") {
    blueprints.push({
      title: "Draft research proposal / statement of purpose",
      description: "Outline research interests and fit for this course.",
      source: "application_workflow",
      priority: "high",
      dueAt: deadline ? daysBefore(deadline, 21) : null,
    });
  }

  // Reference — inferred from application kind or as sensible default.
  if (
    hasRequirementKind(input.requirements, "application") ||
    input.requirements.length > 0
  ) {
    blueprints.push({
      title: "Secure academic reference",
      description: "Request a reference from a teacher or supervisor who can comment on your suitability.",
      source: "system_rule",
      priority: "medium",
      dueAt: deadline ? daysBefore(deadline, 25) : null,
    });
  }

  // CV for taught/research postgraduate.
  if (level === "postgraduate_taught" || level === "postgraduate_research" || level === "phd") {
    blueprints.push({
      title: "Update CV",
      description: "Ensure your CV reflects recent experience and achievements.",
      source: "application_workflow",
      priority: "low",
      dueAt: deadline ? daysBefore(deadline, 21) : null,
    });
  }

  return blueprints.map((bp) =>
    createDomainTask({
      caseId: input.caseId,
      title: bp.title,
      description: bp.description,
      source: bp.source,
      priority: bp.priority,
      dueAt: bp.dueAt,
    }),
  );
}

export function buildDefaultMilestonesForNewCase(
  caseId: string,
  intake: CourseIntake | null,
): ApplicationMilestone[] {
  if (!isUuid(caseId)) {
    throw new ValidationError("caseId must be a valid UUID.", { field: "caseId" });
  }
  const deadline = intake?.applicationDeadline ?? null;
  const milestones: CreateMilestoneInput[] = [
    {
      caseId,
      title: "Prepare documents",
      dueAt: deadline ? daysBefore(deadline, 21) : null,
      sortOrder: 0,
    },
    {
      caseId,
      title: "Submit application",
      dueAt: deadline,
      sortOrder: 1,
    },
    {
      caseId,
      title: "Await decision",
      dueAt: null,
      sortOrder: 2,
    },
  ];
  return milestones.map((m) => createMilestone(m));
}

/**
 * High-level OS helper: produce both checklists and milestones for a new
 * case in one call. Pure — persistence is the caller's concern.
 */
export function buildOsForNewCase(input: BuildChecklistInput): {
  tasks: ApplicationTask[];
  milestones: ApplicationMilestone[];
} {
  return {
    tasks: buildChecklistForNewCase(input),
    milestones: buildDefaultMilestonesForNewCase(input.caseId, input.intake),
  };
}
