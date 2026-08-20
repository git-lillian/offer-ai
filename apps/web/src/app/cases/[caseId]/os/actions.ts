"use server";

import { revalidatePath } from "next/cache";
import {
  createOsTaskSchema,
  completeOsTaskSchema,
  updateTaskSchema,
  createMilestoneSchema,
  updateMilestoneSchema,
} from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { ApplicationOsService } from "@/lib/services/application-os";

export type OsActionState = {
  error?: string;
  ok?: boolean;
};

function toIsoDateTime(value: FormDataEntryValue | null): string | null {
  if (value === null || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // If already datetime (contains T), try to parse as ISO
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw; // let zod fail with proper message
  return d.toISOString();
}

export async function createTaskAction(
  _prevState: OsActionState,
  formData: FormData,
): Promise<OsActionState> {
  const rawCaseId = formData.get("caseId");
  const rawTitle = formData.get("title");
  const rawDescription = formData.get("description");
  const rawSource = formData.get("source");
  const rawPriority = formData.get("priority");
  const rawDueAt = formData.get("dueAt");
  const rawAssignee = formData.get("assigneeUserId");

  const dueAtIso = toIsoDateTime(rawDueAt);
  const assignee = rawAssignee === "" || rawAssignee === null ? null : String(rawAssignee);

  const candidate = {
    caseId: rawCaseId ? String(rawCaseId) : "",
    title: rawTitle ? String(rawTitle) : "",
    description: rawDescription ? String(rawDescription).trim() : "",
    source: rawSource ? String(rawSource) : "student",
    priority: rawPriority ? String(rawPriority) : "medium",
    dueAt: dueAtIso,
    assigneeUserId: assignee,
  };

  const parsed = createOsTaskSchema.safeParse(candidate);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid task input." };
  }

  try {
    const user = await requireUser();
    const supabase = await getServerClient();
    const service = new ApplicationOsService(supabase);
    await service.createTask(parsed.data.caseId, user.id, {
      title: parsed.data.title,
      description: parsed.data.description ?? "",
      source: parsed.data.source,
      priority: parsed.data.priority,
      dueAt: parsed.data.dueAt ?? null,
      assigneeUserId: parsed.data.assigneeUserId ?? null,
    });
    revalidatePath(`/cases/${parsed.data.caseId}/os`);
    revalidatePath(`/cases/${parsed.data.caseId}`);
    return { ok: true };
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to create task." };
  }
}

export async function completeTaskAction(
  _prevState: OsActionState,
  formData: FormData,
): Promise<OsActionState> {
  const rawCaseId = formData.get("caseId");
  const rawTaskId = formData.get("taskId");
  const rawEvidence = formData.get("completionEvidence");

  const candidate = {
    taskId: rawTaskId ? String(rawTaskId) : "",
    completionEvidence: rawEvidence ? String(rawEvidence) : "",
  };

  const parsed = completeOsTaskSchema.safeParse(candidate);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const caseId = rawCaseId ? String(rawCaseId) : "";
  if (!caseId) {
    return { error: "caseId is required." };
  }

  try {
    const user = await requireUser();
    const supabase = await getServerClient();
    const service = new ApplicationOsService(supabase);
    await service.completeTask(caseId, parsed.data.taskId, user.id, parsed.data.completionEvidence);
    revalidatePath(`/cases/${caseId}/os`);
    revalidatePath(`/cases/${caseId}`);
    return { ok: true };
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to complete task." };
  }
}

