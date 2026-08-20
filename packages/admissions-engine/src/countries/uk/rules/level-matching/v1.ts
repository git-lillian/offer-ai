/**
 * UK rule: level matching v1 — pure function.
 *
 * Determines whether the student's intended study level aligns with the
 * course level. No LLM, no I/O, deterministic.
 */

import type {
  RecommendationReason,
  RecommendationBlocker,
  MissingInformation,
} from "../../../../types";

export const LEVEL_MATCHING_RULE_VERSION = "1.0.0";

export type LevelMatchingInput = {
  intendedStudyLevel: string | null;
  courseLevel: string;
};

export type LevelMatchingResult = {
  eligibility: "eligible" | "ineligible" | "uncertain";
  reason: RecommendationReason;
  blocker?: RecommendationBlocker;
  missing?: MissingInformation;
  scoreDelta: number;
};

const STUDY_LEVEL_LABELS: Record<string, string> = {
  foundation: "Foundation",
  undergraduate: "Undergraduate",
  postgraduate_taught: "Postgraduate taught",
  postgraduate_research: "Postgraduate research",
  phd: "PhD",
};

function label(level: string): string {
  return STUDY_LEVEL_LABELS[level] ?? level.replace(/_/g, " ");
}

export function evaluateLevelMatchingV1(input: LevelMatchingInput): LevelMatchingResult {
  const { intendedStudyLevel, courseLevel } = input;

  if (intendedStudyLevel === null || intendedStudyLevel.trim() === "") {
    return {
      eligibility: "uncertain",
      reason: {
        code: "uk_level_missing",
        message: `Intended study level not provided; cannot confirm fit for ${label(courseLevel)} course.`,
      },
      missing: {
        field: "intendedStudyLevel",
        message: "Add your intended study level to assess course fit.",
      },
      scoreDelta: -10,
    };
  }

  if (intendedStudyLevel === courseLevel) {
    return {
      eligibility: "eligible",
      reason: {
        code: "uk_level_match",
        message: `Intended ${label(intendedStudyLevel)} matches course level ${label(courseLevel)}.`,
      },
      scoreDelta: 15,
    };
  }

  // Foundation bridging to undergraduate is treated as a soft mismatch rather
  // than a hard block — many UK providers accept foundation as a pathway.
  if (intendedStudyLevel === "foundation" && courseLevel === "undergraduate") {
    return {
      eligibility: "uncertain",
      reason: {
        code: "uk_level_foundation_pathway",
        message: "Foundation qualification may progress to undergraduate; check pathway requirements.",
      },
      missing: {
        field: "qualifications",
        message: "Confirm foundation progression requirements for this course.",
      },
      scoreDelta: -5,
    };
  }

  return {
    eligibility: "ineligible",
    reason: {
      code: "uk_level_mismatch",
      message: `Intended ${label(intendedStudyLevel)} does not match course level ${label(courseLevel)}.`,
    },
    blocker: {
      code: "uk_level_mismatch",
      message: `Course requires ${label(courseLevel)} entry; your intended level is ${label(intendedStudyLevel)}.`,
      severity: "hard",
    },
    scoreDelta: -30,
  };
}
