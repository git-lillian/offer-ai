/**
 * AdviserService — explains deterministic eligibility via LLM.
 *
 * Rules decide; LLM explains. Every run is recorded in the ai_runs ledger
 * with provenance (provider/model/promptVersion/latency/tokens).
 */

import { z } from "zod";
import type { AIProvider } from "../provider";
import type { AiRunLedger } from "../run-ledger";
import { estimateCostUsd, hashInput } from "../run-ledger";
import type {
  CourseAdviserContext,
  RecommendationAdviserContext,
  StudentAdviserContext,
} from "../context/build-context";
import {
  buildUserContent,
  id as PROMPT_ID,
  system as PROMPT_SYSTEM,
  version as PROMPT_VERSION,
} from "../../prompts/adviser/explain-eligibility/v1";

/**
 * Zod validation at the AI boundary — provider output is never trusted.
 */
export const adviserExplanationOutputSchema = z.object({
  explanation: z.string().trim().min(20).max(5000),
});

export type AdviserExplanationOutput = z.infer<typeof adviserExplanationOutputSchema>;

/**
 * Plain-text validation (when using generateText).
 */
const explanationTextSchema = z.string().trim().min(20).max(5000);

export interface ExplainEligibilityInput {
  studentId: string;
  courseId: string;
  studentContext: StudentAdviserContext;
  courseContext: CourseAdviserContext;
  recommendation: RecommendationAdviserContext;
  correlationId?: string | null;
  applicationCaseId?: string | null;
  artifactId?: string | null;
}

export interface ExplainEligibilityResult {
  explanation: string;
  provenance: {
    provider: string;
    model: string;
    promptVersion: string;
    latencyMs: number;
    inputHash: string;
    correlationId: string | null;
  };
}

export interface AdviserServiceDeps {
  provider: AIProvider;
  ledger: AiRunLedger;
}

export class AdviserService {
  constructor(private readonly deps: AdviserServiceDeps) {}

  /**
   * Generate a friendly explanation for a deterministic recommendation.
   *
   * The LLM receives only the minimal contexts and the exact reasons/blockers;
   * it must not invent requirements. Validation and ledger recording are
   * mandatory; errors surface as typed domain errors upstream.
   */
  async explainEligibility(input: ExplainEligibilityInput): Promise<ExplainEligibilityResult> {
    const userPrompt = buildUserContent({
      studentContext: input.studentContext,
      courseContext: input.courseContext,
      recommendation: input.recommendation,
    });

    const operation = "adviser.explain_eligibility";
    const promptVersion = `${PROMPT_ID}:${PROMPT_VERSION}`;
    const correlationId = input.correlationId ?? null;
    const inputHash = hashInput(userPrompt);
    const startedAt = Date.now();

    let rawText: string | null = null;
    let model: string = this.deps.provider.name;
    let providerName: string = this.deps.provider.name;
    let usage = { inputTokens: 0, outputTokens: 0 };
    let latencyMs = 0;

    try {
      const result = await this.deps.provider.generateText({
        operation,
        systemPrompt: PROMPT_SYSTEM,
        userPrompt,
        promptVersion,
        correlationId: correlationId ?? undefined,
      });

      rawText = result.text;
      model = result.model;
      providerName = result.provider;
      usage = result.usage;
      latencyMs = Date.now() - startedAt;

      // Validate at the boundary — never trust raw LLM output.
      const explanation = explanationTextSchema.parse(rawText);

      // Optional second-level structured validation (defence in depth).
      adviserExplanationOutputSchema.parse({ explanation });

      const cost = estimateCostUsd(model, usage.inputTokens, usage.outputTokens);

      await this.deps.ledger.record({
        operation,
        provider: providerName,
        model,
        promptVersion,
        inputHash,
        studentId: input.studentId,
        applicationCaseId: input.applicationCaseId ?? null,
        artifactId: input.artifactId ?? null,
        latencyMs,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimatedCostUsd: cost,
        status: "succeeded",
        errorClass: null,
        correlationId,
      });

      return {
        explanation,
        provenance: {
          provider: providerName,
          model,
          promptVersion,
          latencyMs,
          inputHash,
          correlationId,
        },
      };
    } catch (error) {
      latencyMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      const errorClass = error instanceof Error ? error.name : "UnknownError";

      // Record failure — best-effort, never swallow original error.
      try {
        await this.deps.ledger.record({
          operation,
          provider: providerName,
          model,
          promptVersion,
          inputHash,
          studentId: input.studentId,
          applicationCaseId: input.applicationCaseId ?? null,
          artifactId: input.artifactId ?? null,
          latencyMs,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          estimatedCostUsd: null,
          status: "failed",
          errorClass,
          correlationId,
        });
      } catch {
        // Ledger failures are logged by the caller; do not mask the original error.
      }

      // Re-throw with context — caller maps to DomainError if needed.
      throw new Error(`AdviserService.explainEligibility failed: ${message}`);
    }
  }

  /**
   * Alternative structured path — uses generateStructured with zod validation
   * inside the provider. Kept for callers that need JSON. Ledger handling
   * mirrors the text path.
   */
  async explainEligibilityStructured(input: ExplainEligibilityInput): Promise<ExplainEligibilityResult> {
    const userPrompt = buildUserContent({
      studentContext: input.studentContext,
      courseContext: input.courseContext,
      recommendation: input.recommendation,
    });

    const operation = "adviser.explain_eligibility";
    const promptVersion = `${PROMPT_ID}:${PROMPT_VERSION}`;
    const correlationId = input.correlationId ?? null;
    const inputHash = hashInput(userPrompt);
    const startedAt = Date.now();

    let usage = { inputTokens: 0, outputTokens: 0 };
    let model: string = this.deps.provider.name;
    let providerName: string = this.deps.provider.name;
    let latencyMs = 0;

    try {
      const result = await this.deps.provider.generateStructured<AdviserExplanationOutput>({
        operation,
        systemPrompt: PROMPT_SYSTEM,
        userPrompt,
        promptVersion,
        schema: adviserExplanationOutputSchema,
        correlationId: correlationId ?? undefined,
      });

      model = result.model;
      providerName = result.provider;
      usage = result.usage;
      latencyMs = Date.now() - startedAt;

      const explanation = explanationTextSchema.parse(result.data.explanation);
      const cost = estimateCostUsd(model, usage.inputTokens, usage.outputTokens);

      await this.deps.ledger.record({
        operation,
        provider: providerName,
        model,
        promptVersion,
        inputHash,
        studentId: input.studentId,
        applicationCaseId: input.applicationCaseId ?? null,
        artifactId: input.artifactId ?? null,
        latencyMs,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimatedCostUsd: cost,
        status: "succeeded",
        errorClass: null,
        correlationId,
      });

      return {
        explanation,
        provenance: {
          provider: providerName,
          model,
          promptVersion,
          latencyMs,
          inputHash,
          correlationId,
        },
      };
    } catch (error) {
      latencyMs = Date.now() - startedAt;
      const errorClass = error instanceof Error ? error.name : "UnknownError";
      try {
        await this.deps.ledger.record({
          operation,
          provider: providerName,
          model,
          promptVersion,
          inputHash,
          studentId: input.studentId,
          applicationCaseId: input.applicationCaseId ?? null,
          artifactId: input.artifactId ?? null,
          latencyMs,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          estimatedCostUsd: null,
          status: "failed",
          errorClass,
          correlationId,
        });
      } catch {
        // ignore
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`AdviserService.explainEligibilityStructured failed: ${message}`);
    }
  }
}
