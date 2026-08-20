import { describe, expect, it, vi } from "vitest";
import type { AiRunRecord, AiRunLedger } from "../run-ledger";
import { FakeProvider } from "../fake";
import { AdviserService } from "./adviser-service";
import type {
  CourseAdviserContext,
  RecommendationAdviserContext,
  StudentAdviserContext,
} from "../context/build-context";

class InMemoryLedger implements AiRunLedger {
  records: AiRunRecord[] = [];
  async record(run: AiRunRecord): Promise<void> {
    this.records.push(run);
  }
}

function studentContext(overrides: Partial<StudentAdviserContext> = {}): StudentAdviserContext {
  return {
    studentId: "student-1",
    intendedStudyLevel: "undergraduate",
    currentEducationLevel: "high_school",
    englishProficiencyStatus: "exempt",
    targetEntryYear: 2026,
    budgetRange: { currencyCode: "GBP", min: 20000, max: 40000 },
    qualifications: [{ system: "a_level", title: "A Levels", grade: "A*AA", predictedGrade: null, overallGpa: null, gpaScaleMax: null }],
    evidenceRefs: [{ id: "ev-1", verificationStatus: "human_verified", evidenceType: "transcript" }],
    ...overrides,
  };
}

function courseContext(overrides: Partial<CourseAdviserContext> = {}): CourseAdviserContext {
  return {
    courseId: "course-1",
    title: "BSc Computer Science",
    level: "undergraduate",
    durationMonths: 36,
    tuitionFee: 25000,
    currencyCode: "GBP",
    applicationRoutes: ["ucas"],
    institution: {
      id: "inst-1",
      name: "University of Edinburgh",
      slug: "university-of-edinburgh",
      countryCode: "GB",
      city: "Edinburgh",
    },
    requirements: [
      { kind: "academic", sourceText: "A*AA required", structured: { grades: "A*AA" }, verificationStatus: "human_verified" },
    ],
    ...overrides,
  };
}

function recommendationContext(overrides: Partial<RecommendationAdviserContext> = {}): RecommendationAdviserContext {
  return {
    courseId: "course-1",
    eligibility: "eligible",
    strategyBand: "target",
    score: 72,
    confidence: 0.82,
    reasons: [{ code: "uk_level_match", message: "Intended level matches course" }],
    blockers: [],
    missingInformation: [],
    profileVersion: "p-v1",
    catalogueVersion: "c-v1",
    rulesVersion: "uk-v1",
    ...overrides,
  };
}

