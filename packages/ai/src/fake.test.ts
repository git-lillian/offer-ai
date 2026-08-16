import { describe, expect, it } from "vitest";
import { FakeProvider } from "./fake";
import { hashInput } from "./run-ledger";
import {
  PERSONAL_STATEMENT_PROMPT,
  buildPersonalStatementUserPrompt,
} from "./prompts";
import { z } from "zod";

describe("FakeProvider", () => {
  it("generates deterministic text", async () => {
    const provider = new FakeProvider();
    const result = await provider.generateText({
      operation: "test.generate",
      systemPrompt: "system",
      userPrompt: "hello",
      promptVersion: "v1",
    });
    expect(result.text).toContain("test.generate:v1");
    expect(result.provider).toBe("fake");
    expect(result.usage.inputTokens).toBe(10);
  });

  it("generates schema-valid structured output", async () => {
    const provider = new FakeProvider();
    const schema = z.object({ ok: z.boolean().default(true) });
    const result = await provider.generateStructured({
      operation: "test.structured",
      systemPrompt: "system",
      userPrompt: "input",
      promptVersion: "v1",
      schema,
    });
    expect(result.data).toEqual({ ok: true });
  });
});

describe("input hashing", () => {
  it("is deterministic and content-sensitive", () => {
    expect(hashInput("same input")).toBe(hashInput("same input"));
    expect(hashInput("a")).not.toBe(hashInput("b"));
  });
});

describe("personal statement prompt asset", () => {
  it("has a stable id and version", () => {
    expect(PERSONAL_STATEMENT_PROMPT.id).toBe("personal_statement");
    expect(PERSONAL_STATEMENT_PROMPT.version).toBe("v1");
  });

  it("builds a user prompt from answers", () => {
    const prompt = buildPersonalStatementUserPrompt({
      fullName: "Alex Li",
      course: "MSc Computer Science",
      university: "University of Edinburgh",
      motivation: "Interested in ML",
      experience: "Built a chatbot",
      careerGoals: "Become an engineer",
    });
    expect(prompt).toContain("Alex Li");
    expect(prompt).toContain("MSc Computer Science");
  });

  it("fills missing answers with Not provided", () => {
    const prompt = buildPersonalStatementUserPrompt({});
    expect(prompt).toContain("Not provided");
  });
});
