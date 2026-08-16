"use server";

import { revalidatePath } from "next/cache";
import { transitionApplicationCaseSchema } from "@offer-ai/contracts";
import { ApplicationCaseRepository, AuditLogRepository } from "@offer-ai/database";
import { ApplicationCaseTransitionService } from "@offer-ai/domain";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";

export type TransitionStatusActionState = {
  error?: string;
};

export async function transitionStatusAction(
  _prevState: TransitionStatusActionState,
  formData: FormData,
): Promise<TransitionStatusActionState> {
  const parsed = transitionApplicationCaseSchema.safeParse({
    caseId: formData.get("caseId"),
    toStatus: formData.get("toStatus"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const supabase = await getServerClient();

    const caseRepo = new ApplicationCaseRepository(supabase);
    const existing = await caseRepo.findById(parsed.data.caseId);
    if (!existing || existing.studentId !== user.id) {
      return { error: "Application case not found." };
    }

    const service = new ApplicationCaseTransitionService(caseRepo);

    await service.transitionStatus(
      parsed.data.caseId,
      parsed.data.toStatus,
      user.id,
      parsed.data.message,
    );

    await new AuditLogRepository(supabase).append({
      actorUserId: user.id,
      action: "application_status_changed",
      resourceType: "application_case",
      resourceId: parsed.data.caseId,
      correlationId: null,
      metadata: { toStatus: parsed.data.toStatus },
    });

    revalidatePath(`/cases/${parsed.data.caseId}`);
    return {};
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to update the status.",
    };
  }
}