describe("AdviserService", () => {
  it("generates explanation with FakeProvider and records ledger", async () => {
    const provider = new FakeProvider("fake-model");
    const ledger = new InMemoryLedger();
    const service = new AdviserService({ provider, ledger });

    const result = await service.explainEligibility({
      studentId: "student-1",
      courseId: "course-1",
      studentContext: studentContext(),
      courseContext: courseContext(),
      recommendation: recommendationContext(),
      correlationId: "corr-1",
    });

    expect(result.explanation).toContain("adviser.explain_eligibility");
    expect(result.explanation.length).toBeGreaterThanOrEqual(20);
    expect(result.provenance.provider).toBe("fake");
    expect(result.provenance.model).toBe("fake-model");
    expect(result.provenance.promptVersion).toContain("adviser.explain_eligibility");
    expect(result.provenance.correlationId).toBe("corr-1");
    expect(result.provenance.inputHash).toMatch(/^h/);

    expect(ledger.records).toHaveLength(1);
    const run = ledger.records[0]!;
    expect(run.operation).toBe("adviser.explain_eligibility");
    expect(run.provider).toBe("fake");
    expect(run.promptVersion).toContain("adviser.explain_eligibility");
    expect(run.studentId).toBe("student-1");
    expect(run.status).toBe("succeeded");
    expect(run.inputHash).toBe(result.provenance.inputHash);
    expect(run.correlationId).toBe("corr-1");
  });

  it("explains ineligible with hard blocker deterministically", async () => {
    const provider = new FakeProvider();
    const ledger = new InMemoryLedger();
    const service = new AdviserService({ provider, ledger });

    const rec = recommendationContext({
      eligibility: "ineligible",
      strategyBand: "safer",
      blockers: [{ code: "uk_language_below", message: "IELTS below 6.5", severity: "hard" }],
      reasons: [{ code: "uk_language_fail", message: "Language requirement not met" }],
    });

    const result = await service.explainEligibility({
      studentId: "student-1",
      courseId: "course-1",
      studentContext: studentContext({ englishProficiencyStatus: "taken" }),
      courseContext: courseContext(),
      recommendation: rec,
    });

    // FakeProvider echoes prompt content; ensure our prompt serialised the blockers
    expect(result.explanation).toContain("uk_language_below");
    expect(ledger.records[0]!.status).toBe("succeeded");
  });

  it("records failed ledger on provider failure", async () => {
    const failingProvider = {
      name: "fake" as const,
      model: "fake-model",
      async generateText(): Promise<never> {
        throw new Error("network down");
      },
      async generateStructured<_T>(): Promise<never> {
        throw new Error("network down");
      },
    };
    const ledger = new InMemoryLedger();
    const service = new AdviserService({ provider: failingProvider as unknown as FakeProvider, ledger });

    await expect(
      service.explainEligibility({
        studentId: "student-1",
        courseId: "course-1",
        studentContext: studentContext(),
        courseContext: courseContext(),
        recommendation: recommendationContext(),
      }),
    ).rejects.toThrow("AdviserService.explainEligibility failed");

    expect(ledger.records).toHaveLength(1);
    expect(ledger.records[0]!.status).toBe("failed");
    expect(ledger.records[0]!.errorClass).toBe("Error");
  });

  it("validates explanation length with zod (rejects empty after trim)", async () => {
    const emptyProvider = new FakeProvider();
    // Monkey-patch generateText to return empty string
    vi.spyOn(emptyProvider, "generateText").mockResolvedValue({
      text: "   ",
      model: "fake-model",
      usage: { inputTokens: 1, outputTokens: 1 },
      provider: "fake",
    });

    const ledger = new InMemoryLedger();
    const service = new AdviserService({ provider: emptyProvider, ledger });

    await expect(
      service.explainEligibility({
        studentId: "student-1",
        courseId: "course-1",
        studentContext: studentContext(),
        courseContext: courseContext(),
        recommendation: recommendationContext(),
      }),
    ).rejects.toThrow();

    expect(ledger.records[0]!.status).toBe("failed");
  });

  it("generateStructured path returns validated explanation and records ledger", async () => {
    const provider = new FakeProvider("fake-model");
    const ledger = new InMemoryLedger();
    const service = new AdviserService({ provider, ledger });

    const result = await service.explainEligibilityStructured({
      studentId: "student-1",
      courseId: "course-1",
      studentContext: studentContext(),
      courseContext: courseContext(),
      recommendation: recommendationContext(),
    });

    expect(result.explanation.length).toBeGreaterThanOrEqual(20);
    expect(result.provenance.provider).toBe("fake");
    expect(ledger.records).toHaveLength(1);
    expect(ledger.records[0]!.status).toBe("succeeded");
  });

  it("does not decide eligibility — reflects provided recommendation verbatim", async () => {
    const provider = new FakeProvider();
    const ledger = new InMemoryLedger();
    const service = new AdviserService({ provider, ledger });

    const rec = recommendationContext({ eligibility: "uncertain", missingInformation: [{ field: "qualifications", message: "Need grades" }] });
    // Service must not change eligibility; it just explains
    const result = await service.explainEligibility({
      studentId: "student-1",
      courseId: "course-1",
      studentContext: studentContext(),
      courseContext: courseContext(),
      recommendation: rec,
    });

    // Prompt includes deterministic eligibility; fake echoes it
    expect(result.explanation).toContain("uncertain");
    expect(result.explanation).toContain("qualifications");
    expect(rec.eligibility).toBe("uncertain"); // original untouched
  });
});
