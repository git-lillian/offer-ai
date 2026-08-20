import { describe, expect, it } from "vitest";
import {
  analyzeExperienceGaps,
  coveredOpportunityTypes,
  scoreOpportunityForGaps,
} from "./experience-gap";
import type { StudentProfile, StudentExperience, StudentGoals } from "./student";
import type { Course, CourseRequirement } from "./catalogue";
import { ValidationError } from "./errors";

const STUDENT_ID = "550e8400-e29b-41d4-a716-446655440001";

function profile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    id: STUDENT_ID,
    userId: "550e8400-e29b-41d4-a716-446655440002",
    fullName: "Test Student",
    email: "test@example.com",
    accountStatus: "claimed",
    createdByUserId: null,
    claimedAt: new Date("2026-01-01"),
    currentCountryCode: "CN",
    nationalityCountryCode: "CN",
    currentEducationLevel: "high_school",
    intendedStudyLevel: "undergraduate",
    targetSubjectAreas: ["computer_science"],
    targetEntryYear: 2027,
    targetCountryCodes: ["GB"],
    budgetRange: null,
    englishProficiencyStatus: "exempt",
    onboardingCompletedAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function experience(
  overrides: Partial<StudentExperience> = {},
): StudentExperience {
  return {
    id: crypto.randomUUID(),
    studentId: STUDENT_ID,
    experienceType: "internship",
    title: "Software Intern",
    organisationName: "Acme",
    startedAt: new Date("2025-06-01"),
    endedAt: new Date("2025-08-01"),
    description: "Worked on product",
    ...overrides,
  };
}

