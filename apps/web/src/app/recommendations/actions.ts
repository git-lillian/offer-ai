"use server";

import { revalidatePath } from "next/cache";
import { generateRecommendationsRequestSchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { requireUser } from "@/lib/auth";
import { createRecommendationService } from "@/lib/services/recommendation";

export type GenerateRecommendationsState = {
  error?: string;
  recommendations?: unknown;
};

export async function generateRecommendationsAction(
  _prevState: GenerateRecommendationsState,
  formData: FormData,
): Promise<GenerateRecommendationsState> {
  const rawCourseIds = formData.get("courseIds");
  let courseIds: unknown;
  try {
    courseIds = rawCourseIds ? JSON.parse(String(rawCourseIds)) : [];
  } catch {
    courseIds = String(rawCourseIds ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const parsed = generateRecommendationsRequestSchema.safeParse({ courseIds });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const service = await createRecommendationService();
    const recommendations = await service.generateForUser(user.id, parsed.data.courseIds);
    revalidatePath("/recommendations");
    return { recommendations };
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to generate recommendations." };
  }
}
