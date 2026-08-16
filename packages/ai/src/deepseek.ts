/**
 * DeepSeek provider — OpenAI-compatible chat completions.
 *
 * Only this file knows the DeepSeek base URL and SDK details; the rest of
 * the application sees only the `AIProvider` interface.
 */

import OpenAI from "openai";
import type {
  AIProvider,
  StructuredGenerationParams,
  StructuredGenerationResult,
  TextGenerationParams,
  TextGenerationResult,
} from "./provider";
import { ExternalServiceError, RateLimitError } from "@offer-ai/domain";

export interface DeepSeekProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Max retries for transient failures. */
  maxRetries?: number;
}

function isTransientError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    if (status >= 500 || status === 429) return true;
  }
  return false;
}

async function withRetries<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries && isTransientError(error)) {
        const delay = 2 ** attempt * 200;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export class DeepSeekProvider implements AIProvider {
  readonly name = "deepseek" as const;

  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxRetries: number;

  constructor(config: DeepSeekProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
    this.model = config.model;
    this.maxRetries = config.maxRetries ?? 2;
  }

  async generateText(params: TextGenerationParams): Promise<TextGenerationResult> {
    return withRetries(() => this.callText(params), this.maxRetries);
  }

  async generateStructured<T>(
    params: StructuredGenerationParams<T>,
  ): Promise<StructuredGenerationResult<T>> {
    return withRetries(() => this.callStructured(params), this.maxRetries);
  }

  private async callText(params: TextGenerationParams) {
    try {
      const completion = await this.client.chat.completions.create(
        {
          model: this.model,
          temperature: params.temperature ?? 0.6,
          max_tokens: params.maxTokens,
          messages: [
            { role: "system", content: params.systemPrompt },
            { role: "user", content: params.userPrompt },
          ],
        },
        { timeout: params.timeoutMs ?? 60_000 },
      );

      const text = completion.choices[0]?.message?.content?.trim();
      if (!text) {
        throw new ExternalServiceError("AI provider returned an empty response.");
      }

      return {
        text,
        model: this.model,
        usage: {
          inputTokens: completion.usage?.prompt_tokens ?? 0,
          outputTokens: completion.usage?.completion_tokens ?? 0,
        },
        provider: this.name,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private async callStructured<T>(params: StructuredGenerationParams<T>) {
    const result = await this.callText({
      operation: params.operation,
      systemPrompt: params.systemPrompt,
      userPrompt: `${params.userPrompt}\n\nReturn a single valid JSON object matching this schema:\n${JSON.stringify((params.schema as { shape?: unknown }).shape ?? {})}`,
      promptVersion: params.promptVersion,
      temperature: params.temperature ?? 0.2,
      maxTokens: params.maxTokens ?? 1024,
      correlationId: params.correlationId,
      timeoutMs: params.timeoutMs,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      throw new ExternalServiceError(
        "AI provider returned invalid JSON for structured output.",
      );
    }

    const validated = params.schema.safeParse(parsed);
    if (!validated.success) {
      throw new ExternalServiceError(
        "AI structured output failed schema validation.",
        { issues: validated.error.issues.map((issue) => issue.message) },
      );
    }

    return {
      data: validated.data,
      model: result.model,
      usage: result.usage,
      provider: this.name,
    };
  }

  private mapError(error: unknown): Error {
    if (typeof error === "object" && error !== null && "status" in error) {
      const status = Number((error as { status?: unknown }).status);
      if (status === 429) {
        return new RateLimitError("AI provider rate limit exceeded.");
      }
    }
    if (error instanceof ExternalServiceError || error instanceof RateLimitError) {
      return error;
    }
    return new ExternalServiceError("AI provider request failed.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
