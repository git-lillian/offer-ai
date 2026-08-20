/**
 * ai.generate_artifact — background generation of artifact content.
 *
 * Validates the payload with zod, calls the AI provider through the
 * `@offer-ai/ai` abstraction (never constructing a provider inline), records
 * the run in `ai_runs` via the ledger, and persists the generated version
 * through the artifact repository. The job is idempotent: re-running the
 * same artifactId + versionNumber pair will upsert the same version row
 * without duplicating rows when the database unique constraint exists.
 */

import { createServiceSupabaseClient } from "@offer-ai/database";
import { ArtifactRepository, SupabaseAiRunLedger } from "@offer-ai/database";
import { createAIProvider } from "@offer-ai/ai";
import { hashInput, estimateCostUsd } from "@offer-ai/ai";
import { PERSONAL_STATEMENT_PROMPT } from "@offer-ai/ai";
import { generateArtifactJobPayloadSchema } from "@offer-ai/contracts";
import { getServerEnv } from "@offer-ai/config";
import type { JobContext, JobHandler } from "./registry";

function promptForArtifactType(artifactType: string): { system: string; version: string } {
  if (artifactType === "personal_statement" || artifactType === "statement_of_purpose") {
    return { system: PERSONAL_STATEMENT_PROMPT.system, version: PERSONAL_STATEMENT_PROMPT.version };
  }
  // Minimal generic prompt for other artifact types — the model never decides
  // eligibility, it only helps draft the text. Provenance is tracked via
  // promptVersion + modelRunId.
  return {
    system:
      "You are an expert writing assistant for university applications. Help draft clear, honest, British English text using only the applicant's provided information. Never invent grades, employers or achievements.",
    version: "artifact_generic_v1",
  };
}

export const generateArtifactHandler: JobHandler = {
  kind: "ai.generate_artifact",
  async handle(payload, context: JobContext): Promise<void> {
    const parsed = generateArtifactJobPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Invalid ai.generate_artifact payload: ${parsed.error.message}`);
    }
    const data = parsed.data;

    context.logger.info("ai.generate_artifact started", {
      artifactId: data.artifactId,
      studentId: data.studentId,
      artifactType: data.artifactType,
      promptVersion: data.promptVersion ?? null,
    });

    const env = getServerEnv();
    const provider = createAIProvider(env);
    const service = createServiceSupabaseClient();
    const ledger = new SupabaseAiRunLedger(service);
    const artifactRepo = new ArtifactRepository(service as unknown as never);

    const artifact = await artifactRepo.findById(data.artifactId);
    if (!artifact) {
      throw new Error(`Artifact not found: ${data.artifactId}`);
    }

    const { system, version: defaultVersion } = promptForArtifactType(data.artifactType);
    const promptVersion = data.promptVersion ?? defaultVersion;
    const userPrompt = data.prompt?.trim() ?? `Draft a ${data.artifactType} for student ${data.studentId}.`;

    const startedAt = Date.now();
    let generatedText: string | null = null;
    let modelName: string = provider.name;
    let usage = { inputTokens: 0, outputTokens: 0 };

    try {
      const result = await provider.generateText({
        operation: "generate_artifact",
        systemPrompt: system,
        userPrompt,
        promptVersion,
        correlationId: data.correlationId ?? context.correlationId ?? undefined,
      });
      generatedText = result.text;
      modelName = result.model;
      usage = result.usage;

      const latencyMs = Date.now() - startedAt;
      const inputHash = hashInput(userPrompt);
      const cost = estimateCostUsd(modelName, usage.inputTokens, usage.outputTokens);

      await ledger.record({
        operation: "generate_artifact",
        provider: result.provider,
        model: result.model,
        promptVersion,
        inputHash,
        studentId: data.studentId,
        applicationCaseId: data.caseId ?? null,
        artifactId: data.artifactId,
        latencyMs,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimatedCostUsd: cost,
        status: "succeeded",
        errorClass: null,
        correlationId: data.correlationId ?? context.correlationId ?? null,
      });

      // Persist as a new version. Resolve the next version number from the
      // existing versions so the job is durable across retries.
      const existingVersions = await artifactRepo.listVersions(data.artifactId);
      const nextVersionNumber =
        data.versionNumber ??
        (existingVersions.length === 0
          ? 1
          : Math.max(...existingVersions.map((v) => v.versionNumber)) + 1);

      // Idempotency: if a version with this number already exists, reuse it.
      const alreadyExists = existingVersions.find(
        (v) => v.versionNumber === nextVersionNumber,
      );
      if (!alreadyExists) {
        await artifactRepo.addVersion({
          id: crypto.randomUUID(),
          artifactId: data.artifactId,
          versionNumber: nextVersionNumber,
          content: generatedText,
          creatorUserId: data.studentId, // worker run is on behalf of the student
          origin: "ai",
          promptVersion,
          modelRunId: null,
          evidenceUsed: [],
          approvalState: "draft",
          createdAt: new Date(),
        });
      }

      context.logger.info("ai.generate_artifact completed", {
        artifactId: data.artifactId,
        versionNumber: nextVersionNumber,
        model: modelName,
        latencyMs,
        promptVersion,
      });
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      const inputHash = hashInput(userPrompt);

      try {
        await ledger.record({
          operation: "generate_artifact",
          provider: provider.name,
          model: modelName,
          promptVersion,
          inputHash,
          studentId: data.studentId,
          applicationCaseId: data.caseId ?? null,
          artifactId: data.artifactId,
          latencyMs,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          estimatedCostUsd: null,
          status: "failed",
          errorClass: error instanceof Error ? error.name : "UnknownError",
          correlationId: data.correlationId ?? context.correlationId ?? null,
        });
      } catch (ledgerError) {
        context.logger.error("failed to record ai run for generate_artifact", {
          error: ledgerError instanceof Error ? ledgerError.message : String(ledgerError),
        });
      }

      throw new Error(`ai.generate_artifact failed: ${message}`);
    }
  },
};
