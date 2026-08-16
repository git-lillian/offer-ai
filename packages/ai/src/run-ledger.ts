/**
 * AI run ledger — records every AI execution for auditability and cost
 * control. The persistence implementation lives in `packages/database`
 * (`AiRunLedger`); packages/ai only defines the contract.
 */

export interface AiRunRecord {
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
}

export interface AiRunLedger {
  record(run: AiRunRecord): Promise<void>;
}

/** Simple deterministic hash for input deduplication without raw retention. */
export function hashInput(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0;
  }
  return `h${(hash >>> 0).toString(36)}`;
}

/** Approximate pricing per model (USD per 1M tokens) — update with provider pricing. */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "deepseek-v4-flash": { input: 0.27, output: 1.1 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return null;
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}
