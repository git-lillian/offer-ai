import { NextResponse } from "next/server";
import { saveOpportunitySchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";
import { createOpportunityService } from "@/lib/services/opportunity";

function toStudentOpportunityDto(link: import("@offer-ai/domain").StudentOpportunity) {
  return {
    id: link.id,
    studentId: link.studentId,
    opportunityId: link.opportunityId,
    status: link.status,
    appliedAt: link.appliedAt ? link.appliedAt.toISOString() : null,
    createdAt: link.createdAt.toISOString(),
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    // Accept either { opportunityId } or empty body with id from URL
    const candidate = {
      opportunityId: (body && typeof body.opportunityId === "string" ? body.opportunityId : undefined) ?? id,
    };

    const parsed = saveOpportunitySchema.safeParse(candidate);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    if (parsed.data.opportunityId !== id) {
      return NextResponse.json({ error: "opportunityId mismatch." }, { status: 400 });
    }

    const service = await createOpportunityService();
    const saved = await service.saveForUser(user.id, parsed.data.opportunityId);

    return NextResponse.json({ studentOpportunity: toStudentOpportunityDto(saved) }, { status: 201 });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save opportunity." },
      { status: 500 },
    );
  }
}