export async function updateTaskStatusAction(
  _prevState: OsActionState,
  formData: FormData,
): Promise<OsActionState> {
  const rawCaseId = formData.get("caseId");
  const rawTaskId = formData.get("taskId");
  const rawStatus = formData.get("status");
  const rawTitle = formData.get("title");
  const rawDescription = formData.get("description");
  const rawPriority = formData.get("priority");
  const rawDueAt = formData.get("dueAt");
  const rawAssignee = formData.get("assigneeUserId");
  const rawEvidence = formData.get("completionEvidence");

  const caseId = rawCaseId ? String(rawCaseId) : "";
  const taskId = rawTaskId ? String(rawTaskId) : "";
  if (!caseId || !taskId) {
    return { error: "caseId and taskId are required." };
  }

  const patch: Record<string, unknown> = { taskId };
  if (rawTitle !== null) patch.title = String(rawTitle);
  if (rawDescription !== null) patch.description = String(rawDescription);
  if (rawPriority !== null && rawPriority !== "") patch.priority = String(rawPriority);
  if (rawStatus !== null && rawStatus !== "") patch.status = String(rawStatus);
  if (rawDueAt !== null) {
    const iso = toIsoDateTime(rawDueAt);
    patch.dueAt = iso;
  }
  if (rawAssignee !== null) {
    patch.assigneeUserId = rawAssignee === "" ? null : String(rawAssignee);
  }
  if (rawEvidence !== null && String(rawEvidence).trim().length > 0) {
    patch.completionEvidence = String(rawEvidence);
  }

  const parsed = updateTaskSchema.safeParse(patch);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const supabase = await getServerClient();
    const service = new ApplicationOsService(supabase);
    await service.updateTask(caseId, taskId, user.id, {
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      status: parsed.data.status,
      dueAt: parsed.data.dueAt ?? undefined,
      assigneeUserId: parsed.data.assigneeUserId,
      completionEvidence: parsed.data.completionEvidence,
    });
    revalidatePath(`/cases/${caseId}/os`);
    revalidatePath(`/cases/${caseId}`);
    return { ok: true };
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to update task." };
  }
}

export async function createMilestoneAction(
  _prevState: OsActionState,
  formData: FormData,
): Promise<OsActionState> {
  const rawCaseId = formData.get("caseId");
  const rawTitle = formData.get("title");
  const rawDueAt = formData.get("dueAt");
  const rawSortOrder = formData.get("sortOrder");
  const rawStatus = formData.get("status");

  const dueAtIso = toIsoDateTime(rawDueAt);
  const sortOrder = rawSortOrder ? Number(rawSortOrder) : 0;

  const candidate = {
    caseId: rawCaseId ? String(rawCaseId) : "",
    title: rawTitle ? String(rawTitle) : "",
    dueAt: dueAtIso,
    sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
    status: rawStatus ? String(rawStatus) : "pending",
  };

  const parsed = createMilestoneSchema.safeParse(candidate);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid milestone input." };
  }

  try {
    const user = await requireUser();
    const supabase = await getServerClient();
    const service = new ApplicationOsService(supabase);
    await service.createMilestone(parsed.data.caseId, user.id, {
      title: parsed.data.title,
      dueAt: parsed.data.dueAt ?? null,
      status: parsed.data.status,
      sortOrder: parsed.data.sortOrder,
    });
    revalidatePath(`/cases/${parsed.data.caseId}/os`);
    return { ok: true };
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to create milestone." };
  }
}

export async function updateMilestoneAction(
  _prevState: OsActionState,
  formData: FormData,
): Promise<OsActionState> {
  const rawCaseId = formData.get("caseId");
  const rawMilestoneId = formData.get("milestoneId");
  const rawTitle = formData.get("title");
  const rawDueAt = formData.get("dueAt");
  const rawSortOrder = formData.get("sortOrder");
  const rawStatus = formData.get("status");

  const caseId = rawCaseId ? String(rawCaseId) : "";
  const milestoneId = rawMilestoneId ? String(rawMilestoneId) : "";
  if (!caseId || !milestoneId) {
    return { error: "caseId and milestoneId are required." };
  }

  const patch: Record<string, unknown> = { milestoneId };
  if (rawTitle !== null && String(rawTitle).trim().length > 0) patch.title = String(rawTitle);
  if (rawDueAt !== null) patch.dueAt = toIsoDateTime(rawDueAt);
  if (rawSortOrder !== null && String(rawSortOrder).trim().length > 0) {
    const n = Number(rawSortOrder);
    if (!Number.isNaN(n)) patch.sortOrder = n;
  }
  if (rawStatus !== null && String(rawStatus).trim().length > 0) patch.status = String(rawStatus);

  const parsed = updateMilestoneSchema.safeParse(patch);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid milestone input." };
  }

  try {
    const user = await requireUser();
    const supabase = await getServerClient();
    const service = new ApplicationOsService(supabase);
    await service.updateMilestone(caseId, milestoneId, user.id, {
      title: parsed.data.title,
      dueAt: parsed.data.dueAt ?? undefined,
      sortOrder: parsed.data.sortOrder,
      status: parsed.data.status,
    });
    revalidatePath(`/cases/${caseId}/os`);
    return { ok: true };
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to update milestone." };
  }
}
