import { NextResponse } from "next/server";
import { gapAnalysisRequestSchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { StudentProfileRepository } from "@offer-ai/database";
import { getServerClient } from "@/lib/supabase/server";
import { createExperienceGapService } from "@/lib/services/experience-gap";

export async function POST(request: Request) {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const profileRepo = new StudentProfileRepository(supabase);
    const profile = await profileRepo.findByUserId(user.id);
    if (!profile) {
      return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    // Derive studentId from session — never trust studentId from browser
    const candidate = {
      studentId: profile.id,
      courseIds: body?.courseIds,
    };

    const parsed = gapAnalysisRequestSchema.safeParse(candidate);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const service = await createExperienceGapService();
    const result = await service.analyzeForUser(user.id, parsed.data.courseIds);

    return NextResponse.json({
      gaps: result.gaps,
      suggestedOpportunityTypes: result.suggestedOpportunityTypes,
      summary: result.summary,
    });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to run gap analysis." },
      { status: 500 },
    );
  }
}
