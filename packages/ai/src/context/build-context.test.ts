import { describe, expect, it } from "vitest";
import type {
  Course,
  CourseRequirement,
  EvidenceItem,
  Institution,
  StudentProfile,
  StudentQualification,
} from "@offer-ai/domain";
import type { CourseRecommendation } from "@offer-ai/admissions-engine";
import {
  buildCourseContext,
  buildRecommendationContext,
  buildStudentContext,
} from "./build-context";

function makeStudent(overrides: Partial<StudentProfile> = {}): StudentProfile {
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
    targetSubjectAreas: ["computer_science"],
    targetEntryYear: 2026,
    targetCountryCodes: ["GB"],
    budgetRange: { currencyCode: "GBP", min: 20000, max: 40000 },
    englishProficiencyStatus: "exempt",
    onboardingCompletedAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as StudentProfile;
}

function makeQualification(overrides: Partial<StudentQualification> = {}): StudentQualification {
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

function makeEvidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: "evidence-1",
    studentId: "student-1",
    evidenceType: "transcript",
    sourceType: "uploaded_document",
    sourceDocumentId: null,
    description: "Transcript",
    verificationStatus: "human_verified",
    verifiedByUserId: null,
    verifiedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as EvidenceItem;
}

function makeCourse(overrides: Partial<Course> = {}): Course {
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

function makeInstitution(overrides: Partial<Institution> = {}): Institution {
  return {
    id: "inst-1",
    name: "University of Edinburgh",
    slug: "university-of-edinburgh",
    countryCode: "GB",
    city: "Edinburgh",
    websiteUrl: "https://ed.ac.uk",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as Institution;
}

function makeRequirement(overrides: Partial<CourseRequirement> = {}): CourseRequirement {
  return {
    id: "req-1",
    courseId: "course-1",
    kind: "academic",
    structured: { degreeClass: "2:1" },
    sourceText: "2:1 required",
    sourceId: null,
    effectiveFrom: new Date("2026-01-01"),
    effectiveTo: null,
    observedAt: new Date("2026-01-01"),
    publishedAt: new Date("2026-01-01"),
    supersededById: null,
    verificationStatus: "human_verified",
    ...overrides,
  } as CourseRequirement;
}

function makeRecommendation(overrides: Partial<CourseRecommendation> = {}): CourseRecommendation {
  return {
    courseId: "course-1",
    eligibility: "eligible",
    strategyBand: "target",
    score: 72,
    confidence: 0.82,
    reasons: [{ code: "uk_level_match", message: "Level matches" }],
    blockers: [],
    missingInformation: [],
    profileVersion: "p-v1",
    catalogueVersion: "c-v1",
    rulesVersion: "uk-v1",
    ...overrides,
  } as CourseRecommendation;
}

describe("buildStudentContext", () => {
  it("selects only needed fields and preserves evidence refs", () => {
    const student = makeStudent();
    const quals = [makeQualification(), makeQualification({ id: "qual-2", qualificationSystem: "other", title: "IELTS", grade: "7.0" })];
    const evidence = [makeEvidence()];
    const ctx = buildStudentContext(student, quals, evidence);

    expect(ctx.studentId).toBe("student-1");
    expect(ctx.intendedStudyLevel).toBe("undergraduate");
    expect(ctx.currentEducationLevel).toBe("high_school");
    expect(ctx.englishProficiencyStatus).toBe("exempt");
    expect(ctx.targetEntryYear).toBe(2026);
    expect(ctx.budgetRange).toEqual({ currencyCode: "GBP", min: 20000, max: 40000 });
    expect(ctx.qualifications).toHaveLength(2);
    expect(ctx.qualifications[0]).toEqual({
      system: "a_level",
      title: "A Levels",
      grade: "A*AA",
      predictedGrade: null,
      overallGpa: null,
      gpaScaleMax: null,
    });
    // Evidence refs only contain minimal provenance, not full record
    expect(ctx.evidenceRefs).toEqual([{ id: "evidence-1", verificationStatus: "human_verified", evidenceType: "transcript" }]);
    // Must not leak full profile fields like fullName, email, targetSubjectAreas etc.
    expect((ctx as unknown as Record<string, unknown>).fullName).toBeUndefined();
    expect((ctx as unknown as Record<string, unknown>).email).toBeUndefined();
    expect((ctx as unknown as Record<string, unknown>).targetSubjectAreas).toBeUndefined();
  });

  it("handles null budget and empty qualifications", () => {
    const student = makeStudent({ budgetRange: null, intendedStudyLevel: null });
    const ctx = buildStudentContext(student, [], []);
    expect(ctx.budgetRange).toBeNull();
    expect(ctx.intendedStudyLevel).toBeNull();
    expect(ctx.qualifications).toEqual([]);
    expect(ctx.evidenceRefs).toEqual([]);
  });

  it("includes evidence verification status for each item", () => {
    const student = makeStudent();
    const ev = [
      makeEvidence({ id: "e1", verificationStatus: "machine_extracted", evidenceType: "qualification_certificate" }),
      makeEvidence({ id: "e2", verificationStatus: "human_verified", evidenceType: "language_test_certificate" }),
    ];
    const ctx = buildStudentContext(student, [], ev);
    expect(ctx.evidenceRefs[0]?.verificationStatus).toBe("machine_extracted");
    expect(ctx.evidenceRefs[1]?.evidenceType).toBe("language_test_certificate");
  });
});

describe("buildCourseContext", () => {
  it("selects only needed course and institution fields", () => {
    const course = makeCourse();
    const institution = makeInstitution();
    const requirement = makeRequirement();
    const ctx = buildCourseContext(course, { institution, requirements: [requirement] });

    expect(ctx.courseId).toBe("course-1");
    expect(ctx.title).toBe("BSc Computer Science");
    expect(ctx.level).toBe("undergraduate");
    expect(ctx.tuitionFee).toBe(25000);
    expect(ctx.currencyCode).toBe("GBP");
    expect(ctx.institution).toEqual({
      id: "inst-1",
      name: "University of Edinburgh",
      slug: "university-of-edinburgh",
      countryCode: "GB",
      city: "Edinburgh",
    });
    expect(ctx.requirements).toEqual([
      {
        kind: "academic",
        sourceText: "2:1 required",
        structured: { degreeClass: "2:1" },
        verificationStatus: "human_verified",
      },
    ]);
    // Ensure no leakage of full DB record like createdAt
    expect((ctx as unknown as Record<string, unknown>).createdAt).toBeUndefined();
    expect((ctx.institution as unknown as Record<string, unknown>).websiteUrl).toBeUndefined();
  });

  it("handles missing institution and requirements", () => {
    const course = makeCourse({ tuitionFee: null, currencyCode: null });
    const ctx = buildCourseContext(course, {});
    expect(ctx.institution).toBeNull();
    expect(ctx.requirements).toEqual([]);
    expect(ctx.tuitionFee).toBeNull();
    expect(ctx.currencyCode).toBeNull();
  });

  it("never returns full DB records (no extra keys)", () => {
    const course = makeCourse();
    const ctx = buildCourseContext(course, { institution: makeInstitution(), requirements: [makeRequirement()] });
    const allowedTopKeys = new Set(["courseId", "title", "level", "durationMonths", "tuitionFee", "currencyCode", "applicationRoutes", "institution", "requirements"]);
    for (const key of Object.keys(ctx)) {
      expect(allowedTopKeys.has(key)).toBe(true);
    }
  });
});

describe("buildRecommendationContext", () => {
  it("copies deterministic recommendation fields only", () => {
    const rec = makeRecommendation({
      eligibility: "ineligible",
      blockers: [{ code: "uk_level_mismatch", message: "Level mismatch", severity: "hard" }],
      missingInformation: [{ field: "qualifications", message: "Need grades" }],
    });
    const ctx = buildRecommendationContext(rec);

    expect(ctx.courseId).toBe("course-1");
    expect(ctx.eligibility).toBe("ineligible");
    expect(ctx.blockers).toHaveLength(1);
    expect(ctx.blockers[0]?.code).toBe("uk_level_mismatch");
    expect(ctx.reasons[0]?.code).toBe("uk_level_match");
    expect(ctx.missingInformation[0]?.field).toBe("qualifications");
    expect(ctx.score).toBe(72);
    expect(ctx.profileVersion).toBe("p-v1");
    // No extra leakage
    expect((ctx as unknown as Record<string, unknown>).course_id).toBeUndefined();
  });

  it("is deterministic for same input", () => {
    const rec = makeRecommendation();
    const a = buildRecommendationContext(rec);
    const b = buildRecommendationContext(rec);
    expect(a).toEqual(b);
  });
});
