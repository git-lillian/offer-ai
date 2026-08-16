import "server-only";
import { StudentProfileRepository } from "@offer-ai/database";
import type { StudentProfile } from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";

/**
 * Student onboarding application service — persists each wizard step to the
 * canonical Student 360 profile in Postgres (never localStorage).
 *
 * The profile row is created by the signup trigger (`handle_new_user`); this
 * service resolves the authenticated user's profile and updates it in place.
 */
export class OnboardingService {
  constructor(
    private readonly userId: string,
    private readonly repo: StudentProfileRepository,
  ) {}

  async getProfile(): Promise<StudentProfile | null> {
    return this.repo.findByUserId(this.userId);
  }

  async saveStep(patch: Partial<StudentProfile>): Promise<StudentProfile> {
    const existing = (await this.repo.findByUserId(this.userId)) ?? this.emptyProfile();
    const updated = { ...existing, ...patch, updatedAt: new Date() };
    return this.repo.createOrUpdate(updated);
  }

  async completeOnboarding(profile: StudentProfile): Promise<StudentProfile> {
    return this.repo.createOrUpdate({
      ...profile,
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  private emptyProfile(): StudentProfile {
    return {
      id: crypto.randomUUID(),
      userId: this.userId,
      fullName: "",
      email: null,
      accountStatus: "claimed",
      createdByUserId: null,
      claimedAt: new Date(),
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
}

/** Creates an onboarding service bound to the request's RLS-enforced client. */
export async function createOnboardingService(
  userId: string,
): Promise<OnboardingService> {
  const supabase = await getServerClient();
  return new OnboardingService(userId, new StudentProfileRepository(supabase));
}
