import "server-only";

import {
  ApplicationCaseRepository,
  ApplicationMilestoneRepository,
  ApplicationOsTaskRepository,
  StudentProfileRepository,
  type Database,
} from "@offer-ai/database";
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
  type ApplicationTask,
  type ApplicationMilestone,
  createTask as createDomainTask,
  completeTaskWithValidation,
  rescheduleTask,
  cancelTask,
  assignTask,
  transitionTask,
  createMilestone as createDomainMilestone,
  transitionMilestone,
  completeMilestone,
  validateCreateMilestoneInput,
} from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof getServerClient>>;

async function requireOwnership(
  supabase: ServerClient,
  userId: string,
  caseId: string,
): Promise<{ studentId: string }> {
  const profileRepo = new StudentProfileRepository(supabase);
  const profile = await profileRepo.findByUserId(userId);
  if (!profile) {
    throw new NotFoundError("Student profile not found.");
  }

  const caseRepo = new ApplicationCaseRepository(supabase);
  const applicationCase = await caseRepo.findById(caseId);
  if (!applicationCase) {
    throw new NotFoundError("Application case not found.");
  }

  if (applicationCase.studentId !== profile.id) {
    throw new AuthorizationError("You do not have access to this application case.");
  }

  return { studentId: profile.id };
}

export class ApplicationOsService {
  constructor(private readonly supabase: ServerClient) {}

  // ── Tasks ──────────────────────────────────────────────────────────────

  async listTasks(caseId: string, userId: string): Promise<ApplicationTask[]> {
    await requireOwnership(this.supabase, userId, caseId);
    const taskRepo = new ApplicationOsTaskRepository(this.supabase as never);
    return taskRepo.listByCase(caseId);
  }

  async createTask(
    caseId: string,
    userId: string,
    input: {
      title: string;
      description?: string;
      source: ApplicationTask["source"];
      assigneeUserId?: string | null;
      dueAt?: string | null;
      priority?: ApplicationTask["priority"];
    },
  ): Promise<ApplicationTask> {
    await requireOwnership(this.supabase, userId, caseId);

    const domainTask = createDomainTask({
      caseId,
      title: input.title,
      description: input.description ?? "",
      source: input.source,
      assigneeUserId: input.assigneeUserId ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      priority: input.priority ?? "medium",
    });

    const repo = new ApplicationOsTaskRepository(this.supabase as never);
    return repo.create(domainTask);
  }

  async updateTask(
    caseId: string,
    taskId: string,
    userId: string,
    patch: {
      title?: string;
      description?: string;
      dueAt?: string | null;
      priority?: ApplicationTask["priority"];
      status?: ApplicationTask["status"];
      assigneeUserId?: string | null;
      completionEvidence?: string;
    },
  ): Promise<ApplicationTask> {
    await requireOwnership(this.supabase, userId, caseId);

    const repo = new ApplicationOsTaskRepository(this.supabase as never);
    const existing = await repo.findById(taskId);
    if (!existing) {
      throw new NotFoundError("Task not found.");
    }
    if (existing.caseId !== caseId) {
      throw new NotFoundError("Task does not belong to this case.");
    }

    let updated: ApplicationTask = existing;

    // Title
    if (patch.title !== undefined) {
      const trimmed = patch.title.trim();
      if (trimmed.length === 0) {
        throw new ValidationError("Task title is required.", { field: "title" });
      }
      if (trimmed.length > 200) {
        throw new ValidationError("Task title must be 200 characters or fewer.", { field: "title" });
      }
      updated = { ...updated, title: trimmed, updatedAt: new Date() };
    }

    // Description
    if (patch.description !== undefined) {
      const trimmed = patch.description.trim();
      if (trimmed.length > 2000) {
        throw new ValidationError("Task description must be 2000 characters or fewer.", {
          field: "description",
        });
      }
      updated = { ...updated, description: trimmed, updatedAt: new Date() };
    }

    // Priority
    if (patch.priority !== undefined) {
      updated = { ...updated, priority: patch.priority, updatedAt: new Date() };
    }

    // Due date — validates via reschedule domain when status allows
    if (patch.dueAt !== undefined) {
      const dueAt = patch.dueAt ? new Date(patch.dueAt) : null;
      if (dueAt !== null && Number.isNaN(dueAt.getTime())) {
        throw new ValidationError("dueAt must be a valid date.", { field: "dueAt" });
      }
      // Use domain reschedule validation for non-terminal states; for completed/cancelled
      // we still update but domain would reject — let reschedule throw.
      try {
        updated = rescheduleTask(updated, dueAt);
      } catch (e) {
        // If task is completed/cancelled, domain reschedule throws StateTransitionError.
        // Propagate as-is so API maps to 409. No silent direct assignment.
        throw e;
      }
    }

    // Assignee
    if (patch.assigneeUserId !== undefined) {
      updated = assignTask(updated, patch.assigneeUserId);
    }

    // Status transitions — must be last so other field updates are reflected
    if (patch.status !== undefined) {
      if (patch.status === "completed") {
        if (!patch.completionEvidence || patch.completionEvidence.trim().length === 0) {
          throw new ValidationError("completionEvidence is required to complete a task.", {
            field: "completionEvidence",
          });
        }
        updated = completeTaskWithValidation(updated, patch.completionEvidence);
      } else {
        updated = transitionTask(updated, patch.status);
        // If completionEvidence provided alongside a non-completed status, update it
        if (patch.completionEvidence !== undefined) {
          const trimmed = patch.completionEvidence.trim();
          if (trimmed.length > 2000) {
            throw new ValidationError("completionEvidence must be 2000 characters or fewer.", {
              field: "completionEvidence",
            });
          }
          updated = { ...updated, completionEvidence: trimmed, updatedAt: new Date() };
        }
      }
    } else if (patch.completionEvidence !== undefined) {
      // Standalone evidence update without status change
      const trimmed = patch.completionEvidence.trim();
      if (trimmed.length > 2000) {
        throw new ValidationError("completionEvidence must be 2000 characters or fewer.", {
          field: "completionEvidence",
        });
      }
      updated = { ...updated, completionEvidence: trimmed, updatedAt: new Date() };
    }

    return repo.update(updated);
  }

