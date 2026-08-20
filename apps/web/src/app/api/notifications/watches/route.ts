import { NextResponse } from "next/server";
import { createDeadlineWatchSchema } from "@offer-ai/contracts";
import { isNotificationError } from "@offer-ai/notifications";
import { getServerClient } from "@/lib/supabase/server";
import {
  createNotificationService,
  toWatchDto,
} from "@/lib/services/notification";

export async function GET() {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const service = await createNotificationService();
    const watches = await service.listWatchesForUser(user.id);
    return NextResponse.json({ watches: watches.map(toWatchDto) });
  } catch (error) {
    if (isNotificationError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list watches." },
      { status: 500 },
    );
  }
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
    // Derive studentId from session, never trust browser — strip studentId if present
    const candidate = {
      courseIntakeId: body?.courseIntakeId,
      watchType: body?.watchType,
    };
    const parsed = createDeadlineWatchSchema.safeParse(candidate);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const service = await createNotificationService();
    const watch = await service.createWatchForUser(user.id, {
      courseIntakeId: parsed.data.courseIntakeId,
      watchType: parsed.data.watchType,
    });

    return NextResponse.json({ watch: toWatchDto(watch) }, { status: 201 });
  } catch (error) {
    if (isNotificationError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create watch." },
      { status: 500 },
    );
  }
}
