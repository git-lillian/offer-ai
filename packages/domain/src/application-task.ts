/**
 * Application tasks — first-class records powering the student's journey
 * dashboard.
 */

import { StateTransitionError } from "./errors";

export const APPLICATION_TASK_SOURCES = [
  "system_rule",
  "ai_recommendation",
  "adviser",
  "student",
  "application_workflow",
] as const;

export type ApplicationTaskSource = (typeof APPLICATION_TASK_SOURCES)[number];

export const APPLICATION_TASK_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export type ApplicationTaskPriority = (typeof APPLICATION_TASK_PRIORITIES)[number];

export const APPLICATION_TASK_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type ApplicationTaskStatus = (typeof APPLICATION_TASK_STATUSES)[number];

export interface ApplicationTask {
  id: string;
  caseId: string;
  title: string;
  description: string;
  source: ApplicationTaskSource;
  assigneeUserId: string | null;
  dueAt: Date | null;
  priority: ApplicationTaskPriority;
  status: ApplicationTaskStatus;
  completionEvidence: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TASK_TRANSITIONS: Record<ApplicationTaskStatus, readonly ApplicationTaskStatus[]> = {
  pending: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed", "cancelled", "pending"],
  completed: [],
  cancelled: [],
};

export function canTransitionTask(
  from: ApplicationTaskStatus,
  to: ApplicationTaskStatus,
): boolean {
  if (from === to) return true;
  return TASK_TRANSITIONS[from]?.includes(to) ?? false;
}

export function completeTask(
  task: ApplicationTask,
  evidence: string,
): ApplicationTask {
  if (task.status === "completed") {
    throw new StateTransitionError("Task is already completed.");
  }
  if (!canTransitionTask(task.status, "completed")) {
    throw new StateTransitionError(
      `Cannot complete task in status "${task.status}".`,
    );
  }
  return {
    ...task,
    status: "completed",
    completionEvidence: evidence,
    completedAt: new Date(),
    updatedAt: new Date(),
  };
}

export function isApplicationTaskSource(value: string): value is ApplicationTaskSource {
  return (APPLICATION_TASK_SOURCES as readonly string[]).includes(value);
}

export function isApplicationTaskPriority(value: string): value is ApplicationTaskPriority {
  return (APPLICATION_TASK_PRIORITIES as readonly string[]).includes(value);
}

export function isApplicationTaskStatus(value: string): value is ApplicationTaskStatus {
  return (APPLICATION_TASK_STATUSES as readonly string[]).includes(value);
}