  async completeTask(
    caseId: string,
    taskId: string,
    userId: string,
    completionEvidence: string,
  ): Promise<ApplicationTask> {
    await requireOwnership(this.supabase, userId, caseId);
    const repo = new ApplicationOsTaskRepository(this.supabase as never);
    const existing = await repo.findById(taskId);
    if (!existing) throw new NotFoundError("Task not found.");
    if (existing.caseId !== caseId) throw new NotFoundError("Task does not belong to this case.");
    const completed = completeTaskWithValidation(existing, completionEvidence);
    return repo.update(completed);
  }

  async rescheduleTask(
    caseId: string,
    taskId: string,
    userId: string,
    dueAt: string | null,
  ): Promise<ApplicationTask> {
    await requireOwnership(this.supabase, userId, caseId);
    const repo = new ApplicationOsTaskRepository(this.supabase as never);
    const existing = await repo.findById(taskId);
    if (!existing) throw new NotFoundError("Task not found.");
    if (existing.caseId !== caseId) throw new NotFoundError("Task does not belong to this case.");
    const rescheduled = rescheduleTask(existing, dueAt ? new Date(dueAt) : null);
    return repo.update(rescheduled);
  }

  async cancelTask(caseId: string, taskId: string, userId: string): Promise<ApplicationTask> {
    await requireOwnership(this.supabase, userId, caseId);
    const repo = new ApplicationOsTaskRepository(this.supabase as never);
    const existing = await repo.findById(taskId);
    if (!existing) throw new NotFoundError("Task not found.");
    if (existing.caseId !== caseId) throw new NotFoundError("Task does not belong to this case.");
    const cancelled = cancelTask(existing);
    return repo.update(cancelled);
  }

  // ── Milestones ─────────────────────────────────────────────────────────

  async listMilestones(caseId: string, userId: string): Promise<ApplicationMilestone[]> {
    await requireOwnership(this.supabase, userId, caseId);
    const repo = new ApplicationMilestoneRepository(
      this.supabase as unknown as import("@supabase/supabase-js").SupabaseClient<Database>,
    );
    return repo.listByCase(caseId);
  }

  async createMilestone(
    caseId: string,
    userId: string,
    input: {
      title: string;
      dueAt?: string | null;
      status?: ApplicationMilestone["status"];
      sortOrder?: number;
    },
  ): Promise<ApplicationMilestone> {
    await requireOwnership(this.supabase, userId, caseId);

    const milestone = createDomainMilestone({
      caseId,
      title: input.title,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      status: input.status ?? "pending",
      sortOrder: input.sortOrder ?? 0,
    });

    const repo = new ApplicationMilestoneRepository(
      this.supabase as unknown as import("@supabase/supabase-js").SupabaseClient<Database>,
    );
    return repo.create(milestone);
  }

  async updateMilestone(
    caseId: string,
    milestoneId: string,
    userId: string,
    patch: {
      title?: string;
      dueAt?: string | null;
      status?: ApplicationMilestone["status"];
      sortOrder?: number;
    },
  ): Promise<ApplicationMilestone> {
    await requireOwnership(this.supabase, userId, caseId);
    const repo = new ApplicationMilestoneRepository(
      this.supabase as unknown as import("@supabase/supabase-js").SupabaseClient<Database>,
    );
    const existing = await repo.findById(milestoneId);
    if (!existing) throw new NotFoundError("Milestone not found.");
    if (existing.caseId !== caseId) throw new NotFoundError("Milestone does not belong to this case.");

    let updated: ApplicationMilestone = existing;

    if (patch.title !== undefined) {
      const trimmed = patch.title.trim();
      if (trimmed.length === 0) {
        throw new ValidationError("Milestone title is required.", { field: "title" });
      }
      if (trimmed.length > 200) {
        throw new ValidationError("Milestone title must be 200 characters or fewer.", { field: "title" });
      }
      updated = { ...updated, title: trimmed, updatedAt: new Date() };
    }

    if (patch.dueAt !== undefined) {
      const dueAt = patch.dueAt ? new Date(patch.dueAt) : null;
      if (dueAt !== null && Number.isNaN(dueAt.getTime())) {
        throw new ValidationError("dueAt must be a valid date.", { field: "dueAt" });
      }
      updated = { ...updated, dueAt, updatedAt: new Date() };
    }

    if (patch.sortOrder !== undefined) {
      if (!Number.isInteger(patch.sortOrder) || patch.sortOrder < 0) {
        throw new ValidationError("sortOrder must be a non-negative integer.", { field: "sortOrder" });
      }
      updated = { ...updated, sortOrder: patch.sortOrder, updatedAt: new Date() };
    }

    if (patch.status !== undefined) {
      if (patch.status === "completed") {
        updated = completeMilestone(updated);
      } else {
        updated = transitionMilestone(updated, patch.status);
      }
    }

    // Re-validate aggregate after patches (ensures title/status/sortOrder constraints)
    validateCreateMilestoneInput({
      caseId: updated.caseId,
      title: updated.title,
      dueAt: updated.dueAt,
      sortOrder: updated.sortOrder,
      status: updated.status,
    });

    return repo.update(updated);
  }
}

export async function createApplicationOsService(): Promise<ApplicationOsService> {
  const supabase = await getServerClient();
  return new ApplicationOsService(supabase);
}
