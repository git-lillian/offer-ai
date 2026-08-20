"use server";

import { revalidatePath } from "next/cache";
import { saveCourseSchema, unsaveCourseSchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { requireUser } from "@/lib/auth";
import { createSavedCourseService } from "@/lib/services/saved-course";

export type SavedCourseActionState = {
  error?: string;
  ok?: boolean;
};

export async function saveCourseAction(input: { courseId: string }): Promise<SavedCourseActionState> {
  const parsed = saveCourseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const service = await createSavedCourseService();
    await service.saveForUser(user.id, parsed.data.courseId);
    revalidatePath("/saved");
    revalidatePath("/recommendations");
    return { ok: true };
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to save course." };
  }
}

export async function unsaveCourseAction(input: { courseId: string }): Promise<SavedCourseActionState> {
  const parsed = unsaveCourseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const service = await createSavedCourseService();
    await service.unsaveForUser(user.id, parsed.data.courseId);
    revalidatePath("/saved");
    revalidatePath("/recommendations");
    return { ok: true };
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to remove saved course." };
  }
}

// FormData variants for progressive enhancement / useActionState
export async function saveCourseFormAction(
  _prevState: SavedCourseActionState,
  formData: FormData,
): Promise<SavedCourseActionState> {
  return saveCourseAction({ courseId: String(formData.get("courseId") ?? "") });
}

export async function unsaveCourseFormAction(
  _prevState: SavedCourseActionState,
  formData: FormData,
): Promise<SavedCourseActionState> {
  return unsaveCourseAction({ courseId: String(formData.get("courseId") ?? "") });
}
