import { NextResponse } from "next/server";
import { createBillingCustomerSchema } from "@offer-ai/contracts";
import { isBillingError } from "@offer-ai/billing";
import { getServerClient } from "@/lib/supabase/server";
import { createBillingService, createBillingServiceWithServiceRole, toCustomerDto } from "@/lib/services/billing";

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

    // Derive userId from session; do not trust body userId.
    const candidate = {
      userId: user.id,
      stripeCustomerId: (body as { stripeCustomerId?: string | null } | null)?.stripeCustomerId ?? null,
    };

    const parsed = createBillingCustomerSchema.safeParse(candidate);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const service = createBillingServiceWithServiceRole();
    const customer = await service.createCustomerForUser(user.id, {
      stripeCustomerId: parsed.data.stripeCustomerId ?? null,
    });

    return NextResponse.json({ customer: toCustomerDto(customer) }, { status: 201 });
  } catch (error) {
    if (isBillingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create billing customer." },
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
    const customer = await service.getCustomerForUser(user.id);
    if (!customer) {
      return NextResponse.json({ customer: null });
    }
    return NextResponse.json({ customer: toCustomerDto(customer) });
  } catch (error) {
    if (isBillingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch billing customer." },
      { status: 500 },
    );
  }
}
