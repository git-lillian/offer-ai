/**
 * Deterministic recommendation engine v1.
 *
 * No LLM decides eligibility. The engine composes versioned UK rule modules
 * (level matching, language/IELTS, qualification matching), each a pure
 * function, into a reproducible `CourseRecommendation`. Every result carries
 * `profileVersion`, `catalogueVersion`, `rulesVersion` so it can be recomputed.
 *
 * Pipeline (simplified from the full 7-stage vision in country-adapters.md):
 *   hard-eligibility (level, language, qualification)
 *   → affordability (soft) → scoring → strategy band
 *
 * All branches are deterministic and tested.
 */

import type { Course, CourseRequirement, StudentProfile, StudentQualification } from "@offer-ai/domain";
import type {
  CourseRecommendation,
  RecommendationBlocker,
  RecommendationPipelineContext,
  RecommendationReason,
  MissingInformation,
} from "../types";
import {
  evaluateLevelMatchingV1,
} from "../countries/uk/rules/level-matching/v1";
import {
  evaluateLanguageV1,
  type LanguageRequirement,
  type StudentLanguage,
} from "../countries/uk/rules/language/v1";
import {
  evaluateQualificationV1,
  type AcademicRequirement,
  type StudentQualificationLite,
} from "../countries/uk/rules/qualification/v1";
import { UK_RULES_VERSION } from "../countries/uk/rules/index";

export type RecommendInput = {
  student: StudentProfile;
  qualifications: StudentQualification[];
  course: Course;
  requirements: CourseRequirement[];
  context: RecommendationPipelineContext;
};

export type BatchRecommendInput = {
  student: StudentProfile;
  qualifications: StudentQualification[];
  courses: Array<{ course: Course; requirements: CourseRequirement[] }>;
  context: RecommendationPipelineContext;
};

/**
 * Framework-free, deterministic service. Keep `verbatimModuleSyntax` clean:
 * only type imports from `@offer-ai/domain`, no Supabase/Next/React deps.
 */
export class RecommendationService {
  readonly rulesVersion = UK_RULES_VERSION;

  /**
   * Evaluate one course for one student deterministically.
   */
  evaluate(input: RecommendInput): CourseRecommendation {
    const { student, qualifications, course, requirements, context } = input;

    const reasons: RecommendationReason[] = [];
    const blockers: RecommendationBlocker[] = [];
    const missing: MissingInformation[] = [];

    let score = 50;
    let hardBlocked = false;

    // 1) Level matching (hard)
    const levelResult = evaluateLevelMatchingV1({
      intendedStudyLevel: student.intendedStudyLevel,
      courseLevel: course.level,
    });
    reasons.push(levelResult.reason);
    if (levelResult.blocker) {
      blockers.push(levelResult.blocker);
      if (levelResult.blocker.severity === "hard") hardBlocked = true;
    }
    if (levelResult.missing) missing.push(levelResult.missing);
    score += levelResult.scoreDelta;

    // 2) Language / IELTS (hard)
    const languageRequirement = extractLanguageRequirement(requirements);
    const studentLanguage = extractStudentLanguage(student, qualifications);
    const languageResult = evaluateLanguageV1({
      student: studentLanguage,
      requirement: languageRequirement,
    });
    reasons.push(languageResult.reason);
    if (languageResult.blocker) {
      blockers.push(languageResult.blocker);
      if (languageResult.blocker.severity === "hard") hardBlocked = true;
    }
    if (languageResult.missing) missing.push(languageResult.missing);
    score += languageResult.scoreDelta;

    // 3) Qualification (hard for postgraduate thresholds, soft for undergrad)
    const academicRequirement = extractAcademicRequirement(requirements);
    const qualLite: StudentQualificationLite[] = qualifications.map((q) => ({
      qualificationSystem: q.qualificationSystem,
      grade: q.grade,
      predictedGrade: q.predictedGrade,
      overallGpa: q.overallGpa,
      gpaScaleMax: q.gpaScaleMax,
    }));
    const qualResult = evaluateQualificationV1({
      courseLevel: course.level,
      studentQualifications: qualLite,
      requirement: academicRequirement,
    });
    reasons.push(qualResult.reason);
    if (qualResult.blocker) {
      blockers.push(qualResult.blocker);
      if (qualResult.blocker.severity === "hard") hardBlocked = true;
    }
    if (qualResult.missing) missing.push(qualResult.missing);
    score += qualResult.scoreDelta;

    // 4) Affordability (soft signal only — never a hard blocker in v1)
    // Budget missing does not affect hard eligibility; it is informational.
    const affordability = evaluateAffordability(student, course);
    if (affordability.reason) reasons.push(affordability.reason);
    if (affordability.blocker) blockers.push(affordability.blocker);
    const affordabilityMissing = affordability.missing ?? null;
    score += affordability.scoreDelta;

    score = clamp(score, 0, 100);

    const eligibility = deriveEligibility(hardBlocked, missing);
    const confidence = deriveConfidence(eligibility, blockers, missing, reasons.length);
    const strategyBand = deriveStrategyBand(eligibility, score);

    const allMissing = affordabilityMissing ? [...missing, affordabilityMissing] : missing;

    return {
      courseId: course.id,
      eligibility,
      strategyBand,
      score,
      confidence,
      reasons,
      blockers,
      missingInformation: dedupeMissing(allMissing),
      profileVersion: context.profileVersion,
      catalogueVersion: context.catalogueVersion,
      rulesVersion: context.rulesVersion ?? UK_RULES_VERSION,
    };
  }

