"use server";

import { revalidatePath } from "next/cache";
import { gapAnalysisRequestSchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { requireUser } from "@/lib/auth";
import { createExperienceGapService } from "@/lib/services/experience-gap";

export type GapAnalysisActionState = {
  error?: string;
  gaps?: unknown;
  summary?: string;
  suggestedOpportunityTypes?: string[];
};

export async function requestGapAnalysisAction(
  _prevState: GapAnalysisActionState,
  formData: FormData,
): Promise<GapAnalysisActionState> {
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

  // Derive studentId from session inside service — validate only courseIds.
  const parsed = gapAnalysisRequestSchema.safeParse({ courseIds });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const service = await createExperienceGapService();
    const result = await service.analyzeForUser(user.id, parsed.data.courseIds);
    revalidatePath("/experiences");
    return {
      gaps: result.gaps,
      summary: result.summary,
      suggestedOpportunityTypes: result.suggestedOpportunityTypes,
    };
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to run gap analysis." };
  }
}

export async function generateGapAnalysisAction(input: {
  courseIds?: string[];
}): Promise<GapAnalysisActionState> {
  const parsed = gapAnalysisRequestSchema.safeParse({ courseIds: input.courseIds });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const service = await createExperienceGapService();
    const result = await service.analyzeForUser(user.id, parsed.data.courseIds);
    revalidatePath("/experiences");
    return {
      gaps: result.gaps,
      summary: result.summary,
      suggestedOpportunityTypes: result.suggestedOpportunityTypes,
    };
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to run gap analysis." };
  }
}
