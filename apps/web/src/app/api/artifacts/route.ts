import { NextResponse } from "next/server";
import { createArtifactSchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";
import { ArtifactApplicationService } from "@/lib/services/artifact";

function toDto(artifact: import("@offer-ai/domain").Artifact) {
  return {
    id: artifact.id,
    studentId: artifact.studentId,
    caseId: artifact.caseId,
    artifactType: artifact.artifactType,
    title: artifact.title,
    latestVersionId: artifact.latestVersionId,
    approvalState: artifact.approvalState,
    createdAt: artifact.createdAt.toISOString(),
    updatedAt: artifact.updatedAt.toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = createArtifactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const service = new ArtifactApplicationService(supabase);
    const artifact = await service.createForUser(user.id, {
      artifactType: parsed.data.artifactType,
      title: parsed.data.title,
      caseId: parsed.data.caseId ?? null,
    });

    return NextResponse.json({ artifact: toDto(artifact) }, { status: 201 });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create artifact." },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const service = new ArtifactApplicationService(supabase);
    const artifacts = await service.listForUser(user.id);
    return NextResponse.json({ artifacts: artifacts.map(toDto) });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list artifacts." },
      { status: 500 },
    );
  }
}
