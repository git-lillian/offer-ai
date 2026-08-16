import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";
import type { UserRole, RoleCode } from "@offer-ai/domain";

type Db = SupabaseClient<Database>;

export class UserRoleRepository {
  constructor(private readonly db: Db) {}

  async listByUser(userId: string): Promise<UserRole[]> {
    const { data } = await this.db
      .from("identity_user_roles")
      .select("*")
      .eq("user_id", userId);
    return (data ?? []).map((row) => ({
      userId: row.user_id,
      roleCode: row.role_code as RoleCode,
      assignedAt: new Date(row.assigned_at),
    }));
  }
}

export class AuditLogRepository {
  constructor(private readonly db: Db) {}

  async append(entry: {
    actorUserId: string | null;
    action: string;
    resourceType: string;
    resourceId: string;
    correlationId: string | null;
    metadata: Record<string, unknown> | null;
  }) {
    const { data, error } = await this.db
      .from("audit_logs")
      .insert({
        actor_user_id: entry.actorUserId,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId,
        correlation_id: entry.correlationId,
        metadata: entry.metadata,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }
}

export class AccessGrantRepository {
  constructor(private readonly db: Db) {}

  async listByStudent(studentId: string) {
    const { data } = await this.db
      .from("access_grants")
      .select("*")
      .eq("student_id", studentId);
    return data ?? [];
  }
}

export class AiRunRepository {
  constructor(private readonly db: Db) {}

  async record(run: {
    operation: string;
    provider: string;
    model: string;
    promptVersion: string;
    inputHash: string | null;
    studentId: string | null;
    applicationCaseId: string | null;
    artifactId: string | null;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number | null;
    status: "succeeded" | "failed";
    errorClass: string | null;
    correlationId: string | null;
  }) {
    const { error } = await this.db.from("ai_runs").insert({
      operation: run.operation,
      provider: run.provider,
      model: run.model,
      prompt_version: run.promptVersion,
      input_hash: run.inputHash,
      student_id: run.studentId,
      application_case_id: run.applicationCaseId,
      artifact_id: run.artifactId,
      latency_ms: run.latencyMs,
      input_tokens: run.inputTokens,
      output_tokens: run.outputTokens,
      estimated_cost_usd: run.estimatedCostUsd,
      status: run.status,
      error_class: run.errorClass,
      correlation_id: run.correlationId,
    });
    if (error) throw error;
  }
}

export class JobQueue {
  constructor(private readonly db: Db) {}

  /**
   * Enqueues a background job. Idempotent via idempotency_key: re-enqueueing
   * the same logical operation returns the existing job (atomic, handled by
   * the `enqueue_job` database function).
   */
  async enqueue(input: {
    kind: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
    correlationId?: string;
    maxAttempts?: number;
  }) {
    const { data, error } = await this.db.rpc("enqueue_job", {
      p_kind: input.kind,
      p_payload: input.payload,
      p_idempotency_key: input.idempotencyKey ?? null,
      p_correlation_id: input.correlationId ?? null,
      p_max_attempts: input.maxAttempts ?? 3,
    });
    if (error) throw error;
    return data as Database["public"]["Tables"]["background_jobs"]["Row"];
  }

  async claimBatch(limit = 5) {
    const { data, error } = await this.db
      .from("background_jobs")
      .select("*")
      .eq("status", "queued")
      .lte("available_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async markRunning(id: string, attempts: number) {
    const { error } = await this.db
      .from("background_jobs")
      .update({
        status: "running",
        attempts,
        started_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  }

  async markCompleted(id: string) {
    const { error } = await this.db
      .from("background_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  }

  async markFailed(id: string, errorMessage: string) {
    const { error } = await this.db
      .from("background_jobs")
      .update({
        status: "failed",
        last_error: errorMessage.slice(0, 2000),
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  }

  /** Backoff for retries: available_at = now + 2^attempt seconds. */
  async scheduleRetry(id: string, errorMessage: string, attempts: number) {
    const delayMs = 2 ** attempts * 1000;
    const { error } = await this.db
      .from("background_jobs")
      .update({
        status: "queued",
        last_error: errorMessage.slice(0, 2000),
        available_at: new Date(Date.now() + delayMs).toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  }
}
