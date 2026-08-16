"use server";

import { redirect } from "next/navigation";
import { createApplicationCaseSchema } from "@offer-ai/contracts";
import {
  ApplicationCaseRepository,
  ApplicationCycleRepository,
  CourseIntakeRepository,
  CourseRepository,
  InstitutionRepository,
  StudentProfileRepository,
} from "@offer-ai/database";
import { ApplicationCaseService } from "@offer-ai/domain";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";

export type CreateCaseActionState = {
  error?: string;
};

export async function createApplicationCaseAction(
  _prevState: CreateCaseActionState,
  formData: FormData,
): Promise<CreateCaseActionState> {
  const parsed = createApplicationCaseSchema.safeParse({
    institutionId: formData.get("institutionId"),
    courseId: formData.get("courseId"),
    courseIntakeId: formData.get("courseIntakeId"),
    applicationCycleId: formData.get("applicationCycleId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const user = await requireUser();
  const supabase = await getServerClient();

  const service = new ApplicationCaseService({
    studentProfileRepository: new StudentProfileRepository(supabase),
    institutionRepository: new InstitutionRepository(supabase),
    courseRepository: new CourseRepository(supabase),
    courseIntakeRepository: new CourseIntakeRepository(supabase),
    applicationCycleRepository: new ApplicationCycleRepository(supabase),
    applicationCaseRepository: new ApplicationCaseRepository(supabase),
  });

  try {
    const { caseRecord } = await service.create({
      studentId: user.id,
      ...parsed.data,
    });

    redirect(`/cases/${caseRecord.id}`);
  } catch (error) {
    // Redirects from `redirect()` must not be swallowed.
    if (typeof error === "object" && error !== null && "digest" in error) {
      throw error;
    }
    return {
      error: error instanceof Error ? error.message : "Unable to create the application case.",
    };
  }
}
