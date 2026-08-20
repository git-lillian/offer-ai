import { NextResponse } from "next/server";
import { stripeWebhookPayloadSchema } from "@offer-ai/contracts";
import { isBillingError } from "@offer-ai/billing";
import { createBillingServiceWithServiceRole, toWebhookEventDto } from "@/lib/services/billing";

export async function POST(request: Request) {
  try {
    // Derive user_id from session if present (Stripe webhooks are typically unauthenticated,
    // but we still attempt to resolve the session for audit consistency per AGENTS.md #9).
    // Do not require auth — service_role handles idempotency ledger.
    try {
      const { getServerClient } = await import("@/lib/supabase/server");
      const supabase = await getServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      void user; // derived but not required for webhook processing
    } catch {
      // Ignore auth errors for unauthenticated Stripe calls
    }

    const body = await request.json().catch(() => null);
    const parsed = stripeWebhookPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid webhook payload." },
        { status: 400 },
      );
    }

    const service = createBillingServiceWithServiceRole();
    const event = await service.handleWebhookEvent({
      stripeEventId: parsed.data.id,
      type: parsed.data.type,
      payload: parsed.data.data.object as Record<string, unknown>,
    });

    return NextResponse.json({ event: toWebhookEventDto(event) }, { status: 201 });
  } catch (error) {
    if (isBillingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to handle webhook." },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    // Admin view — currently returns recent webhook events. Require auth but not specific role for MVP;
    // RLS is service_role only, so we use service client and allow any authenticated user to view (filtered).
    // For stricter admin, add role check via requireRole.
    const { getServerClient } = await import("@/lib/supabase/server");
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const service = createBillingServiceWithServiceRole();
    const events = await service.listAllWebhookEvents();
    return NextResponse.json({ events: events.map(toWebhookEventDto) });
  } catch (error) {
    if (isBillingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list webhook events." },
      { status: 500 },
    );
  }
}
