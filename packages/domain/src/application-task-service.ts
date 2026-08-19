/**
 * ApplicationTaskService — pure domain operations for first-class OS tasks.
 *
 * Framework-free: no Supabase/Next/HTTP imports. Validation uses typed
 * DomainError subclasses; callers map them to HTTP responses.
 */

import {
  ValidationError,
  StateTransitionError,
} from "./errors";
import type {
  ApplicationTask,
  ApplicationTaskPriority,
  ApplicationTaskSource,
  ApplicationTaskStatus,
} from "./application-task";
import {
  APPLICATION_TASK_PRIORITIES,
  APPLICATION_TASK_SOURCES,
  APPLICATION_TASK_STATUSES,
  canTransitionTask,
  completeTask as domainCompleteTask,
} from "./application-task";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function assertNonEmptyTitle(title: string): void {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Task title is required.", { field: "title" });
  }
  if (trimmed.length > 200) {
    throw new ValidationError("Task title must be 200 characters or fewer.", {
      field: "title",
    });
  }
}

function assertDescription(description: string): void {
  if (description.length > 2000) {
    throw new ValidationError("Task description must be 2000 characters or fewer.", {
      field: "description",
    });
  }
}

function assertSource(source: string): asserts source is ApplicationTaskSource {
  if (!(APPLICATION_TASK_SOURCES as readonly string[]).includes(source)) {
    throw new ValidationError(`Invalid task source "${source}".`, { field: "source" });
  }
}

function assertPriority(priority: string): asserts priority is ApplicationTaskPriority {
  if (!(APPLICATION_TASK_PRIORITIES as readonly string[]).includes(priority)) {
    throw new ValidationError(`Invalid task priority "${priority}".`, {
      field: "priority",
    });
  }
}

function assertStatus(status: string): asserts status is ApplicationTaskStatus {
  if (!(APPLICATION_TASK_STATUSES as readonly string[]).includes(status)) {
    throw new ValidationError(`Invalid task status "${status}".`, { field: "status" });
  }
}

export interface CreateTaskInput {
  caseId: string;
  title: string;
  description?: string;
  source: ApplicationTaskSource;
  assigneeUserId?: string | null;
  dueAt?: Date | null;
  priority?: ApplicationTaskPriority;
}

export interface AssignTaskInput {
  assigneeUserId: string | null;
}

export interface RescheduleTaskInput {
  dueAt: Date | null;
}

export function validateCreateTaskInput(input: CreateTaskInput): void {
  if (!input.caseId || !isUuid(input.caseId)) {
    throw new ValidationError("Task caseId must be a valid UUID.", { field: "caseId" });
  }
  assertNonEmptyTitle(input.title);
  assertDescription(input.description ?? "");
  assertSource(input.source);
  if (input.priority !== undefined) {
    assertPriority(input.priority);
  }
  if (input.assigneeUserId !== undefined && input.assigneeUserId !== null) {
    if (!isUuid(input.assigneeUserId)) {
      throw new ValidationError("Assignee must be a valid UUID or null.", {
        field: "assigneeUserId",
      });
    }
  }
  if (input.dueAt !== undefined && input.dueAt !== null && !(input.dueAt instanceof Date)) {
    throw new ValidationError("dueAt must be a Date or null.", { field: "dueAt" });
  }
  if (input.dueAt instanceof Date && Number.isNaN(input.dueAt.getTime())) {
    throw new ValidationError("dueAt must be a valid date.", { field: "dueAt" });
  }
}

export function createTask(input: CreateTaskInput): ApplicationTask {
  validateCreateTaskInput(input);
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    caseId: input.caseId,
    title: input.title.trim(),
    description: (input.description ?? "").trim(),
    source: input.source,
    assigneeUserId: input.assigneeUserId ?? null,
    dueAt: input.dueAt ?? null,
    priority: input.priority ?? "medium",
    status: "pending",
    completionEvidence: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function assignTask(
  task: ApplicationTask,
  assigneeUserId: string | null,
): ApplicationTask {
  if (task.status === "completed") {
    throw new StateTransitionError("Cannot reassign a completed task.");
  }
  if (task.status === "cancelled") {
    throw new StateTransitionError("Cannot reassign a cancelled task.");
  }
  if (assigneeUserId !== null && !isUuid(assigneeUserId)) {
    throw new ValidationError("Assignee must be a valid UUID or null.", {
      field: "assigneeUserId",
    });
  }
  return {
    ...task,
    assigneeUserId,
    updatedAt: new Date(),
  };
}

export function completeTaskWithValidation(
  task: ApplicationTask,
  evidence: string,
): ApplicationTask {
  const trimmed = evidence.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Completion evidence is required.", {
      field: "completionEvidence",
    });
  }
  if (trimmed.length > 2000) {
    throw new ValidationError("Completion evidence must be 2000 characters or fewer.", {
      field: "completionEvidence",
    });
  }
  return domainCompleteTask(task, trimmed);
}

