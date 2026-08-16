import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";
import type { ApplicationTask } from "@offer-ai/domain";

type Db = SupabaseClient<Database>;

export class ApplicationTaskRepository {
  constructor(private readonly db: Db) {}

  async create(task: ApplicationTask): Promise<ApplicationTask> {
    const { data, error } = await this.db
      .from("application_tasks")
      .insert({
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

  async listByCase(caseId: string): Promise<ApplicationTask[]> {
    const { data } = await this.db
      .from("application_tasks")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });
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
