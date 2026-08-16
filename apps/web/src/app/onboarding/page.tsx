import { redirect } from "next/navigation";
import type { StudentProfile } from "@offer-ai/domain";
import { requireUser } from "@/lib/auth";
import { createOnboardingService } from "@/lib/services/onboarding-service";
import { OnboardingWizard } from "./wizard";

export const metadata = {
  title: "Student onboarding | Offer.ai",
};

export default async function OnboardingPage() {
  const user = await requireUser();
  const service = await createOnboardingService(user.id);
  const profile = await service.getProfile();

  if (profile?.onboardingCompletedAt) {
    redirect("/dashboard");
  }

  return <OnboardingWizard initialProfile={profile} />;
}

export function profileToInitial(
  profile: StudentProfile | null,
): StudentProfile {
  return profile ?? {
    userId: "",
    fullName: "",
    email: "",
    currentCountryCode: null,
    nationalityCountryCode: null,
    currentEducationLevel: null,
    intendedStudyLevel: null,
    targetSubjectAreas: [],
    targetEntryYear: null,
    targetCountryCodes: [],
    budgetRange: null,
    englishProficiencyStatus: null,
    onboardingCompletedAt: null,
    updatedAt: new Date(),
  };
}
