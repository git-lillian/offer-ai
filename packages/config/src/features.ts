/**
 * Feature flags — simple env-driven configuration.
 *
 * Future country launches and product areas are gated here instead of
 * scattering conditions through the code. No external feature-management
 * SaaS is introduced at this stage.
 */

export const FEATURE_FLAGS = {
  uk_admissions: true,
  expert_marketplace: false,
  experience_builder: false,
  university_recommendations: false,
  document_studio: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}
