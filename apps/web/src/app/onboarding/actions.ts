"use server";

import { redirect } from "next/navigation";
import {
  onboardingStepSchema,
  type OnboardingStepPayload,
} from "@offer-ai/contracts";
import { requireUser } from "@/lib/auth";
import { createOnboardingService } from "@/lib/services/onboarding-service";
import type { StudentProfile } from "@offer-ai/domain";

export type OnboardingActionState = {
  ok?: boolean;
  error?: string;
  step?: number;
};

/**
 * The wizard serialises array/object fields as JSON strings in FormData.
 * Decode them before schema validation.
 */
function decodeJsonField(value: FormDataEntryValue | null, fallback: unknown): unknown {
  if (value === null || value === "") return fallback;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function formDataToPayload(step: number, formData: FormData): unknown {
  const raw = Object.fromEntries(formData.entries());

  return {
    step,
    fullName: String(raw.fullName ?? ""),
    currentCountryCode: (raw.currentCountryCode as string) || null,
    nationalityCountryCode: (raw.nationalityCountryCode as string) || null,
    currentEducationLevel: (raw.currentEducationLevel as string) || null,
    intendedStudyLevel: (raw.intendedStudyLevel as string) || null,
    targetSubjectAreas: decodeJsonField(
      raw.targetSubjectAreas ?? null,
      [],
    ) as string[],
    targetEntryYear: raw.targetEntryYear ? Number(raw.targetEntryYear) : null,
    targetCountryCodes: decodeJsonField(raw.targetCountryCodes ?? null, []) as string[],
    budgetRange: decodeJsonField(raw.budgetRange ?? null, null) as
      | { currencyCode: string; min: number | null; max: number | null }
      | null,
    englishProficiencyStatus: (raw.englishProficiencyStatus as string) || null,
  };
}

function patchFromStep(step: OnboardingStepPayload): Partial<StudentProfile> {
  switch (step.step) {
    case 1:
      return { fullName: step.fullName };
    case 2:
      return {
        currentCountryCode: step.currentCountryCode,
        nationalityCountryCode: step.nationalityCountryCode,
      };
    case 3:
      return { currentEducationLevel: step.currentEducationLevel };
    case 4:
      return {
        intendedStudyLevel: step.intendedStudyLevel,
        targetSubjectAreas: step.targetSubjectAreas,
        targetEntryYear: step.targetEntryYear,
        targetCountryCodes: step.targetCountryCodes,
      };
    case 5:
      return { budgetRange: step.budgetRange };
    case 6:
      return { englishProficiencyStatus: step.englishProficiencyStatus };
    default:
      return {};
  }
}

export async function saveOnboardingStepAction(
  prevState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const stepNumber = Number(formData.get("step"));

  try {
    const payload = formDataToPayload(stepNumber, formData);
    const parsed = onboardingStepSchema.safeParse(payload);

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        step: stepNumber,
      };
    }

    const user = await requireUser();
    const service = await createOnboardingService(user.id);
    await service.saveStep(patchFromStep(parsed.data));

    return { ok: true, step: stepNumber };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to save this step.",
      step: stepNumber,
    };
  }
}

export async function completeOnboardingAction(): Promise<void> {
  const user = await requireUser();
  const service = await createOnboardingService(user.id);
  const profile = await service.getProfile();

  if (profile) {
    await service.completeOnboarding(profile);
  }

  redirect("/dashboard");
}
