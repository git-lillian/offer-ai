import { NextResponse } from "next/server";
import {
  createNotificationSchema,
  listNotificationsSchema,
} from "@offer-ai/contracts";
import { isNotificationError } from "@offer-ai/notifications";
import { getServerClient } from "@/lib/supabase/server";
import {
  createNotificationService,
  toNotificationDto,
} from "@/lib/services/notification";

export async function GET(request: Request) {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const url = new URL(request.url);
    const raw = {
      userId: user.id,
      status: url.searchParams.get("status") ?? undefined,
      channel: url.searchParams.get("channel") ?? undefined,
      notificationType: url.searchParams.get("type") ?? url.searchParams.get("notificationType") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    };

    // Use zod at boundary, but also support pagination page
    const parsed = listNotificationsSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid query." },
        { status: 400 },
      );
    }

    const pageParam = url.searchParams.get("page");
    const page = pageParam ? Number(pageParam) : 1;
    if (pageParam && (Number.isNaN(page) || page < 1)) {
      return NextResponse.json({ error: "page must be a positive integer." }, { status: 400 });
    }

    const service = await createNotificationService();
    const { notifications, total } = await service.listNotificationsForUser(user.id, {
      limit: parsed.data.limit,
      page,
      status: parsed.data.status,
      channel: parsed.data.channel,
      notificationType: parsed.data.notificationType,
    });

    return NextResponse.json({
      notifications: notifications.map(toNotificationDto),
      total,
      page,
      limit: parsed.data.limit,
    });
  } catch (error) {
    if (isNotificationError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list notifications." },
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
    // Derive userId from session, never trust browser
    const candidate = {
      ...(body ?? {}),
      userId: user.id,
    };
    const parsed = createNotificationSchema.safeParse(candidate);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const service = await createNotificationService();
    const notification = await service.createNotificationForUser(user.id, {
      channel: parsed.data.channel,
      notificationType: parsed.data.notificationType,
      title: parsed.data.title,
      body: parsed.data.body,
      payload: parsed.data.payload,
      scheduledAt: parsed.data.scheduledAt ?? null,
    });

    return NextResponse.json({ notification: toNotificationDto(notification) }, { status: 201 });
  } catch (error) {
    if (isNotificationError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create notification." },
      { status: 500 },
    );
  }
}
