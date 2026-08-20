"use server";

import { revalidatePath } from "next/cache";
import { isDomainError } from "@offer-ai/domain";
import { requireUser } from "@/lib/auth";
import { createAdviserService } from "@/lib/services/adviser";

export type ExplainEligibilityActionState = {
  error?: string;
  explanation?: string;
  provenance?: {
    provider: string;
    model: string;
    promptVersion: string;
    latencyMs: number | null;
    inputHash: string | null;
    correlationId: string | null;
  };
};

export async function explainEligibilityAction(
  _prevState: ExplainEligibilityActionState,
  formData: FormData,
): Promise<ExplainEligibilityActionState> {
  const courseId = String(formData.get("courseId") ?? "").trim();
  const correlationId = String(formData.get("correlationId") ?? "").trim() || null;
  const structuredRaw = String(formData.get("structured") ?? "false");
  const structured = structuredRaw === "true" || structuredRaw === "1";

  if (!courseId) {
    return { error: "courseId is required." };
  }

  try {
    const user = await requireUser();
    const service = await createAdviserService();
    const result = await service.explainEligibilityForUser(
      user.id,
      courseId,
      correlationId,
      structured,
    );
    revalidatePath("/adviser");
    return {
      explanation: result.explanation,
      provenance: result.provenance as ExplainEligibilityActionState["provenance"],
    };
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    return {
      error: error instanceof Error ? error.message : "Unable to generate explanation.",
    };
  }
}

export async function explainEligibilityStructuredAction(
  _prevState: ExplainEligibilityActionState,
  formData: FormData,
): Promise<ExplainEligibilityActionState> {
  const withStructured = new FormData();
  for (const [k, v] of formData.entries()) withStructured.set(k, v);
  withStructured.set("structured", "true");
  return explainEligibilityAction(_prevState, withStructured);
}
