import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";
import type {
  ApplicationMilestone,
  ApplicationMilestoneStatus,
} from "@offer-ai/domain";
import type { ApplicationTask } from "@offer-ai/domain";

type Db = SupabaseClient<Database>;

// ── Milestones ───────────────────────────────────────────────────────────

export class ApplicationMilestoneRepository {
  constructor(private readonly db: Db) {}

  async listByCase(caseId: string): Promise<ApplicationMilestone[]> {
    const { data, error } = await this.db
      .from("application_milestones")
      .select("*")
      .eq("case_id", caseId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => this.toMilestone(row));
  }

  async findById(id: string): Promise<ApplicationMilestone | null> {
    const { data, error } = await this.db
      .from("application_milestones")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return this.toMilestone(data);
  }

  async create(milestone: ApplicationMilestone): Promise<ApplicationMilestone> {
    const { data, error } = await this.db
      .from("application_milestones")
      .insert({
        id: milestone.id,
        case_id: milestone.caseId,
        title: milestone.title,
        due_at: milestone.dueAt?.toISOString() ?? null,
        status: milestone.status,
        sort_order: milestone.sortOrder,
      })
      .select("*")
      .single();
    if (error) throw error;
    return this.toMilestone(data);
  }

  async createMany(
    milestones: ApplicationMilestone[],
  ): Promise<ApplicationMilestone[]> {
    if (milestones.length === 0) return [];
    const { data, error } = await this.db
      .from("application_milestones")
      .insert(
        milestones.map((m) => ({
          id: m.id,
          case_id: m.caseId,
          title: m.title,
          due_at: m.dueAt?.toISOString() ?? null,
          status: m.status,
          sort_order: m.sortOrder,
        })),
      )
      .select("*");
    if (error) throw error;
    return (data ?? []).map((row) => this.toMilestone(row));
  }

  async update(milestone: ApplicationMilestone): Promise<ApplicationMilestone> {
    const { data, error } = await this.db
      .from("application_milestones")
      .update({
        title: milestone.title,
        due_at: milestone.dueAt?.toISOString() ?? null,
        status: milestone.status,
        sort_order: milestone.sortOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", milestone.id)
      .select("*")
      .single();
    if (error) throw error;
    return this.toMilestone(data);
  }

  async updateStatus(
    id: string,
    status: ApplicationMilestoneStatus,
  ): Promise<ApplicationMilestone> {
    const existing = await this.findById(id);
    if (!existing) throw new Error("Milestone not found.");
    return this.update({ ...existing, status, updatedAt: new Date() });
  }

  private toMilestone(
    row: Database["public"]["Tables"]["application_milestones"]["Row"],
  ): ApplicationMilestone {
    return {
      id: row.id,
      caseId: row.case_id,
      title: row.title,
      dueAt: row.due_at ? new Date(row.due_at) : null,
      status: row.status as ApplicationMilestoneStatus,
      sortOrder: row.sort_order,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// ── OS task queries (thin wrapper over application_tasks) ───────────────
// Kept here so the OS aggregate has a single repository entry point; the
// existing ApplicationTaskRepository remains the canonical task store.

export class ApplicationOsTaskRepository {
  constructor(private readonly db: Db) {}

  async listByCase(caseId: string): Promise<ApplicationTask[]> {
    const { data, error } = await this.db
      .from("application_tasks")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => this.toTask(row));
  }

  async create(task: ApplicationTask): Promise<ApplicationTask> {
    const { data, error } = await this.db
      .from("application_tasks")
      .insert({
        id: task.id,
        case_id: task.caseId,
        title: task.title,
        description: task.description,
        source: task.source,
        assignee_user_id: task.assigneeUserId,
        due_at: task.dueAt?.toISOString() ?? null,
        priority: task.priority,
        status: task.status,
      })
      .select("*")
      .single();
    if (error) throw error;
    return this.toTask(data);
  }

  async createMany(tasks: ApplicationTask[]): Promise<ApplicationTask[]> {
    if (tasks.length === 0) return [];
    const { data, error } = await this.db
      .from("application_tasks")
      .insert(
        tasks.map((t) => ({
          id: t.id,
          case_id: t.caseId,
          title: t.title,
          description: t.description,
          source: t.source,
          assignee_user_id: t.assigneeUserId,
          due_at: t.dueAt?.toISOString() ?? null,
          priority: t.priority,
          status: t.status,
        })),
      )
      .select("*");
    if (error) throw error;
    return (data ?? []).map((row) => this.toTask(row));
  }

  async update(task: ApplicationTask): Promise<ApplicationTask> {
    const { data, error } = await this.db
      .from("application_tasks")
      .update({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_at: task.dueAt?.toISOString() ?? null,
        assignee_user_id: task.assigneeUserId,
        completion_evidence: task.completionEvidence,
        completed_at: task.completedAt?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id)
      .select("*")
      .single();
    if (error) throw error;
    return this.toTask(data);
  }

  async updateStatus(
    id: string,
    status: ApplicationTask["status"],
    extra?: Partial<Pick<ApplicationTask, "completionEvidence" | "completedAt">>,
  ): Promise<ApplicationTask> {
    const { data: existing, error: findError } = await this.db
      .from("application_tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (findError) throw findError;
    if (!existing) throw new Error("Task not found.");
    const current = this.toTask(existing);
    const updated: ApplicationTask = {
      ...current,
      status,
      completionEvidence: extra?.completionEvidence ?? current.completionEvidence,
      completedAt: extra?.completedAt ?? current.completedAt,
      updatedAt: new Date(),
    };
    return this.update(updated);
  }

  private toTask(
    row: Database["public"]["Tables"]["application_tasks"]["Row"],
  ): ApplicationTask {
    return {
      id: row.id,
      caseId: row.case_id,
      title: row.title,
      description: row.description,
      source: row.source as ApplicationTask["source"],
      assigneeUserId: row.assignee_user_id,
      dueAt: row.due_at ? new Date(row.due_at) : null,
      priority: row.priority as ApplicationTask["priority"],
      status: row.status as ApplicationTask["status"],
      completionEvidence: row.completion_evidence,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
