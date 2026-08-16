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
      text: `[${params.operation}:${params.promptVersion}] ${params.userPrompt.slice(0, 400)}`,
      model: this.model,
      usage: { inputTokens: 10, outputTokens: 10 },
      provider: this.name,
    };
  }

  async generateStructured<T>(
    params: StructuredGenerationParams<T>,
  ): Promise<StructuredGenerationResult<T>> {
    const data = params.schema.parse({});
    return {
      data,
      model: this.model,
      usage: { inputTokens: 10, outputTokens: 10 },
      provider: this.name,
    };
  }
}
