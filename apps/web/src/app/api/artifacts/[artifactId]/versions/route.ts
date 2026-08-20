import { NextResponse } from "next/server";
import { createVersionSchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";
import { ArtifactApplicationService } from "@/lib/services/artifact";

function toVersionDto(version: import("@offer-ai/domain").ArtifactVersion) {
  return {
    id: version.id,
    artifactId: version.artifactId,
    versionNumber: version.versionNumber,
    content: version.content,
    creatorUserId: version.creatorUserId,
    origin: version.origin,
    promptVersion: version.promptVersion,
    modelRunId: version.modelRunId,
    evidenceUsed: version.evidenceUsed,
    approvalState: version.approvalState,
    createdAt: version.createdAt.toISOString(),
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ artifactId: string }> },
) {
  try {
    const { artifactId } = await params;
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    // Merge URL param with body for validation; body may not contain artifactId
    const merged = { artifactId, ...(body ?? {}) };
    const parsed = createVersionSchema.safeParse(merged);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    if (parsed.data.artifactId !== artifactId) {
      return NextResponse.json({ error: "artifactId mismatch." }, { status: 400 });
    }

    const service = new ArtifactApplicationService(supabase);
    const version = await service.createVersionForUser(user.id, artifactId, {
      content: parsed.data.content,
      origin: parsed.data.origin,
      promptVersion: parsed.data.promptVersion ?? null,
      modelRunId: parsed.data.modelRunId ?? null,
      evidenceUsed: parsed.data.evidenceUsed,
    });

    return NextResponse.json({ version: toVersionDto(version) }, { status: 201 });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create version." },
      { status: 500 },
    );
  }
}
