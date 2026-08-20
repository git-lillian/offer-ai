"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createArtifactSchema,
  createVersionSchema,
  approveVersionSchema,
  rejectVersionSchema,
  createCommentSchema,
} from "@offer-ai/contracts";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { ArtifactApplicationService } from "@/lib/services/artifact";

export type ArtifactActionState = {
  error?: string;
  ok?: boolean;
};

function parseEvidenceUsed(raw: FormDataEntryValue | null): string[] {
  if (raw === null || raw === "") return [];
  try {
    const parsed = JSON.parse(String(raw));
    if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === "string");
  } catch {
    // Fallback: comma separated
    return String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export async function createArtifactAction(
  _prevState: ArtifactActionState,
  formData: FormData,
): Promise<ArtifactActionState> {
  const raw = {
    artifactType: formData.get("artifactType"),
    title: formData.get("title"),
    caseId: formData.get("caseId"),
  };

  // Normalize caseId: empty string -> null -> undefined for optional handling
  const normalizedCaseId = raw.caseId === "" || raw.caseId === null ? null : String(raw.caseId);

  const parsed = createArtifactSchema.safeParse({
    artifactType: raw.artifactType,
    title: raw.title,
    caseId: normalizedCaseId,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const supabase = await getServerClient();
    const service = new ArtifactApplicationService(supabase);
    const artifact = await service.createForUser(user.id, {
      artifactType: parsed.data.artifactType,
      title: parsed.data.title,
      caseId: parsed.data.caseId ?? null,
    });

    revalidatePath("/artifacts");
    redirect(`/artifacts/${artifact.id}`);
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error) {
      throw error;
    }
    return {
      error: error instanceof Error ? error.message : "Unable to create artifact.",
    };
  }
}

export async function createVersionAction(
  _prevState: ArtifactActionState,
  formData: FormData,
): Promise<ArtifactActionState> {
  const raw = {
    artifactId: formData.get("artifactId"),
    content: formData.get("content"),
    origin: formData.get("origin") ?? "human",
    promptVersion: formData.get("promptVersion"),
    modelRunId: formData.get("modelRunId"),
    evidenceUsed: parseEvidenceUsed(formData.get("evidenceUsed")),
  };

  const normalizedPromptVersion =
    raw.promptVersion === "" || raw.promptVersion === null ? null : String(raw.promptVersion);
  const normalizedModelRunId =
    raw.modelRunId === "" || raw.modelRunId === null ? null : String(raw.modelRunId);

  const parsed = createVersionSchema.safeParse({
    artifactId: raw.artifactId,
    content: raw.content,
    origin: raw.origin,
    promptVersion: normalizedPromptVersion,
    modelRunId: normalizedModelRunId,
    evidenceUsed: raw.evidenceUsed,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const supabase = await getServerClient();
    const service = new ArtifactApplicationService(supabase);
    await service.createVersionForUser(user.id, parsed.data.artifactId, {
      content: parsed.data.content,
      origin: parsed.data.origin,
      promptVersion: parsed.data.promptVersion ?? null,
      modelRunId: parsed.data.modelRunId ?? null,
      evidenceUsed: parsed.data.evidenceUsed,
    });

    revalidatePath(`/artifacts/${parsed.data.artifactId}`);
    revalidatePath("/artifacts");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to create version.",
    };
  }
}

export async function approveVersionAction(
  _prevState: ArtifactActionState,
  formData: FormData,
): Promise<ArtifactActionState> {
  const parsed = approveVersionSchema.safeParse({
    artifactId: formData.get("artifactId"),
    versionId: formData.get("versionId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const supabase = await getServerClient();
    const service = new ArtifactApplicationService(supabase);
    await service.approveVersionForUser(user.id, parsed.data.artifactId, parsed.data.versionId);
    revalidatePath(`/artifacts/${parsed.data.artifactId}`);
    revalidatePath("/artifacts");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to approve version.",
    };
  }
}

export async function rejectVersionAction(
  _prevState: ArtifactActionState,
  formData: FormData,
): Promise<ArtifactActionState> {
  const parsed = rejectVersionSchema.safeParse({
    artifactId: formData.get("artifactId"),
    versionId: formData.get("versionId"),
    reason: formData.get("reason") ? String(formData.get("reason")) : undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const supabase = await getServerClient();
    const service = new ArtifactApplicationService(supabase);
    await service.rejectVersionForUser(user.id, parsed.data.artifactId, parsed.data.versionId);
    revalidatePath(`/artifacts/${parsed.data.artifactId}`);
    revalidatePath("/artifacts");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to reject version.",
    };
  }
}

export async function addCommentAction(
  _prevState: ArtifactActionState,
  formData: FormData,
): Promise<ArtifactActionState> {
  const versionNumberRaw = formData.get("versionNumber");
  const parsed = createCommentSchema.safeParse({
    artifactId: formData.get("artifactId"),
    versionNumber: versionNumberRaw ? Number(versionNumberRaw) : undefined,
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const supabase = await getServerClient();
    const service = new ArtifactApplicationService(supabase);
    await service.addCommentForUser(user.id, parsed.data.artifactId, {
      versionNumber: parsed.data.versionNumber,
      body: parsed.data.body,
    });
    revalidatePath(`/artifacts/${parsed.data.artifactId}`);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to add comment.",
    };
  }
}
