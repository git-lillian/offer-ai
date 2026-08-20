import { NextResponse } from "next/server";
import { explainEligibilityRequestSchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { StudentProfileRepository } from "@offer-ai/database";
import { getServerClient } from "@/lib/supabase/server";
import { createAdviserService } from "@/lib/services/adviser";

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

    const body = (await request.json().catch(() => null)) as {
      courseId?: unknown;
      studentId?: unknown;
      correlationId?: unknown;
    } | null;

    // Derive student_id from session — never trust studentId from the browser.
    // Validate the full contract shape with the derived studentId.
    const candidate = {
      studentId: profile.id,
      courseId: body?.courseId,
      correlationId:
        typeof body?.correlationId === "string" && body.correlationId.length > 0
          ? body.correlationId
          : undefined,
    };

    const parsed = explainEligibilityRequestSchema.safeParse(candidate);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const service = await createAdviserService();
    const result = await service.explainEligibilityForUser(
      user.id,
      parsed.data.courseId,
      parsed.data.correlationId ?? null,
      false,
    );

    return NextResponse.json({
      explanation: result.explanation,
      provenance: result.provenance,
    });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate explanation." },
      { status: 500 },
    );
  }
}
