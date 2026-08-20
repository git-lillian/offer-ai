import { NextResponse } from "next/server";
import { createCommentSchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";
import { ArtifactApplicationService } from "@/lib/services/artifact";

function toCommentDto(comment: import("@offer-ai/domain").ArtifactComment) {
  return {
    id: comment.id,
    artifactId: comment.artifactId,
    versionNumber: comment.versionNumber,
    authorUserId: comment.authorUserId,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
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
    const parsed = createCommentSchema.safeParse(merged);

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
    const comment = await service.addCommentForUser(user.id, artifactId, {
      versionNumber: parsed.data.versionNumber,
      body: parsed.data.body,
    });

    return NextResponse.json({ comment: toCommentDto(comment) }, { status: 201 });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add comment." },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: Request,
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
    const service = new ArtifactApplicationService(supabase);
    const { comments } = await service.getByIdForUser(user.id, artifactId);
    return NextResponse.json({ comments: comments.map(toCommentDto) });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list comments." },
      { status: 500 },
    );
  }
}