export function rescheduleTask(
  task: ApplicationTask,
  dueAt: Date | null,
): ApplicationTask {
  if (task.status === "completed") {
    throw new StateTransitionError("Cannot reschedule a completed task.");
  }
  if (task.status === "cancelled") {
    throw new StateTransitionError("Cannot reschedule a cancelled task.");
  }
  if (dueAt !== null) {
    if (!(dueAt instanceof Date) || Number.isNaN(dueAt.getTime())) {
      throw new ValidationError("dueAt must be a valid Date or null.", { field: "dueAt" });
    }
  }
  return {
    ...task,
    dueAt,
    updatedAt: new Date(),
  };
}

export function cancelTask(task: ApplicationTask): ApplicationTask {
  if (task.status === "cancelled") {
    throw new StateTransitionError("Task is already cancelled.");
  }
  if (!canTransitionTask(task.status, "cancelled")) {
    throw new StateTransitionError(
      `Cannot cancel task in status "${task.status}".`,
    );
  }
  return {
    ...task,
    status: "cancelled",
    updatedAt: new Date(),
  };
}

export function reopenTask(task: ApplicationTask): ApplicationTask {
  if (task.status !== "cancelled" && task.status !== "completed") {
    throw new StateTransitionError(
      `Cannot reopen task in status "${task.status}".`,
    );
  }
  if (task.status === "completed") {
    throw new StateTransitionError("Completed tasks cannot be reopened; create a new task.");
  }
  return {
    ...task,
    status: "pending",
    updatedAt: new Date(),
  };
}

export function transitionTask(
  task: ApplicationTask,
  toStatus: ApplicationTaskStatus,
): ApplicationTask {
  assertStatus(toStatus);
  if (!canTransitionTask(task.status, toStatus)) {
    throw new StateTransitionError(
      `Cannot transition task from "${task.status}" to "${toStatus}".`,
    );
  }
  const now = new Date();
  if (toStatus === "completed") {
    throw new ValidationError(
      "Use completeTask with evidence to complete a task.",
      { field: "status" },
    );
  }
  return {
    ...task,
    status: toStatus,
    updatedAt: now,
  };
}

export function validateTask(task: ApplicationTask): void {
  if (!isUuid(task.id)) {
    throw new ValidationError("Task id must be a valid UUID.", { field: "id" });
  }
  if (!isUuid(task.caseId)) {
    throw new ValidationError("Task caseId must be a valid UUID.", { field: "caseId" });
  }
  assertNonEmptyTitle(task.title);
  assertDescription(task.description);
  assertSource(task.source);
  assertPriority(task.priority);
  assertStatus(task.status);
  if (task.assigneeUserId !== null && !isUuid(task.assigneeUserId)) {
    throw new ValidationError("Assignee must be a valid UUID or null.", {
      field: "assigneeUserId",
    });
  }
  if (task.dueAt !== null && !(task.dueAt instanceof Date)) {
    throw new ValidationError("dueAt must be a Date or null.", { field: "dueAt" });
  }
  if (task.completionEvidence !== null && task.completionEvidence.length > 2000) {
    throw new ValidationError("completionEvidence must be 2000 characters or fewer.", {
      field: "completionEvidence",
    });
  }
  if (task.status === "completed") {
    if (!task.completedAt) {
      throw new ValidationError("Completed tasks must have completedAt.", {
        field: "completedAt",
      });
    }
    if (!task.completionEvidence || task.completionEvidence.trim().length === 0) {
      throw new ValidationError("Completed tasks must have completionEvidence.", {
        field: "completionEvidence",
      });
    }
  }
}
