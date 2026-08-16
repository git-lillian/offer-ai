import { describe, expect, it } from "vitest";
import { onboardingStepSchema, budgetRangeSchema } from "./onboarding";

describe("onboarding step schemas", () => {
  it("validates step 1 (basic details)", () => {
    const result = onboardingStepSchema.safeParse({ step: 1, fullName: "Alex Li" });
    expect(result.success).toBe(true);
  });

  it("rejects a too-short name", () => {
    const result = onboardingStepSchema.safeParse({ step: 1, fullName: "A" });
    expect(result.success).toBe(false);
  });

  it("validates step 2 (location) with ISO country codes", () => {
    const result = onboardingStepSchema.safeParse({
      step: 2,
      currentCountryCode: "CN",
      nationalityCountryCode: "CN",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid country codes", () => {
    const result = onboardingStepSchema.safeParse({
      step: 2,
      currentCountryCode: "cn",
      nationalityCountryCode: null,
    });
    expect(result.success).toBe(false);
  });

  it("validates step 5 (budget) with min <= max", () => {
    expect(budgetRangeSchema.safeParse({ currencyCode: "GBP", min: 1000, max: 2000 }).success).toBe(true);
    expect(budgetRangeSchema.safeParse({ currencyCode: "GBP", min: 2000, max: 1000 }).success).toBe(false);
  });

  it("rejects unknown steps", () => {
    const result = onboardingStepSchema.safeParse({ step: 9 });
    expect(result.success).toBe(false);
  });
});
