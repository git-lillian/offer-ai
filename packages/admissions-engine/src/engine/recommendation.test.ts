import { describe, expect, it } from "vitest";
import type { Course, CourseRequirement, StudentProfile, StudentQualification } from "@offer-ai/domain";
import { RecommendationService } from "./recommendation-service";
import { UK_RULES_VERSION } from "../countries/uk/rules/index";

const context = {
  profileVersion: "p-v1",
  catalogueVersion: "c-v1",
  rulesVersion: UK_RULES_VERSION,
};

function profile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    id: "student-1",
    userId: "user-1",
    fullName: "Test Student",
    email: "test@example.com",
    accountStatus: "claimed",
    createdByUserId: null,
    claimedAt: new Date("2026-01-01"),
    currentCountryCode: "CN",
    nationalityCountryCode: "CN",
    currentEducationLevel: "high_school",
    intendedStudyLevel: "undergraduate",
    targetSubjectAreas: [],
    targetEntryYear: 2026,
    targetCountryCodes: ["GB"],
    budgetRange: null,
    englishProficiencyStatus: "exempt",
    onboardingCompletedAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as StudentProfile;
}

function course(overrides: Partial<Course> = {}): Course {
  return {
    id: "course-1",
    institutionId: "inst-1",
    subjectId: null,
    title: "BSc Computer Science",
    slug: "bsc-computer-science",
    level: "undergraduate",
    durationMonths: 36,
    tuitionFee: 25000,
    currencyCode: "GBP",
    applicationRoutes: ["ucas"],
    internationalApplicantsSupported: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as Course;
}

function requirement(
  kind: CourseRequirement["kind"],
  structured: Record<string, unknown> | null,
  sourceText = "requirement",
): CourseRequirement {
  return {
    id: `req-${kind}-${Math.random().toString(36).slice(2, 6)}`,
    courseId: "course-1",
    kind,
    structured,
    sourceText,
    sourceId: null,
    effectiveFrom: new Date("2026-01-01"),
    effectiveTo: null,
    observedAt: new Date("2026-01-01"),
    publishedAt: new Date("2026-01-01"),
    supersededById: null,
    verificationStatus: "human_verified",
  } as CourseRequirement;
}

function qual(overrides: Partial<StudentQualification> = {}): StudentQualification {
  return {
    id: "qual-1",
    studentId: "student-1",
    qualificationSystem: "a_level",
    title: "A Levels",
    institutionName: null,
    countryCode: "GB",
    grade: "A*AA",
    predictedGrade: null,
    overallGpa: null,
    gpaScaleMax: null,
    completedYear: 2026,
    ...overrides,
  } as StudentQualification;
}

describe("RecommendationService — deterministic pipeline", () => {
  const service = new RecommendationService();

  it("returns eligible + target for a clean undergraduate profile", () => {
    const result = service.evaluate({
      student: profile({
        intendedStudyLevel: "undergraduate",
        englishProficiencyStatus: "exempt",
        budgetRange: { currencyCode: "GBP", min: 20000, max: 40000 },
      }),
      qualifications: [qual()],
      course: course({ level: "undergraduate", tuitionFee: 25000 }),
      requirements: [],
      context,
    });

    expect(result.eligibility).toBe("eligible");
    expect(result.blockers).toEqual([]);
    expect(result.missingInformation).toEqual([]);
    expect(result.score).toBeGreaterThanOrEqual(45);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(["target", "aspirational"]).toContain(result.strategyBand);
    expect(result.profileVersion).toBe("p-v1");
    expect(result.catalogueVersion).toBe("c-v1");
    expect(result.rulesVersion).toBe(UK_RULES_VERSION);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });

  it("is deterministic: same input → same output", () => {
    const input = {
      student: profile({ intendedStudyLevel: "undergraduate", englishProficiencyStatus: "exempt" }),
      qualifications: [qual()],
      course: course({ level: "undergraduate" }),
      requirements: [],
      context,
    };
    const a = service.evaluate(input);
    const b = service.evaluate(input);
    expect(a).toEqual(b);
  });

  it("returns ineligible when level mismatches (hard blocker)", () => {
    const result = service.evaluate({
      student: profile({ intendedStudyLevel: "postgraduate_taught", englishProficiencyStatus: "exempt" }),
      qualifications: [qual({ qualificationSystem: "uk_undergraduate", grade: "2:1" })],
      course: course({ level: "undergraduate" }),
      requirements: [],
      context,
    });
    expect(result.eligibility).toBe("ineligible");
    expect(result.blockers.some((b) => b.code === "uk_level_mismatch")).toBe(true);
    expect(result.blockers.some((b) => b.severity === "hard")).toBe(true);
    expect(result.strategyBand).toBe("safer");
  });

  it("returns uncertain when intendedStudyLevel is missing", () => {
    const result = service.evaluate({
      student: profile({ intendedStudyLevel: null, englishProficiencyStatus: "exempt" }),
      qualifications: [qual()],
      course: course({ level: "undergraduate" }),
      requirements: [],
      context,
    });
    expect(result.eligibility).toBe("uncertain");
    expect(result.missingInformation.some((m) => m.field === "intendedStudyLevel")).toBe(true);
    expect(result.strategyBand).toBe("target");
  });

  it("returns uncertain when qualifications are missing for undergraduate", () => {
    const result = service.evaluate({
      student: profile({ intendedStudyLevel: "undergraduate", englishProficiencyStatus: "exempt" }),
      qualifications: [],
      course: course({ level: "undergraduate" }),
      requirements: [],
      context,
    });
    expect(result.eligibility).toBe("uncertain");
    expect(result.missingInformation.some((m) => m.field === "qualifications")).toBe(true);
  });

  it("returns ineligible when IELTS not taken and language requirement present", () => {
    const ieltsReq = requirement("language", { test: "IELTS", overall: 6.5, componentMinimum: 6.0 });
    const result = service.evaluate({
      student: profile({ intendedStudyLevel: "undergraduate", englishProficiencyStatus: "not_taken" }),
      qualifications: [qual()],
      course: course({ level: "undergraduate" }),
      requirements: [ieltsReq],
      context,
    });
    expect(result.eligibility).toBe("ineligible");
    expect(result.blockers.some((b) => b.code.includes("uk_language"))).toBe(true);
  });

  it("returns eligible when IELTS is exempt despite requirement", () => {
    const ieltsReq = requirement("language", { test: "IELTS", overall: 6.5, componentMinimum: 6.0 });
    const result = service.evaluate({
      student: profile({ intendedStudyLevel: "undergraduate", englishProficiencyStatus: "exempt" }),
      qualifications: [qual()],
      course: course({ level: "undergraduate" }),
      requirements: [ieltsReq],
      context,
    });
    expect(result.eligibility).toBe("eligible");
    expect(result.blockers.filter((b) => b.severity === "hard")).toEqual([]);
  });

  it("returns uncertain when IELTS taken but scores missing", () => {
    const ieltsReq = requirement("language", { test: "IELTS", overall: 6.5, componentMinimum: 6 });
    const result = service.evaluate({
      student: profile({ intendedStudyLevel: "undergraduate", englishProficiencyStatus: "taken" }),
      qualifications: [qual()],
      course: course({ level: "undergraduate" }),
      requirements: [ieltsReq],
      context,
    });
    expect(result.eligibility).toBe("uncertain");
    expect(result.missingInformation.some((m) => m.field.toLowerCase().includes("ielts"))).toBe(true);
  });

  it("returns eligible when IELTS scores meet requirement via qualification record", () => {
    // Use a requirement without component minimum so overall alone decides.
    const ieltsReq = requirement("language", { test: "IELTS", overall: 6.5 });
    const result = service.evaluate({
      student: profile({ intendedStudyLevel: "undergraduate", englishProficiencyStatus: "taken" }),
      qualifications: [
        qual(),
        qual({
          id: "qual-ielts",
          qualificationSystem: "other",
          title: "IELTS",
          grade: "7.0",
          predictedGrade: null,
          overallGpa: null,
          gpaScaleMax: null,
        }),
      ],
      course: course({ level: "undergraduate" }),
      requirements: [ieltsReq],
      context,
    });
    // Language meets, so eligibility depends on other rules (level + qual). Both eligible → overall eligible.
    expect(result.eligibility).toBe("eligible");
  });

  it("returns ineligible when language scores are below requirement", () => {
    const ieltsReq = requirement("language", { test: "IELTS", overall: 7.0, componentMinimum: 6.5 });
    const result = service.evaluate({
      student: profile({ intendedStudyLevel: "undergraduate", englishProficiencyStatus: "taken" }),
      qualifications: [
        qual(),
        qual({
          id: "qual-ielts-low",
          qualificationSystem: "other",
          title: "IELTS",
          grade: "6.0",
          predictedGrade: null,
          overallGpa: null,
          gpaScaleMax: null,
        }),
      ],
      course: course({ level: "undergraduate" }),
      requirements: [ieltsReq],
      context,
    });
    expect(result.eligibility).toBe("ineligible");
    expect(result.blockers.some((b) => b.code.includes("uk_language"))).toBe(true);
  });

  it("returns uncertain for postgraduate when degree missing", () => {
    const acadReq = requirement("academic", { degreeClass: "2:1" });
    const result = service.evaluate({
      student: profile({ intendedStudyLevel: "postgraduate_taught", englishProficiencyStatus: "exempt" }),
      qualifications: [],
      course: course({ level: "postgraduate_taught" }),
      requirements: [acadReq],
      context,
    });
    expect(result.eligibility).toBe("uncertain");
    expect(result.missingInformation.some((m) => m.field === "qualifications")).toBe(true);
  });

  it("returns eligible for postgraduate when degree meets 2:1", () => {
    const acadReq = requirement("academic", { degreeClass: "2:1" });
    const result = service.evaluate({
      student: profile({ intendedStudyLevel: "postgraduate_taught", englishProficiencyStatus: "exempt" }),
      qualifications: [
        qual({
          qualificationSystem: "uk_undergraduate",
          title: "BSc Computer Science",
          grade: "2:1",
          overallGpa: null,
          gpaScaleMax: null,
        }),
      ],
      course: course({ level: "postgraduate_taught" }),
      requirements: [acadReq],
      context,
    });
    // Level matches, language exempt, qualification meets → eligible.
    expect(result.eligibility).toBe("eligible");
  });

  it("returns ineligible for postgraduate when degree is below requirement", () => {
    const acadReq = requirement("academic", { degreeClass: "2:1" });
    const result = service.evaluate({
      student: profile({ intendedStudyLevel: "postgraduate_taught", englishProficiencyStatus: "exempt" }),
      qualifications: [
        qual({
          qualificationSystem: "uk_undergraduate",
          title: "BSc Computer Science",
          grade: "2:2",
          overallGpa: null,
          gpaScaleMax: null,
        }),
      ],
      course: course({ level: "postgraduate_taught" }),
      requirements: [acadReq],
      context,
    });
    expect(result.eligibility).toBe("ineligible");
    expect(result.blockers.some((b) => b.code === "uk_qualification_postgrad_below")).toBe(true);
  });

  it("applies affordability soft blocker when fee exceeds budget", () => {
    const result = service.evaluate({
      student: profile({
        intendedStudyLevel: "undergraduate",
        englishProficiencyStatus: "exempt",
        budgetRange: { currencyCode: "GBP", min: 10000, max: 20000 },
      }),
      qualifications: [qual()],
      course: course({ level: "undergraduate", tuitionFee: 35000, currencyCode: "GBP" }),
      requirements: [],
      context,
    });
    // Affordability is soft, so eligibility stays eligible but soft blocker present.
    expect(result.eligibility).toBe("eligible");
    expect(result.blockers.some((b) => b.code === "uk_affordability_over_budget" && b.severity === "soft")).toBe(true);
    expect(result.reasons.some((r) => r.code === "uk_affordability_over_budget")).toBe(true);
  });

  it("maps score to strategyBand correctly for eligible courses", () => {
    // High score eligible → aspirational, mid → target, low → safer.
    // Use a course with comfortable budget to push score high.
    const high = service.evaluate({
      student: profile({
        intendedStudyLevel: "undergraduate",
        englishProficiencyStatus: "exempt",
        budgetRange: { currencyCode: "GBP", min: 0, max: 50000 },
      }),
      qualifications: [qual()],
      course: course({ level: "undergraduate", tuitionFee: 15000, currencyCode: "GBP" }),
      requirements: [],
      context,
    });
    expect(high.eligibility).toBe("eligible");
    expect(high.score).toBeGreaterThanOrEqual(70);
    expect(high.strategyBand).toBe("aspirational");

    // Force a low but still eligible score via foundation pathway (uncertain would not count).
    // Instead, test the pure mapping: ineligible always safer regardless of score.
    const ineligible = service.evaluate({
      student: profile({ intendedStudyLevel: "undergraduate", englishProficiencyStatus: "not_taken" }),
      qualifications: [qual()],
      course: course({ level: "undergraduate" }),
      requirements: [requirement("language", { test: "IELTS", overall: 6.5 })],
      context,
    });
    expect(ineligible.eligibility).toBe("ineligible");
    expect(ineligible.strategyBand).toBe("safer");
  });

  it("batch evaluate preserves order and determinism", () => {
    const undergrad = course({ id: "c-under", level: "undergraduate", title: "BSc" });
    const postgrad = course({ id: "c-post", level: "postgraduate_taught", title: "MSc" });
    const results = service.evaluateBatch({
      student: profile({ intendedStudyLevel: "undergraduate", englishProficiencyStatus: "exempt" }),
      qualifications: [qual()],
      courses: [
        { course: undergrad, requirements: [] },
        { course: postgrad, requirements: [requirement("academic", { degreeClass: "2:1" })] },
      ],
      context,
    });
    expect(results).toHaveLength(2);
    expect(results[0]?.courseId).toBe("c-under");
    expect(results[1]?.courseId).toBe("c-post");
    expect(results[0]?.eligibility).toBe("eligible");
    // Undergrad profile applying to postgrad with A-level only → uncertain/ineligible due qual.
    expect(["uncertain", "ineligible"]).toContain(results[1]?.eligibility);
  });
});
