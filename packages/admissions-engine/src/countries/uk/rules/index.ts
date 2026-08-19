export const UK_RULES_VERSION = "uk-v1.0.0";

export { LEVEL_MATCHING_RULE_VERSION, evaluateLevelMatchingV1 } from "./level-matching/v1";
export { LANGUAGE_RULE_VERSION, evaluateLanguageV1 } from "./language/v1";
export { QUALIFICATION_RULE_VERSION, evaluateQualificationV1 } from "./qualification/v1";

export type { LevelMatchingInput, LevelMatchingResult } from "./level-matching/v1";
export type { LanguageInput, LanguageResult, LanguageRequirement, StudentLanguage } from "./language/v1";
export type {
  QualificationInput,
  QualificationResult,
  StudentQualificationLite,
  AcademicRequirement,
} from "./qualification/v1";
