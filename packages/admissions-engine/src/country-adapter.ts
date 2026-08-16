/**
 * Country adapter architecture.
 *
 * Admissions rules differ by destination country. The engine composes
 * adapters; future countries are added as new adapter implementations
 * without touching the UK one (see ADR 0004).
 */

import type { CourseRecommendation, RecommendationPipelineContext } from "./types";

export interface ApplicationCyclePolicy {
  entryYears: number[];
  /**
   * Human-readable note about the cycle, when the country rules have
   * something stable to say (e.g. portfolio windows). Deadlines are
   * decision-critical, date-bearing facts and live in the admissions
   * catalogue (cycle-scoped intake deadlines with provenance) — they are
   * never hard-coded in adapters.
   */
  notes: string[];
}

export interface ApplicationPortfolioValidation {
  valid: boolean;
  issues: string[];
}

export interface RequiredDocuments {
  documentKinds: string[];
  notes: string[];
}

export type ExternalApplicationStatus =
  | "draft"
  | "submitted"
  | "received"
  | "under_review"
  | "offer"
  | "unconditional_offer"
  | "conditional_offer"
  | "rejected"
  | "withdrawn";

export interface CountrySpecificEvaluation {
  recommendations: CourseRecommendation[];
  notes: string[];
}

export interface AdmissionsCountryAdapter {
  countryCode: string;

  getApplicationCyclePolicy(
    cycleCode: string,
    context: RecommendationPipelineContext,
  ): Promise<ApplicationCyclePolicy>;

  validateApplicationPortfolio(input: unknown): Promise<ApplicationPortfolioValidation>;

  determineRequiredDocuments(input: unknown): Promise<RequiredDocuments>;

  mapExternalApplicationStatus(
    externalStatus: ExternalApplicationStatus,
  ): Promise<string>;

  evaluateCountrySpecificRules(input: unknown): Promise<CountrySpecificEvaluation>;
}
