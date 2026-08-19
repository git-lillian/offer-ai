/**
 * UK rule: qualification matching v1 — pure function.
 *
 * Checks that the student holds (or can plausibly obtain) a qualification
 * that satisfies the course's academic requirement. Deterministic; no LLM.
 * Volatile thresholds (e.g. degree class boundaries) live in the catalogue
 * requirement's `structured` + provenance, not hard-coded beyond comparison
 * helpers here.
 */

import type {
  RecommendationReason,
  RecommendationBlocker,
  MissingInformation,
} from "../../../../types";

export const QUALIFICATION_RULE_VERSION = "1.0.0";

export type StudentQualificationLite = {
  qualificationSystem: string;
  grade: string | null;
  predictedGrade: string | null;
  overallGpa: number | null;
  gpaScaleMax: number | null;
};

export type AcademicRequirement = {
  degreeClass?: string | null;
  /** Future: A-level thresholds, IB points, etc. Not used in v1. */
  sourceText?: string;
} | null;

export type QualificationInput = {
  courseLevel: string;
  studentQualifications: StudentQualificationLite[];
  requirement: AcademicRequirement;
};

export type QualificationResult = {
  eligibility: "eligible" | "ineligible" | "uncertain";
  reason: RecommendationReason;
  blocker?: RecommendationBlocker;
  missing?: MissingInformation;
  scoreDelta: number;
};

// Map UK honours classes to minimum GPA thresholds on a 4.0 scale.
// These are conservative, documented approximations — the authoritative
// requirement is the course's sourceText + structured degreeClass from the
// catalogue. The mapping is deterministic and versioned with this rule.
const DEGREE_CLASS_GPA_THRESHOLDS: Record<string, number> = {
  first: 3.7,
  "2:1": 3.3,
  "2:2": 2.7,
  third: 2.0,
};

const UNDERGRADUATE_SYSTEMS = new Set([
  "a_level",
  "as_level",
  "gcse",
  "ib",
  "ib_certificate",
  "ap",
  "us_high_school",
  "hong_kong_dse",
  "australian_atar",
  "canadian_high_school",
  "french_baccalaureat",
  "german_abitur",
  "indian_standard_xii",
  "malaysian_stpm",
  "singapore_a_level",
  "international_foundation",
  "gaokao",
  "chinese_gaokao",
]);

const POSTGRADUATE_SYSTEMS = new Set([
  "uk_undergraduate",
  "uk_postgraduate",
  "chinese_undergraduate",
  "us_high_school",
]);

function normalizeDegreeClass(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (lower.includes("first")) return "first";
  if (lower.includes("2:1") || lower.includes("upper second")) return "2:1";
  if (lower.includes("2:2") || lower.includes("lower second")) return "2:2";
  if (lower.includes("third") || lower === "3rd") return "third";
  return lower;
}

function hasUndergraduateQualification(quals: StudentQualificationLite[]): boolean {
  return quals.some((q) => UNDERGRADUATE_SYSTEMS.has(q.qualificationSystem));
}

function hasPostgraduateQualification(quals: StudentQualificationLite[]): boolean {
  return quals.some((q) => POSTGRADUATE_SYSTEMS.has(q.qualificationSystem));
}

function gpaOnFourScale(overallGpa: number | null, scaleMax: number | null): number | null {
  if (overallGpa === null || overallGpa === undefined) return null;
  const scale = scaleMax ?? 4.0;
  if (scale <= 0) return null;
  return (overallGpa / scale) * 4.0;
}

function satisfiesDegreeClass(
  quals: StudentQualificationLite[],
  requiredClass: string,
): { met: boolean; evidence: string | null } {
  const required = normalizeDegreeClass(requiredClass);
  const requiredGpa = DEGREE_CLASS_GPA_THRESHOLDS[required];
  for (const q of quals) {
    // Direct string match on grade/predictedGrade
    const grades = [q.grade, q.predictedGrade].filter(Boolean).map((g) => normalizeDegreeClass(g as string));
    if (grades.includes(required)) return { met: true, evidence: q.grade ?? q.predictedGrade };
    // Also allow "first" to satisfy any lower requirement
    if (required === "2:1" && grades.includes("first")) return { met: true, evidence: q.grade ?? q.predictedGrade };
    if (required === "2:2" && (grades.includes("first") || grades.includes("2:1"))) {
      return { met: true, evidence: q.grade ?? q.predictedGrade };
    }
    // GPA check
    const gpa4 = gpaOnFourScale(q.overallGpa, q.gpaScaleMax);
    if (gpa4 !== null && requiredGpa !== undefined && gpa4 >= requiredGpa) {
      return { met: true, evidence: `${q.overallGpa}/${q.gpaScaleMax ?? 4} (~${gpa4.toFixed(2)}/4.0)` };
    }
  }
  return { met: false, evidence: null };
}

