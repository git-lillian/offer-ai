"use server";

import { revalidatePath } from "next/cache";
import { saveOpportunitySchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { requireUser } from "@/lib/auth";
import { createOpportunityService } from "@/lib/services/opportunity";

export type SaveOpportunityActionState = {
  error?: string;
  ok?: boolean;
};

export async function saveOpportunityAction(input: {
  opportunityId: string;
}): Promise<SaveOpportunityActionState> {
  const parsed = saveOpportunitySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const service = await createOpportunityService();
    await service.saveForUser(user.id, parsed.data.opportunityId);
    revalidatePath("/opportunities");
    revalidatePath(`/opportunities/${parsed.data.opportunityId}`);
    revalidatePath("/experiences");
    return { ok: true };
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to save opportunity." };
  }
}

export async function unsaveOpportunityAction(input: {
  opportunityId: string;
}): Promise<SaveOpportunityActionState> {
  const parsed = saveOpportunitySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const service = await createOpportunityService();
    await service.unsaveForUser(user.id, parsed.data.opportunityId);
    revalidatePath("/opportunities");
    revalidatePath(`/opportunities/${parsed.data.opportunityId}`);
    revalidatePath("/experiences");
    return { ok: true };
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to remove saved opportunity." };
  }
}

// FormData variants for progressive enhancement / useActionState
export async function saveOpportunityFormAction(
  _prevState: SaveOpportunityActionState,
  formData: FormData,
): Promise<SaveOpportunityActionState> {
  return saveOpportunityAction({ opportunityId: String(formData.get("opportunityId") ?? "") });
}

export async function unsaveOpportunityFormAction(
  _prevState: SaveOpportunityActionState,
  formData: FormData,
): Promise<SaveOpportunityActionState> {
  return unsaveOpportunityAction({ opportunityId: String(formData.get("opportunityId") ?? "") });
}
