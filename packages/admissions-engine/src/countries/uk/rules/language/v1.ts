/**
 * UK rule: language / IELTS v1 — pure function.
 *
 * Evaluates English language requirements. No LLM, deterministic, operates on
 * structured data only. Volatile facts (IELTS thresholds) live in the
 * catalogue requirement's `structured` + `sourceText` + provenance — never
 * hard-coded here beyond comparison logic.
 */

import type {
  RecommendationReason,
  RecommendationBlocker,
  MissingInformation,
} from "../../../../types";

export const LANGUAGE_RULE_VERSION = "1.0.0";

export type LanguageRequirement = {
  test: string;
  overall: number;
  componentMinimum?: number | null;
} | null;

export type StudentLanguage = {
  englishProficiencyStatus: string | null;
  /** When `taken`, the student's IELTS (or equivalent) scores if known. */
  ieltsOverall: number | null;
  ieltsComponentMin: number | null;
};

export type LanguageInput = {
  student: StudentLanguage;
  requirement: LanguageRequirement;
};

export type LanguageResult = {
  eligibility: "eligible" | "ineligible" | "uncertain";
  reason: RecommendationReason;
  blocker?: RecommendationBlocker;
  missing?: MissingInformation;
  scoreDelta: number;
};

export function evaluateLanguageV1(input: LanguageInput): LanguageResult {
  const { student, requirement } = input;

  if (requirement === null) {
    return {
      eligibility: "eligible",
      reason: {
        code: "uk_language_no_requirement",
        message: "No English language requirement published for this course.",
      },
      scoreDelta: 5,
    };
  }

  const test = requirement.test.trim();
  const requiredOverall = requirement.overall;
  const requiredComponent = requirement.componentMinimum ?? null;

  // Exempt students never blocked by language.
  if (student.englishProficiencyStatus === "exempt") {
    return {
      eligibility: "eligible",
      reason: {
        code: "uk_language_exempt",
        message: "English proficiency marked as exempt.",
      },
      scoreDelta: 10,
    };
  }

  // Non-IELTS tests: we lack a calibrated comparison, so surface uncertainty
  // rather than guessing.
  if (test.toUpperCase() !== "IELTS") {
    return {
      eligibility: "uncertain",
      reason: {
        code: "uk_language_other_test",
        message: `Language requirement is ${test} ${requiredOverall}; IELTS comparison unavailable.`,
      },
      missing: {
        field: "englishProficiency",
        message: `Course requires ${test} ${requiredOverall}. Confirm your ${test} scores.`,
      },
      scoreDelta: 0,
    };
  }

  const status = student.englishProficiencyStatus;

  if (status === null || status === "not_taken") {
    return {
      eligibility: "ineligible",
      reason: {
        code: "uk_language_not_taken",
        message: `IELTS ${requiredOverall} required; English proficiency not yet taken.`,
      },
      blocker: {
        code: "uk_language_not_taken",
        message: `IELTS ${requiredOverall}${requiredComponent ? ` (min ${requiredComponent} per component)` : ""} required.`,
        severity: "hard",
      },
      scoreDelta: -20,
    };
  }

  if (status === "planned") {
    return {
      eligibility: "uncertain",
      reason: {
        code: "uk_language_planned",
        message: `IELTS ${requiredOverall} required; test is planned.`,
      },
      missing: {
        field: "englishProficiency",
        message: "Add your planned IELTS date and target scores.",
      },
      scoreDelta: -10,
    };
  }

  // status === "taken" — need scores.
  if (student.ieltsOverall === null) {
    return {
      eligibility: "uncertain",
      reason: {
        code: "uk_language_scores_missing",
        message: `IELTS ${requiredOverall} required; your scores are not on file.`,
      },
      missing: {
        field: "ieltsOverall",
        message: "Add your IELTS overall and component scores.",
      },
      scoreDelta: -10,
    };
  }

  const overallOk = student.ieltsOverall >= requiredOverall;
  const componentOk =
    requiredComponent === null ||
    requiredComponent === undefined ||
    student.ieltsComponentMin === null ||
    student.ieltsComponentMin >= requiredComponent;

  // If the student only supplied overall but requirement has component minimum,
  // we treat component as unknown → soft uncertainty, not hard ineligible.
  if (requiredComponent !== null && student.ieltsComponentMin === null) {
    if (!overallOk) {
      return {
        eligibility: "ineligible",
        reason: {
          code: "uk_language_overall_below",
          message: `IELTS ${student.ieltsOverall} below required ${requiredOverall}.`,
        },
        blocker: {
          code: "uk_language_overall_below",
          message: `IELTS overall ${student.ieltsOverall} is below required ${requiredOverall}.`,
          severity: "hard",
        },
        scoreDelta: -25,
      };
    }
    return {
      eligibility: "uncertain",
      reason: {
        code: "uk_language_component_unknown",
        message: `IELTS overall ${student.ieltsOverall} meets ${requiredOverall}, but component scores are missing (requires ${requiredComponent} per component).`,
      },
      missing: {
        field: "ieltsComponentMin",
        message: `Add component scores; course requires ${requiredComponent} in each component.`,
      },
      scoreDelta: -5,
    };
  }

  if (overallOk && componentOk) {
    return {
      eligibility: "eligible",
      reason: {
        code: "uk_language_met",
        message: `IELTS ${student.ieltsOverall} meets required ${requiredOverall}${requiredComponent ? ` (component min ${requiredComponent})` : ""}.`,
      },
      scoreDelta: 12,
    };
  }

  return {
    eligibility: "ineligible",
    reason: {
      code: "uk_language_below_requirement",
      message: `IELTS ${student.ieltsOverall}${student.ieltsComponentMin !== null ? ` (component ${student.ieltsComponentMin})` : ""} below required ${requiredOverall}${requiredComponent ? ` / ${requiredComponent}` : ""}.`,
    },
    blocker: {
      code: "uk_language_below_requirement",
      message: `IELTS does not meet ${requiredOverall}${requiredComponent ? ` with ${requiredComponent} per component` : ""}.`,
      severity: "hard",
    },
    scoreDelta: -25,
  };
}
