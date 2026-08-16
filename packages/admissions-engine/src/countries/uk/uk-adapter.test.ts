import { describe, expect, it } from "vitest";
import { UKCountryAdapter, buildUKRecommendationScaffold } from "./uk-adapter";
import { getCountryAdapter, isSupportedCountry } from "../index";
import { RuleBasedEligibilityPipeline } from "../../engine/eligibility-engine";

describe("UKCountryAdapter", () => {
  it("parses a valid cycle code", async () => {
    const adapter = new UKCountryAdapter();
    const policy = await adapter.getApplicationCyclePolicy("2027/28", {
      profileVersion: "p1",
      catalogueVersion: "c1",
      rulesVersion: "r1",
    });
    expect(policy.entryYears).toEqual([2027]);
  });

  it("rejects an invalid cycle code", async () => {
    const adapter = new UKCountryAdapter();
    await expect(
      adapter.getApplicationCyclePolicy("not-a-cycle", {
        profileVersion: "p1",
        catalogueVersion: "c1",
        rulesVersion: "r1",
      }),
    ).rejects.toThrow();
  });

  it("maps external statuses to internal statuses", async () => {
    const adapter = new UKCountryAdapter();
    expect(await adapter.mapExternalApplicationStatus("conditional_offer")).toBe(
      "offer_received",
    );
    expect(await adapter.mapExternalApplicationStatus("rejected")).toBe("rejected");
    expect(await adapter.mapExternalApplicationStatus("draft")).toBe("draft");
  });

  it("returns baseline required documents", async () => {
    const adapter = new UKCountryAdapter();
    const docs = await adapter.determineRequiredDocuments({});
    expect(docs.documentKinds).toContain("transcript");
    expect(docs.documentKinds).toContain("personal_statement");
  });
});

describe("country adapter factory", () => {
  it("discovers the UK adapter by country code", () => {
    expect(getCountryAdapter("GB")).toBeInstanceOf(UKCountryAdapter);
    expect(isSupportedCountry("GB")).toBe(true);
    expect(isSupportedCountry("US")).toBe(false);
    expect(() => getCountryAdapter("US")).toThrow();
  });
});

describe("RuleBasedEligibilityPipeline", () => {
  const context = {
    profileVersion: "p1",
    catalogueVersion: "c1",
    rulesVersion: "r1",
  };

  it("evaluates a UK undergraduate application as eligible scaffold", async () => {
    const pipeline = new RuleBasedEligibilityPipeline(context);
    const result = await pipeline.evaluate({
      courseId: "course-1",
      intendedStudyLevel: "undergraduate",
      countryCode: "GB",
    });
    expect(result.eligibility).toBe("eligible");
    expect(result.profileVersion).toBe("p1");
    expect(result.rulesVersion).toBe("r1");
    expect(result.missingInformation).toEqual([]);
  });

  it("returns uncertain for unsupported levels with missing info", async () => {
    const pipeline = new RuleBasedEligibilityPipeline(context);
    const result = await pipeline.evaluate({
      courseId: "course-1",
      intendedStudyLevel: "postgraduate_taught",
      countryCode: "GB",
    });
    expect(result.eligibility).toBe("uncertain");
    expect(result.missingInformation.length).toBeGreaterThan(0);
  });

  it("rejects unsupported countries", async () => {
    const pipeline = new RuleBasedEligibilityPipeline(context);
    await expect(
      pipeline.evaluate({
        courseId: "course-1",
        intendedStudyLevel: "undergraduate",
        countryCode: "US",
      }),
    ).rejects.toThrow();
  });
});

describe("buildUKRecommendationScaffold", () => {
  it("marks a recommendation with eligibility and strategy band", () => {
    const recommendation = buildUKRecommendationScaffold(
      { courseId: "course-1", intendedStudyLevel: "undergraduate" },
      {
        profileVersion: "p1",
        catalogueVersion: "c1",
        rulesVersion: "r1",
      },
    );
    expect(recommendation.courseId).toBe("course-1");
    expect(recommendation.strategyBand).toBe("target");
    expect(recommendation.score).toBe(50);
  });
});
