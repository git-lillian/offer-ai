import { NextResponse } from "next/server";
import { approveVersionSchema } from "@offer-ai/contracts";
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
    const merged = { artifactId, ...(body ?? {}) };
    const parsed = approveVersionSchema.safeParse(merged);

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
    const version = await service.approveVersionForUser(user.id, artifactId, parsed.data.versionId);

    return NextResponse.json({ version: toVersionDto(version) });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to approve version." },
      { status: 500 },
    );
  }
}
