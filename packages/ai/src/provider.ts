/**
 * AI provider abstraction.
 *
 * Application code never constructs `new OpenAI()` directly and never
 * hard-codes model names. Providers are created through the factory and
 * used through this interface, keeping providers interchangeable and model
 * routing centralised.
 */

import type { z } from "zod";

export type AIProviderName = "deepseek" | "fake";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface TextGenerationResult {
  text: string;
  model: string;
  usage: TokenUsage;
  provider: AIProviderName;
}

export interface StructuredGenerationResult<T> {
  data: T;
  model: string;
  usage: TokenUsage;
  provider: AIProviderName;
}

export interface TextGenerationParams {
  operation: string;
  systemPrompt: string;
  userPrompt: string;
  promptVersion: string;
  temperature?: number;
  maxTokens?: number;
  correlationId?: string;
  timeoutMs?: number;
}

export interface StructuredGenerationParams<T> {
  operation: string;
  systemPrompt: string;
  userPrompt: string;
  promptVersion: string;
  schema: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
  correlationId?: string;
  timeoutMs?: number;
}

export interface AIProvider {
  readonly name: AIProviderName;
  generateText(params: TextGenerationParams): Promise<TextGenerationResult>;
  generateStructured<T>(params: StructuredGenerationParams<T>): Promise<StructuredGenerationResult<T>>;
}
