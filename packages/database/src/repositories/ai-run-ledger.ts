import type { AiRunLedger, AiRunRecord } from "@offer-ai/ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

/**
 * Persists AI run records to the `ai_runs` table. Requires a service-role
 * client (the table has no client RLS policies).
 */
export class SupabaseAiRunLedger implements AiRunLedger {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async record(run: AiRunRecord): Promise<void> {
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
