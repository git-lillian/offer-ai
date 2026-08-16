/**
 * Admissions engine types — the deterministic recommendation result contract.
 */

export const ELIGIBILITY_OUTCOMES = ["eligible", "ineligible", "uncertain"] as const;
export type EligibilityOutcome = (typeof ELIGIBILITY_OUTCOMES)[number];

export const STRATEGY_BANDS = ["aspirational", "target", "safer"] as const;
export type StrategyBand = (typeof STRATEGY_BANDS)[number];

export interface RecommendationReason {
  code: string;
  message: string;
}

export interface RecommendationBlocker {
  code: string;
  message: string;
  severity: "hard" | "soft";
}

export interface MissingInformation {
  field: string;
  message: string;
}

export interface CourseRecommendation {
  courseId: string;
  eligibility: EligibilityOutcome;
  strategyBand: StrategyBand;
  score: number;
  confidence: number;
  reasons: RecommendationReason[];
  blockers: RecommendationBlocker[];
  missingInformation: MissingInformation[];
  /** Reproducibility: which profile/catalogue/rules versions produced this. */
  profileVersion: string;
  catalogueVersion: string;
  rulesVersion: string;
}

export interface RecommendationPipelineContext {
  profileVersion: string;
  catalogueVersion: string;
  rulesVersion: string;
}
