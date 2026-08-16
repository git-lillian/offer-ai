/**
 * UK country adapter — country implementation number one.
 *
 * v1 implements the minimal scaffold: cycle policy and external status
 * mapping. Comprehensive eligibility rules are future work behind the same
 * interface (ADR 0004).
 */

import type { AdmissionsCountryAdapter } from "../../country-adapter";
import type {
  ApplicationCyclePolicy,
  ApplicationPortfolioValidation,
  CountrySpecificEvaluation,
  ExternalApplicationStatus,
  RequiredDocuments,
} from "../../country-adapter";
import type { CourseRecommendation, RecommendationPipelineContext } from "../../types";

export class UKCountryAdapter implements AdmissionsCountryAdapter {
  readonly countryCode = "GB";

  async getApplicationCyclePolicy(
    cycleCode: string,
    _context: RecommendationPipelineContext,
  ): Promise<ApplicationCyclePolicy> {
    const match = cycleCode.match(/^(\d{4})\/(\d{2})$/);
    if (!match || !match[1] || !match[2]) {
      throw new Error(`Invalid UK application cycle code: ${cycleCode}`);
    }
    const entryYear = Number(match[1]);
    return {
      entryYears: [entryYear],
      notes: [
        "Equal-consideration deadlines are published per intake in the admissions catalogue with source provenance.",
      ],
    };
  }

  async validateApplicationPortfolio(
    _input: unknown,
  ): Promise<ApplicationPortfolioValidation> {
    return { valid: true, issues: [] };
  }

  async determineRequiredDocuments(
    _input: unknown,
  ): Promise<RequiredDocuments> {
    return {
      documentKinds: ["transcript", "qualification_certificate", "personal_statement"],
      notes: ["English proficiency evidence required for non-native applicants."],
    };
  }

  async mapExternalApplicationStatus(
    externalStatus: ExternalApplicationStatus,
  ): Promise<string> {
    const mapping: Record<ExternalApplicationStatus, string> = {
      draft: "draft",
      submitted: "submitted",
      received: "submitted",
      under_review: "under_review",
      offer: "offer_received",
      conditional_offer: "offer_received",
      unconditional_offer: "offer_received",
      rejected: "rejected",
      withdrawn: "withdrawn",
    };
    return mapping[externalStatus];
  }

  async evaluateCountrySpecificRules(
    _input: unknown,
  ): Promise<CountrySpecificEvaluation> {
    return { recommendations: [], notes: [] };
  }
}

export function buildUKRecommendationScaffold(
  input: { courseId: string; intendedStudyLevel: string | null },
  context: RecommendationPipelineContext,
): CourseRecommendation {
  const eligibility =
    input.intendedStudyLevel === "undergraduate" ? "eligible" : "uncertain";

  return {
    courseId: input.courseId,
    eligibility,
    strategyBand: "target",
    score: 50,
    confidence: eligibility === "eligible" ? 0.6 : 0.3,
    reasons: [
      {
        code: "uk_intended_level",
        message: `Intended study level: ${input.intendedStudyLevel ?? "not provided"}.`,
      },
    ],
    blockers: [],
    missingInformation:
      eligibility === "uncertain"
        ? [
            {
              field: "qualifications",
              message: "UK eligibility rules v1 requires undergraduate level input.",
            },
          ]
        : [],
    profileVersion: context.profileVersion,
    catalogueVersion: context.catalogueVersion,
    rulesVersion: context.rulesVersion,
  };
}
