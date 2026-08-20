import { NextResponse } from "next/server";
import { isNotificationError } from "@offer-ai/notifications";
import { getServerClient } from "@/lib/supabase/server";
import {
  createNotificationService,
  toNotificationDto,
} from "@/lib/services/notification";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid notification id." }, { status: 400 });
    }

    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const service = await createNotificationService();
    const notification = await service.markSentForUser(user.id, id);
    return NextResponse.json({ notification: toNotificationDto(notification) });
  } catch (error) {
    if (isNotificationError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to mark sent." },
      { status: 500 },
    );
  }
}

// Also support POST for form compatibility
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return PATCH(request, ctx);
}
