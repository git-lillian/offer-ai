import { describe, expect, it } from "vitest";
import {
  ELIGIBILITY_OUTCOMES,
  STRATEGY_BANDS,
  type CourseRecommendation,
} from "./types";

describe("recommendation types", () => {
  it("exposes the expected eligibility outcomes", () => {
    expect(ELIGIBILITY_OUTCOMES).toContain("eligible");
    expect(ELIGIBILITY_OUTCOMES).toContain("ineligible");
    expect(ELIGIBILITY_OUTCOMES).toContain("uncertain");
  });

  it("exposes the strategy bands", () => {
    expect(STRATEGY_BANDS).toEqual(["aspirational", "target", "safer"]);
  });

  it("keeps the recommendation shape reproducible", () => {
    const recommendation: CourseRecommendation = {
      courseId: "c1",
      eligibility: "eligible",
      strategyBand: "target",
      score: 50,
      confidence: 0.6,
      reasons: [],
      blockers: [],
      missingInformation: [],
      profileVersion: "p1",
      catalogueVersion: "c1",
      rulesVersion: "r1",
    };
    expect(recommendation.eligibility).toBe("eligible");
  });
});