  /**
   * Batch evaluate — deterministic and order-preserving.
   */
  evaluateBatch(input: BatchRecommendInput): CourseRecommendation[] {
    return input.courses.map(({ course, requirements }) =>
      this.evaluate({
        student: input.student,
        qualifications: input.qualifications,
        course,
        requirements,
        context: input.context,
      }),
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function deriveEligibility(
  hardBlocked: boolean,
  missing: MissingInformation[],
): CourseRecommendation["eligibility"] {
  if (hardBlocked) return "ineligible";
  if (missing.length > 0) return "uncertain";
  return "eligible";
}

function deriveConfidence(
  eligibility: CourseRecommendation["eligibility"],
  blockers: RecommendationBlocker[],
  missing: MissingInformation[],
  reasonCount: number,
): number {
  // Deterministic confidence: high when clean eligible or hard ineligible,
  // low when information is missing, scaled slightly by reason coverage.
  let base: number;
  if (eligibility === "ineligible" && blockers.some((b) => b.severity === "hard")) {
    base = 0.88;
  } else if (eligibility === "eligible") {
    base = 0.82;
  } else {
    base = 0.42;
  }
  // Small deterministic adjustment for missing count (more missing → lower).
  const missingPenalty = Math.min(missing.length * 0.04, 0.15);
  const coverageBonus = Math.min(reasonCount * 0.01, 0.05);
  return clamp(Number((base - missingPenalty + coverageBonus).toFixed(2)), 0.1, 0.95);
}

function deriveStrategyBand(
  eligibility: CourseRecommendation["eligibility"],
  score: number,
): CourseRecommendation["strategyBand"] {
  // Ineligible is always the safest bucket from a portfolio perspective.
  if (eligibility === "ineligible") return "safer";
  // Uncertain leans to target so advisers see it as workable with data.
  if (eligibility === "uncertain") {
    if (score >= 70) return "target";
    if (score >= 45) return "target";
    return "safer";
  }
  // Eligible: score-driven aspirational/target/safer.
  if (score >= 70) return "aspirational";
  if (score >= 45) return "target";
  return "safer";
}

function dedupeMissing(items: MissingInformation[]): MissingInformation[] {
  const seen = new Set<string>();
  const out: MissingInformation[] = [];
  for (const item of items) {
    if (seen.has(item.field)) continue;
    seen.add(item.field);
    out.push(item);
  }
  return out;
}

function extractLanguageRequirement(requirements: CourseRequirement[]): LanguageRequirement {
  const lang = requirements.find((r) => r.kind === "language");
  if (!lang || !lang.structured) return null;
  const structured = lang.structured as Record<string, unknown>;
  // Normalizer shape: { test, overall, componentMinimum }
  // Catalogue may also carry legacy shapes — be defensive.
  const test = typeof structured.test === "string" ? (structured.test as string) : null;
  const overallRaw = structured.overall ?? structured.overallScore ?? structured.score;
  const overall = typeof overallRaw === "number" ? overallRaw : Number(overallRaw);
  const compRaw = structured.componentMinimum ?? structured.component_minimum ?? null;
  const componentMinimum = compRaw === null || compRaw === undefined ? null : Number(compRaw);
  if (!test || !Number.isFinite(overall)) return null;
  return {
    test,
    overall,
    componentMinimum: Number.isFinite(componentMinimum as number) ? (componentMinimum as number) : null,
  };
}

function extractAcademicRequirement(requirements: CourseRequirement[]): AcademicRequirement {
  const acad = requirements.find((r) => r.kind === "academic");
  if (!acad || !acad.structured) return null;
  const structured = acad.structured as Record<string, unknown>;
  const degreeClass =
    typeof structured.degreeClass === "string"
      ? (structured.degreeClass as string)
      : typeof structured.degree_class === "string"
        ? (structured.degree_class as string)
        : null;
  return {
    degreeClass,
    sourceText: acad.sourceText,
  };
}

function extractStudentLanguage(
  student: StudentProfile,
  qualifications: StudentQualification[],
): StudentLanguage {
  // Try to derive IELTS scores from qualifications if the student marked
  // proficiency as `taken` but the profile lacks explicit scores.
  let ieltsOverall: number | null = null;
  const ieltsComponentMin: number | null = null;

  for (const q of qualifications) {
    const system = q.qualificationSystem.toLowerCase();
    const title = q.title.toLowerCase();
    const isIelts = system === "ielts" || title.includes("ielts");
    if (!isIelts) continue;
    // Grade may be "7.0", "6.5", or "7.0 (6.5 component)" — parse first float.
    const gradeText = q.grade ?? q.predictedGrade ?? "";
    const overallMatch = gradeText.match(/(\d\.\d)/);
    if (overallMatch?.[1]) {
      const parsed = Number(overallMatch[1]);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 9) {
        ieltsOverall = parsed;
      }
    }
    // Overall GPA used as a fallback carrier for IELTS when grade parsing fails.
    if (ieltsOverall === null && q.overallGpa !== null && q.gpaScaleMax !== null) {
      // IELTS is 0-9, GPA scale of 9 mirrors it; treat gpa as overall.
      if (q.gpaScaleMax === 9 && q.overallGpa >= 0 && q.overallGpa <= 9) {
        ieltsOverall = q.overallGpa;
      }
    }
    if (ieltsOverall !== null) break;
  }

  return {
    englishProficiencyStatus: student.englishProficiencyStatus,
    ieltsOverall,
    ieltsComponentMin,
  };
}

function evaluateAffordability(
  student: StudentProfile,
  course: Course,
): { reason?: RecommendationReason; blocker?: RecommendationBlocker; missing?: MissingInformation; scoreDelta: number } {
  const budget = student.budgetRange;
  const fee = course.tuitionFee;
  const currency = course.currencyCode;

  if (fee === null || fee === undefined) {
    return {
      reason: {
        code: "uk_affordability_fee_unknown",
        message: "Tuition fee not published; affordability cannot be assessed.",
      },
      scoreDelta: 0,
    };
  }

  if (budget === null || budget.max === null) {
    return {
      reason: {
        code: "uk_affordability_budget_unknown",
        message: `Course fee is ${currency ?? "GBP"} ${fee.toLocaleString()}; add your budget to check affordability.`,
      },
      missing: {
        field: "budgetRange",
        message: "Add your budget range to assess affordability.",
      },
      scoreDelta: 0,
    };
  }

  const budgetMax = budget.max;
  // Currency mismatch is treated as soft uncertain — we don't block.
  if (currency && budget.currencyCode && currency !== budget.currencyCode) {
    return {
      reason: {
        code: "uk_affordability_currency_mismatch",
        message: `Course fee is ${currency} ${fee.toLocaleString()} but your budget is in ${budget.currencyCode}; currency conversion not applied.`,
      },
      scoreDelta: -3,
    };
  }

  if (fee > budgetMax) {
    const overBy = fee - budgetMax;
    const pctOver = Math.round((overBy / budgetMax) * 100);
    return {
      reason: {
        code: "uk_affordability_over_budget",
        message: `Fee ${currency ?? ""} ${fee.toLocaleString()} exceeds budget max ${budget.currencyCode} ${budgetMax.toLocaleString()} by ${pctOver}%.`,
      },
      blocker: {
        code: "uk_affordability_over_budget",
        message: `Fee exceeds your budget by ${pctOver}%. Consider funding or alternative courses.`,
        severity: "soft",
      },
      scoreDelta: -8,
    };
  }

  if (fee <= budgetMax * 0.7) {
    return {
      reason: {
        code: "uk_affordability_within_budget",
        message: `Fee ${currency ?? ""} ${fee.toLocaleString()} is comfortably within your budget.`,
      },
      scoreDelta: 6,
    };
  }

  return {
    reason: {
      code: "uk_affordability_near_budget",
      message: `Fee ${currency ?? ""} ${fee.toLocaleString()} is within your budget.`,
    },
    scoreDelta: 2,
  };
}