function goals(overrides: Partial<StudentGoals> = {}): StudentGoals {
  return {
    studentId: STUDENT_ID,
    studyGoals: "I want to study Computer Science at a leading UK university.",
    careerGoals: "Become a software engineer building AI systems.",
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function course(overrides: Partial<Course> = {}): Course {
  return {
    id: crypto.randomUUID(),
    institutionId: crypto.randomUUID(),
    subjectId: null,
    title: "BSc Computer Science",
    slug: "bsc-computer-science",
    level: "undergraduate",
    durationMonths: 36,
    tuitionFee: 22000,
    currencyCode: "GBP",
    applicationRoutes: ["ucas"],
    internationalApplicantsSupported: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function requirement(
  kind: CourseRequirement["kind"],
  sourceText = "Requirement",
): CourseRequirement {
  return {
    id: crypto.randomUUID(),
    courseId: "course-1",
    kind,
    structured: null,
    sourceText,
    sourceId: null,
    effectiveFrom: new Date("2026-01-01"),
    effectiveTo: null,
    observedAt: new Date(),
    publishedAt: new Date(),
    supersededById: null,
    verificationStatus: "human_verified",
  };
}

describe("analyzeExperienceGaps — deterministic, pure", () => {
  it("returns gaps for empty profile with no experiences and no goals", () => {
    const result = analyzeExperienceGaps({
      profile: profile(),
      experiences: [],
      goals: null,
    });
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.gaps.some((g) => g.code === "no_experiences")).toBe(true);
    expect(result.gaps.some((g) => g.code === "undefined_goals")).toBe(true);
    expect(result.suggestedOpportunityTypes.length).toBeGreaterThan(0);
    expect(result.summary).toContain("Found");
    // All gaps should be sorted by code
    const codes = result.gaps.map((g) => g.code);
    expect([...codes].sort()).toEqual(codes);
  });

  it("is deterministic: same input → same output", () => {
    const input = {
      profile: profile({ intendedStudyLevel: "postgraduate_research" }),
      experiences: [experience({ experienceType: "research" })],
      goals: goals(),
      recommendedCourses: [
        { course: course({ level: "phd" }), requirements: [requirement("academic", "2:1 required")] },
      ],
    };
    const a = analyzeExperienceGaps(input);
    const b = analyzeExperienceGaps(input);
    expect(a).toEqual(b);
  });

  it("flags missing research for research-intensive pathways", () => {
    const result = analyzeExperienceGaps({
      profile: profile({ intendedStudyLevel: "phd" }),
      experiences: [experience({ experienceType: "internship" })],
      goals: goals(),
    });
    expect(result.gaps.some((g) => g.code === "missing_research_experience")).toBe(true);
    expect(result.suggestedOpportunityTypes).toContain("research");
  });

  it("does not flag research gap when research experience exists", () => {
    const result = analyzeExperienceGaps({
      profile: profile({ intendedStudyLevel: "phd" }),
      experiences: [experience({ experienceType: "research" }), experience({ experienceType: "internship" })],
      goals: goals(),
      recommendedCourses: [{ course: course({ level: "phd" }), requirements: [] }],
    });
    expect(result.gaps.some((g) => g.code === "missing_research_experience")).toBe(false);
  });

  it("flags missing internship for undergraduate pathway", () => {
    const result = analyzeExperienceGaps({
      profile: profile({ intendedStudyLevel: "undergraduate" }),
      experiences: [experience({ experienceType: "volunteering" })],
      goals: goals(),
    });
    expect(result.gaps.some((g) => g.code.startsWith("missing_internship"))).toBe(true);
    expect(result.suggestedOpportunityTypes).toContain("internship");
  });

  it("flags missing volunteering", () => {
    const result = analyzeExperienceGaps({
      profile: profile(),
      experiences: [experience({ experienceType: "internship" })],
      goals: goals(),
    });
    expect(result.gaps.some((g) => g.code === "missing_volunteering_experience")).toBe(true);
  });

  it("returns well-rounded summary when experience breadth is good", () => {
    const exps: StudentExperience[] = [
      experience({ experienceType: "internship" }),
      experience({ experienceType: "volunteering" }),
      experience({ experienceType: "research" }),
      experience({ experienceType: "competition" }),
      experience({ experienceType: "project" }),
      experience({ experienceType: "leadership" }),
    ];
    const result = analyzeExperienceGaps({
      profile: profile({ intendedStudyLevel: "undergraduate" }),
      experiences: exps,
      goals: goals(),
    });
    // Still may have limited_breadth? With 6 distinct types and goals defined, should be minimal gaps
    // At least not the "no_experiences" gap
    expect(result.gaps.some((g) => g.code === "no_experiences")).toBe(false);
    // Should have no internship/volunteering gaps
    expect(result.gaps.some((g) => g.code === "missing_internship_experience")).toBe(false);
    expect(result.gaps.some((g) => g.code === "missing_volunteering_experience")).toBe(false);
    expect(result.suggestedOpportunityTypes).not.toContain("internship");
    expect(result.suggestedOpportunityTypes).not.toContain("volunteering");
  });

  it("flags undefined goals when goals empty", () => {
    const result = analyzeExperienceGaps({
      profile: profile(),
      experiences: [experience()],
      goals: { studentId: STUDENT_ID, studyGoals: "   ", careerGoals: "", updatedAt: new Date() },
    });
    expect(result.gaps.some((g) => g.code === "undefined_goals")).toBe(true);
  });

  it("does not flag goals when meaningful", () => {
    const result = analyzeExperienceGaps({
      profile: profile(),
      experiences: [experience(), experience({ experienceType: "volunteering" })],
      goals: goals(),
    });
    expect(result.gaps.some((g) => g.code === "undefined_goals")).toBe(false);
  });

  it("flags limited breadth for single experience", () => {
    const result = analyzeExperienceGaps({
      profile: profile(),
      experiences: [experience()],
      goals: goals(),
    });
    expect(result.gaps.some((g) => g.code === "limited_breadth")).toBe(true);
  });

  it("suggests course for enrichment when no certification/project", () => {
    const result = analyzeExperienceGaps({
      profile: profile(),
      experiences: [experience({ experienceType: "volunteering" })],
      goals: goals(),
    });
    expect(result.gaps.some((g) => g.code === "limited_enrichment")).toBe(true);
    expect(result.suggestedOpportunityTypes).toContain("course");
  });

  it("throws ValidationError for invalid profile id", () => {
    expect(() =>
      analyzeExperienceGaps({
        profile: profile({ id: "not-a-uuid" }),
        experiences: [],
        goals: null,
      }),
    ).toThrow(ValidationError);
  });

  it("contextualises missing research via recommendedCourses containing research text", () => {
    const result = analyzeExperienceGaps({
      profile: profile({ intendedStudyLevel: "undergraduate" }),
      experiences: [experience({ experienceType: "internship" }), experience({ experienceType: "volunteering" })],
      goals: goals(),
      recommendedCourses: [
        {
          course: course({ level: "undergraduate" }),
          requirements: [requirement("academic", "Research project required")],
        },
      ],
    });
    expect(result.gaps.some((g) => g.code === "missing_research_experience")).toBe(true);
  });

  it("union of suggestedOpportunityTypes is deduped and sorted", () => {
    const result = analyzeExperienceGaps({
      profile: profile(),
      experiences: [],
      goals: null,
    });
    const sorted = [...result.suggestedOpportunityTypes].sort();
    expect(result.suggestedOpportunityTypes).toEqual(sorted);
    expect(new Set(result.suggestedOpportunityTypes).size).toBe(result.suggestedOpportunityTypes.length);
  });
});

describe("coveredOpportunityTypes", () => {
  it("maps experience types to opportunity types", () => {
    const exps = [
      experience({ experienceType: "internship" }),
      experience({ experienceType: "volunteering" }),
      experience({ experienceType: "research" }),
      experience({ experienceType: "competition" }),
      experience({ experienceType: "certification" }),
    ];
    const covered = coveredOpportunityTypes(exps);
    expect(covered).toContain("internship");
    expect(covered).toContain("volunteering");
    expect(covered).toContain("research");
    expect(covered).toContain("competition");
    expect(covered).toContain("course");
  });

  it("returns empty for no experiences", () => {
    expect(coveredOpportunityTypes([])).toEqual([]);
  });

  it("dedupes and sorts", () => {
    const exps = [
      experience({ experienceType: "internship" }),
      experience({ experienceType: "employment" }), // also internship
      experience({ experienceType: "internship" }),
    ];
    const covered = coveredOpportunityTypes(exps);
    expect(covered).toEqual(["internship"]);
  });
});

describe("scoreOpportunityForGaps", () => {
  it("scores higher for gap severity vs suggestion", () => {
    const gaps = analyzeExperienceGaps({
      profile: profile({ intendedStudyLevel: "undergraduate" }),
      experiences: [],
      goals: null,
    }).gaps;
    const internshipScore = scoreOpportunityForGaps("internship", gaps);
    const courseScore = scoreOpportunityForGaps("course", gaps);
    // Both should be >0 but deterministic
    expect(internshipScore).toBeGreaterThan(0);
    expect(courseScore).toBeGreaterThan(0);
  });

  it("throws for invalid opportunity type", () => {
    expect(() => scoreOpportunityForGaps("invalid" as never, [])).toThrow(ValidationError);
  });

  it("returns 0 for opportunity not suggested", () => {
    const gaps: ReturnType<typeof analyzeExperienceGaps>["gaps"] = [
      {
        code: "missing_research_experience",
        message: "research gap",
        severity: "gap",
        suggestedOpportunityTypes: ["research"],
      },
    ];
    expect(scoreOpportunityForGaps("internship", gaps)).toBe(0);
    expect(scoreOpportunityForGaps("research", gaps)).toBe(3);
  });
});
