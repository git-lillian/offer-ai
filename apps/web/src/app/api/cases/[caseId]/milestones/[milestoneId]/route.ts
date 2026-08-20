import { NextResponse } from "next/server";
import { updateMilestoneSchema } from "@offer-ai/contracts";
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string; milestoneId: string }> },
) {
  try {
    const { caseId, milestoneId } = await params;
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const candidate = {
      milestoneId,
      ...(body ?? {}),
    };

    const parsed = updateMilestoneSchema.safeParse(candidate);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    if (parsed.data.milestoneId !== milestoneId) {
      return NextResponse.json({ error: "milestoneId mismatch." }, { status: 400 });
    }

    const service = new ApplicationOsService(supabase);
    const updated = await service.updateMilestone(caseId, milestoneId, user.id, {
      title: parsed.data.title,
      dueAt: parsed.data.dueAt ?? undefined,
      status: parsed.data.status,
      sortOrder: parsed.data.sortOrder,
    });

    return NextResponse.json({ milestone: toMilestoneDto(updated) });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update milestone." },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string; milestoneId: string }> },
) {
  try {
    const { caseId, milestoneId } = await params;
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const service = new ApplicationOsService(supabase);
    const milestones = await service.listMilestones(caseId, user.id);
    const milestone = milestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
    }
    return NextResponse.json({ milestone: toMilestoneDto(milestone) });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch milestone." },
      { status: 500 },
    );
  }
}
