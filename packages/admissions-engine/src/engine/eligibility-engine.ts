/**
 * Deterministic eligibility pipeline.
 *
 * The engine is rule-based: the LLM never decides eligibility. The pipeline
 * is shaped for future stages (competitiveness, subject fit, affordability,
 * portfolio strategy); v1 implements the hard-eligibility scaffold.
 */

import type {
  CourseRecommendation,
  RecommendationPipelineContext,
} from "../types";

export interface EligibilityInput {
  courseId: string;
  intendedStudyLevel: string | null;
  countryCode: string;
}

export interface EligibilityPipeline {
  evaluate(input: EligibilityInput): Promise<CourseRecommendation>;
}

export class RuleBasedEligibilityPipeline implements EligibilityPipeline {
  constructor(private readonly context: RecommendationPipelineContext) {}

  async evaluate(input: EligibilityInput): Promise<CourseRecommendation> {
    if (input.countryCode !== "GB") {
      throw new Error(
        `No eligibility rules for country "${input.countryCode}". UK is the only implementation.`,
      );
    }

    const { buildUKRecommendationScaffold } = await import(
      "../countries/uk/uk-adapter"
    );

    return buildUKRecommendationScaffold(
      {
        courseId: input.courseId,
        intendedStudyLevel: input.intendedStudyLevel,
      },
      this.context,
    );
  }
}
