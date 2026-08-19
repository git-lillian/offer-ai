/**
 * Deterministic fake provider for tests and local development without an
 * API key. Returns predictable, schema-valid output.
 */

import type {
  AIProvider,
  StructuredGenerationParams,
  StructuredGenerationResult,
  TextGenerationParams,
  TextGenerationResult,
} from "./provider";

export class FakeProvider implements AIProvider {
  readonly name = "fake" as const;
  readonly model: string;

  constructor(model = "fake-model") {
    this.model = model;
  }

  async generateText(params: TextGenerationParams): Promise<TextGenerationResult> {
    return {
      text: `[${params.operation}:${params.promptVersion}] ${params.userPrompt.slice(0, 2000)}`,
      model: this.model,
      usage: { inputTokens: 10, outputTokens: 10 },
      provider: this.name,
    };
  }

  async generateStructured<T>(
    params: StructuredGenerationParams<T>,
  ): Promise<StructuredGenerationResult<T>> {
    // Try naive parse first (schemas with defaults succeed). For schemas
    // requiring an `explanation` string (e.g. adviser output), synthesize a
    // deterministic valid value so tests using FakeProvider remain green.
    let data: T;
    try {
      data = params.schema.parse({});
    } catch {
      const shape = (params.schema as unknown as { shape?: Record<string, unknown> })?.shape;
      if (shape && "explanation" in shape) {
        data = params.schema.parse({
          explanation:
            "[fake:adviser] This is a deterministic fake explanation for testing. It explains the eligibility result using only the provided reasons and blockers, without inventing requirements.",
          keyPoints: ["Meets level requirement", "Check missing qualifications"],
        }) as T;
      } else {
        // Re-throw original validation error for genuinely invalid schemas.
        throw new Error("FakeProvider: schema validation failed for structured output (no default values).");
      }
    }
    return {
      data,
      model: this.model,
      usage: { inputTokens: 10, outputTokens: 10 },
      provider: this.name,
    };
  }
}