export function evaluateQualificationV1(input: QualificationInput): QualificationResult {
  const { courseLevel, studentQualifications, requirement } = input;

  const normalizedLevel = courseLevel.trim().toLowerCase();

  // No academic requirement published → no hard block.
  if (requirement === null || requirement === undefined) {
    if (studentQualifications.length === 0) {
      return {
        eligibility: "uncertain",
        reason: {
          code: "uk_qualification_no_requirement_but_empty",
          message: "No academic requirement published; add qualifications to improve confidence.",
        },
        missing: {
          field: "qualifications",
          message: "Add your qualifications to assess fit.",
        },
        scoreDelta: -5,
      };
    }
    return {
      eligibility: "eligible",
      reason: {
        code: "uk_qualification_no_requirement",
        message: "No academic requirement published for this course.",
      },
      scoreDelta: 5,
    };
  }

  const degreeClass = requirement.degreeClass?.trim() ?? null;

  // Undergraduate pathway
  if (["foundation", "undergraduate"].includes(normalizedLevel)) {
    if (studentQualifications.length === 0) {
      return {
        eligibility: "uncertain",
        reason: {
          code: "uk_qualification_undergrad_missing",
          message: "Undergraduate entry requires school qualifications (e.g. A Levels, IB, AP); none on file.",
        },
        missing: {
          field: "qualifications",
          message: "Add your school qualifications (A Levels, IB, AP, etc.).",
        },
        scoreDelta: -12,
      };
    }
    if (!hasUndergraduateQualification(studentQualifications)) {
      const hasAnyPostgrad = hasPostgraduateQualification(studentQualifications);
      if (hasAnyPostgrad) {
        // Student with a degree applying to undergraduate — not a hard block,
        // but worth flagging as uncertain (mature student / second degree).
        return {
          eligibility: "uncertain",
          reason: {
            code: "uk_qualification_undergrad_postgrad_holder",
            message: "You hold a degree-level qualification; undergraduate entry may have additional checks.",
          },
          missing: {
            field: "qualifications",
            message: "Add school-level qualifications or confirm mature entry route.",
          },
          scoreDelta: -5,
        };
      }
      return {
        eligibility: "uncertain",
        reason: {
          code: "uk_qualification_undergrad_unknown_system",
          message: "Qualifications on file do not match recognised undergraduate systems.",
        },
        missing: {
          field: "qualifications",
          message: "Add recognised school qualifications (A Levels, IB, AP, etc.).",
        },
        scoreDelta: -8,
      };
    }
    // Has at least one recognised undergrad qualification → eligible scaffold.
    // Grade thresholds are course-specific and live in structured source; v1
    // does not hard-code them, so we return eligible with confidence note.
    return {
      eligibility: "eligible",
      reason: {
        code: "uk_qualification_undergrad_present",
        message: "Recognised undergraduate qualification on file.",
      },
      scoreDelta: 12,
    };
  }

  // Postgraduate pathway (taught, research, phd)
  if (["postgraduate_taught", "postgraduate_research", "phd"].includes(normalizedLevel)) {
    if (studentQualifications.length === 0) {
      return {
        eligibility: "uncertain",
        reason: {
          code: "uk_qualification_postgrad_missing",
          message: "Postgraduate entry requires a prior degree; none on file.",
        },
        missing: {
          field: "qualifications",
          message: "Add your undergraduate degree qualification.",
        },
        scoreDelta: -15,
      };
    }

    if (degreeClass) {
      const result = satisfiesDegreeClass(studentQualifications, degreeClass);
      if (result.met) {
        return {
          eligibility: "eligible",
          reason: {
            code: "uk_qualification_postgrad_met",
            message: `Meets required ${degreeClass} via ${result.evidence}.`,
          },
          scoreDelta: 15,
        };
      }
      // Check if student has any degree-level qualification at all; if not,
      // the blocker is missing education rather than low grades.
      if (!hasPostgraduateQualification(studentQualifications)) {
        return {
          eligibility: "uncertain",
          reason: {
            code: "uk_qualification_postgrad_no_degree",
            message: `Postgraduate requires ${degreeClass}; no degree-level qualification on file.`,
          },
          missing: {
            field: "qualifications",
            message: `Add a degree qualification (requires ${degreeClass}).`,
          },
          scoreDelta: -12,
        };
      }
      return {
        eligibility: "ineligible",
        reason: {
          code: "uk_qualification_postgrad_below",
          message: `Requires ${degreeClass}; your qualifications do not meet this threshold.`,
        },
        blocker: {
          code: "uk_qualification_postgrad_below",
          message: `Requires ${degreeClass} honours (or equivalent); your record is below this.`,
          severity: "hard",
        },
        scoreDelta: -25,
      };
    }

    // No explicit class — any degree suffices.
    if (hasPostgraduateQualification(studentQualifications)) {
      return {
        eligibility: "eligible",
        reason: {
          code: "uk_qualification_postgrad_present",
          message: "Degree-level qualification on file meets postgraduate entry baseline.",
        },
        scoreDelta: 10,
      };
    }
    return {
      eligibility: "uncertain",
      reason: {
        code: "uk_qualification_postgrad_unknown",
        message: "No degree-level qualification recognised for postgraduate entry.",
      },
      missing: {
        field: "qualifications",
        message: "Add your undergraduate degree details.",
      },
      scoreDelta: -10,
    };
  }

  // Unknown course level — keep deterministic but surface uncertainty.
  return {
    eligibility: "uncertain",
    reason: {
      code: "uk_qualification_unknown_level",
      message: `Unknown course level "${courseLevel}"; cannot evaluate qualifications.`,
    },
    missing: {
      field: "qualifications",
      message: "Course level is not recognised; add qualifications for manual review.",
    },
    scoreDelta: -10,
  };
}
