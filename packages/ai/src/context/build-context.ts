/**
 * AI adviser context building — selects only needed fields for the model.
 *
 * Full DB records are never handed to the LLM. Each context carries minimal
 * fields plus evidence references for provenance. Business rules remain in
 * `packages/admissions-engine`; this module only shapes explanation input.
 */

import type {
  Course,
  CourseRequirement,
  EvidenceItem,
  Institution,
  StudentProfile,
  StudentQualification,
} from "@offer-ai/domain";
import type { CourseRecommendation } from "@offer-ai/admissions-engine";

// ── Student ───────────────────────────────────────────────────────────────

export interface StudentAdviserContext {
  studentId: string;
  intendedStudyLevel: string | null;
  currentEducationLevel: string | null;
  englishProficiencyStatus: string | null;
  targetEntryYear: number | null;
  budgetRange: {
    currencyCode: string;
    min: number | null;
    max: number | null;
  } | null;
  qualifications: Array<{
    system: string;
    title: string;
    grade: string | null;
    predictedGrade: string | null;
    overallGpa: number | null;
    gpaScaleMax: number | null;
  }>;
  evidenceRefs: Array<{
    id: string;
    verificationStatus: string;
    evidenceType: string;
  }>;
}

export function buildStudentContext(
  student: StudentProfile,
  qualifications: StudentQualification[],
  evidenceItems: EvidenceItem[] = [],
): StudentAdviserContext {
  // Explicit field selection — never spread the full profile.
  const quals = qualifications.map((q) => ({
    system: q.qualificationSystem,
    title: q.title,
    grade: q.grade,
    predictedGrade: q.predictedGrade,
    overallGpa: q.overallGpa,
    gpaScaleMax: q.gpaScaleMax,
  }));

  const evidenceRefs = evidenceItems.map((e) => ({
    id: e.id,
    verificationStatus: e.verificationStatus,
    evidenceType: e.evidenceType,
  }));

  return {
    studentId: student.id,
    intendedStudyLevel: student.intendedStudyLevel,
    currentEducationLevel: student.currentEducationLevel,
    englishProficiencyStatus: student.englishProficiencyStatus,
    targetEntryYear: student.targetEntryYear,
    budgetRange: student.budgetRange
      ? {
          currencyCode: student.budgetRange.currencyCode,
          min: student.budgetRange.min,
          max: student.budgetRange.max,
        }
      : null,
    qualifications: quals,
    evidenceRefs,
  };
}

// ── Course ────────────────────────────────────────────────────────────────

export interface CourseAdviserContext {
  courseId: string;
  title: string;
  level: string;
  durationMonths: number | null;
  tuitionFee: number | null;
  currencyCode: string | null;
  applicationRoutes: string[];
  institution: {
    id: string;
    name: string;
    slug: string;
    countryCode: string;
    city: string | null;
  } | null;
  requirements: Array<{
    kind: string;
    sourceText: string;
    structured: Record<string, unknown> | null;
    verificationStatus: string;
  }>;
}

export function buildCourseContext(
  course: Course,
  options: { institution?: Institution | null; requirements?: CourseRequirement[] | null } = {},
): CourseAdviserContext {
  const institution = options.institution
    ? {
        id: options.institution.id,
        name: options.institution.name,
        slug: options.institution.slug,
        countryCode: options.institution.countryCode,
        city: options.institution.city,
      }
    : null;

  const requirements = (options.requirements ?? []).map((r) => ({
    kind: r.kind,
    sourceText: r.sourceText,
    structured: r.structured,
    verificationStatus: r.verificationStatus,
  }));

  return {
    courseId: course.id,
    title: course.title,
    level: course.level,
    durationMonths: course.durationMonths,
    tuitionFee: course.tuitionFee,
    currencyCode: course.currencyCode,
    applicationRoutes: [...course.applicationRoutes],
    institution,
    requirements,
  };
}

// ── Recommendation ──────────────────────────────────────────────────────

export interface RecommendationAdviserContext {
  courseId: string;
  eligibility: string;
  strategyBand: string;
  score: number;
  confidence: number;
  reasons: Array<{ code: string; message: string }>;
  blockers: Array<{ code: string; message: string; severity: string }>;
  missingInformation: Array<{ field: string; message: string }>;
  profileVersion: string;
  catalogueVersion: string;
  rulesVersion: string;
}

export function buildRecommendationContext(
  recommendation: CourseRecommendation,
): RecommendationAdviserContext {
  return {
    courseId: recommendation.courseId,
    eligibility: recommendation.eligibility,
    strategyBand: recommendation.strategyBand,
    score: recommendation.score,
    confidence: recommendation.confidence,
    reasons: recommendation.reasons.map((r) => ({ code: r.code, message: r.message })),
    blockers: recommendation.blockers.map((b) => ({
      code: b.code,
      message: b.message,
      severity: b.severity,
    })),
    missingInformation: recommendation.missingInformation.map((m) => ({
      field: m.field,
      message: m.message,
    })),
    profileVersion: recommendation.profileVersion,
    catalogueVersion: recommendation.catalogueVersion,
    rulesVersion: recommendation.rulesVersion,
  };
}
