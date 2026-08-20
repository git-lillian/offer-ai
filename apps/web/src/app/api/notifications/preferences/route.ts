import { NextResponse } from "next/server";
import {
  updateNotificationPreferenceSchema,
  createNotificationPreferenceSchema,
} from "@offer-ai/contracts";
import { isNotificationError } from "@offer-ai/notifications";
import { getServerClient } from "@/lib/supabase/server";
import {
  createNotificationService,
  toPreferenceDto,
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
    const preference = await service.getPreferencesForUser(user.id);
    if (!preference) {
      // Return defaults without persisting, or ensure persisted?
      // For API, return null with hint that defaults apply, but also create default for convenience.
      // We'll ensure persisted to simplify.
      const ensured = await service.ensurePreferencesForUser(user.id);
      return NextResponse.json({ preference: toPreferenceDto(ensured) });
    }
    return NextResponse.json({ preference: toPreferenceDto(preference) });
  } catch (error) {
    if (isNotificationError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to get preferences." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    // Validate with update schema (partial) — also accept create schema shape for full replacement
    let parsed = updateNotificationPreferenceSchema.safeParse(body);
    if (!parsed.success) {
      // Try create shape as fallback (allows same fields)
      const alt = createNotificationPreferenceSchema.safeParse(body);
      if (!alt.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid input." },
          { status: 400 },
        );
      }
      // Map create shape to update shape (ignore userId)
      parsed = updateNotificationPreferenceSchema.safeParse({
        emailEnabled: alt.data.emailEnabled,
        pushEnabled: alt.data.pushEnabled,
        deadlineReminderDays: alt.data.deadlineReminderDays,
      });
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid input." },
          { status: 400 },
        );
      }
    }

    const service = await createNotificationService();
    const preference = await service.upsertPreferencesForUser(user.id, parsed.data);
    return NextResponse.json({ preference: toPreferenceDto(preference) });
  } catch (error) {
    if (isNotificationError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update preferences." },
      { status: 500 },
    );
  }
}
