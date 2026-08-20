import { NextResponse } from "next/server";
import { generateRecommendationsRequestSchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";
import { createRecommendationService } from "@/lib/services/recommendation";

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
    const parsed = generateRecommendationsRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    // Derive student_id from session, never trust studentId from body for authorization.
    const courseIds = parsed.data.courseIds;

    const service = await createRecommendationService();
    const recommendations = await service.generateForUser(user.id, courseIds);

    return NextResponse.json({ recommendations });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate recommendations." },
      { status: 500 },
    );
  }
}
