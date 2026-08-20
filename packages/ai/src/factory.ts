import type { ServerEnv } from "@offer-ai/config";
import { DeepSeekProvider } from "./deepseek";
import { FakeProvider } from "./fake";
import type { AIProvider } from "./provider";

export function createAIProvider(env: ServerEnv): AIProvider {
  if (env.AI_PROVIDER === "fake") {
    return new FakeProvider("fake-model");
  }

  if (env.AI_PROVIDER === "opencode") {
    const apiKey = env.OPENCODE_API_KEY ?? env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error(
        "AI_PROVIDER=opencode requires OPENCODE_API_KEY (or DEEPSEEK_API_KEY) to be configured.",
      );
    }
    return new DeepSeekProvider({
      apiKey,
      baseUrl: env.OPENCODE_BASE_URL ?? env.DEEPSEEK_BASE_URL,
      model: env.AI_MODEL,
    });
  }

  if (!env.DEEPSEEK_API_KEY) {
    throw new Error(
      "AI_PROVIDER=deepseek requires DEEPSEEK_API_KEY to be configured.",
    );
  }

  return new DeepSeekProvider({
    apiKey: env.DEEPSEEK_API_KEY,
    baseUrl: env.DEEPSEEK_BASE_URL,
    model: env.AI_MODEL,
  });
}

export type { AIProvider } from "./provider";
