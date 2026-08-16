import { z } from "zod";

const isoCountryCode = z
  .string()
  .regex(/^[A-Z]{2}$/, "Must be an ISO 3166-1 alpha-2 country code.");

const isoCurrencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, "Must be an ISO 4217 currency code.");

export const studyLevelSchema = z.enum([
  "foundation",
  "undergraduate",
  "postgraduate_taught",
  "postgraduate_research",
  "phd",
]);

export const englishProficiencyStatusSchema = z.enum([
  "not_taken",
  "planned",
  "taken",
  "exempt",
]);

export const budgetRangeSchema = z
  .object({
    currencyCode: isoCurrencyCode,
    min: z.number().int().nonnegative().nullable(),
    max: z.number().int().nonnegative().nullable(),
  })
  .refine((value) => {
    if (value.min === null || value.max === null) return true;
    return value.min <= value.max;
  }, "Budget minimum cannot exceed maximum.");

/**
 * Step 1: basic details.
 */
export const onboardingBasicDetailsSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(120),
});

/**
 * Step 2: current country and nationality.
 */
export const onboardingLocationSchema = z.object({
  currentCountryCode: isoCountryCode.nullable(),
  nationalityCountryCode: isoCountryCode.nullable(),
});

/**
 * Step 3: current education.
 */
export const onboardingEducationSchema = z.object({
  currentEducationLevel: z.string().trim().max(120).nullable(),
});

/**
 * Step 4: intended study.
 */
export const onboardingStudyIntentSchema = z.object({
  intendedStudyLevel: studyLevelSchema.nullable(),
  targetSubjectAreas: z.array(z.string().trim().min(1)).max(8).default([]),
  targetEntryYear: z.number().int().min(2025).max(2035).nullable(),
  targetCountryCodes: z.array(isoCountryCode).max(5).default([]),
});

/**
 * Step 5: budget.
 */
export const onboardingBudgetSchema = z.object({
  budgetRange: budgetRangeSchema.nullable(),
});

/**
 * Step 6: English proficiency.
 */
export const onboardingEnglishSchema = z.object({
  englishProficiencyStatus: englishProficiencyStatusSchema.nullable(),
});

export const onboardingStepSchema = z.discriminatedUnion("step", [
  onboardingBasicDetailsSchema.extend({ step: z.literal(1) }),
  onboardingLocationSchema.extend({ step: z.literal(2) }),
  onboardingEducationSchema.extend({ step: z.literal(3) }),
  onboardingStudyIntentSchema.extend({ step: z.literal(4) }),
  onboardingBudgetSchema.extend({ step: z.literal(5) }),
  onboardingEnglishSchema.extend({ step: z.literal(6) }),
]);

export type OnboardingStepPayload = z.infer<typeof onboardingStepSchema>;
export type OnboardingBasicDetails = z.infer<typeof onboardingBasicDetailsSchema>;
export type OnboardingLocation = z.infer<typeof onboardingLocationSchema>;
export type OnboardingEducation = z.infer<typeof onboardingEducationSchema>;
export type OnboardingStudyIntent = z.infer<typeof onboardingStudyIntentSchema>;
export type OnboardingBudget = z.infer<typeof onboardingBudgetSchema>;
export type OnboardingEnglish = z.infer<typeof onboardingEnglishSchema>;
