import { NextResponse } from "next/server";
import { createSubscriptionSchema } from "@offer-ai/contracts";
import { isBillingError } from "@offer-ai/billing";
import { getServerClient } from "@/lib/supabase/server";
import { createBillingService, createBillingServiceWithServiceRole, toSubscriptionDto } from "@/lib/services/billing";

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
    const parsed = createSubscriptionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const service = createBillingServiceWithServiceRole();
    const subscription = await service.createSubscriptionForUser(user.id, {
      customerId: parsed.data.customerId,
      planCode: parsed.data.planCode,
      stripeSubscriptionId: parsed.data.stripeSubscriptionId ?? null,
      status: parsed.data.status,
      currentPeriodEnd: parsed.data.currentPeriodEnd ?? null,
    });

    return NextResponse.json({ subscription: toSubscriptionDto(subscription) }, { status: 201 });
  } catch (error) {
    if (isBillingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create subscription." },
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

    const service = await createBillingService();
    const subscriptions = await service.listSubscriptionsForUser(user.id);
    return NextResponse.json({ subscriptions: subscriptions.map(toSubscriptionDto) });
  } catch (error) {
    if (isBillingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list subscriptions." },
      { status: 500 },
    );
  }
}
