import { NextResponse } from "next/server";
import { createMilestoneSchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";
import { ApplicationOsService } from "@/lib/services/application-os";
import type { ApplicationMilestone } from "@offer-ai/domain";

function toMilestoneDto(m: ApplicationMilestone) {
  return {
    id: m.id,
    caseId: m.caseId,
    title: m.title,
    dueAt: m.dueAt ? m.dueAt.toISOString() : null,
    status: m.status,
    sortOrder: m.sortOrder,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await params;
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const service = new ApplicationOsService(supabase);
    const milestones = await service.listMilestones(caseId, user.id);
    return NextResponse.json({ milestones: milestones.map(toMilestoneDto) });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list milestones." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await params;
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const candidate = {
      ...(body ?? {}),
      caseId,
    };

    const parsed = createMilestoneSchema.safeParse(candidate);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    if (parsed.data.caseId !== caseId) {
      return NextResponse.json({ error: "caseId mismatch." }, { status: 400 });
    }

    const service = new ApplicationOsService(supabase);
    const milestone = await service.createMilestone(caseId, user.id, {
      title: parsed.data.title,
      dueAt: parsed.data.dueAt ?? null,
      status: parsed.data.status,
      sortOrder: parsed.data.sortOrder,
    });

    return NextResponse.json({ milestone: toMilestoneDto(milestone) }, { status: 201 });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create milestone." },
      { status: 500 },
    );
  }
}
