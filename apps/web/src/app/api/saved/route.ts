import { NextResponse } from "next/server";
import { saveCourseSchema, unsaveCourseSchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";
import { createSavedCourseService } from "@/lib/services/saved-course";

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
    const parsed = saveCourseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const service = await createSavedCourseService();
    const saved = await service.saveForUser(user.id, parsed.data.courseId);
    return NextResponse.json(
      { savedCourse: { id: saved.id, studentId: saved.studentId, courseId: saved.courseId, createdAt: saved.createdAt.toISOString() } },
      { status: 201 },
    );
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save course." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    // Accept courseId from JSON body or query param for flexibility.
    let courseId: string | null = null;
    const url = new URL(request.url);
    const queryCourseId = url.searchParams.get("courseId");
    if (queryCourseId) {
      courseId = queryCourseId;
    } else {
      const body = await request.json().catch(() => null);
      if (body && typeof body.courseId === "string") courseId = body.courseId;
    }

    const parsed = unsaveCourseSchema.safeParse({ courseId });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const service = await createSavedCourseService();
    await service.unsaveForUser(user.id, parsed.data.courseId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to remove saved course." },
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

    const service = await createSavedCourseService();
    const saved = await service.listForUser(user.id);
    return NextResponse.json({
      savedCourses: saved.map(({ saved: row }) => ({
        id: row.id,
        studentId: row.studentId,
        courseId: row.courseId,
        createdAt: row.createdAt.toISOString(),
      })),
      courseIds: saved.map(({ saved: row }) => row.courseId),
    });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list saved courses." },
      { status: 500 },
    );
  }
}
