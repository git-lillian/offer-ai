import { NextResponse } from "next/server";
import { createEntitlementSchema } from "@offer-ai/contracts";
import { isBillingError } from "@offer-ai/billing";
import { getServerClient } from "@/lib/supabase/server";
import { createBillingService, createBillingServiceWithServiceRole, toEntitlementDto } from "@/lib/services/billing";

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
    const parsed = createEntitlementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const service = createBillingServiceWithServiceRole();
    const entitlement = await service.createEntitlementForUser(user.id, {
      customerId: parsed.data.customerId,
      featureCode: parsed.data.featureCode,
      expiresAt: parsed.data.expiresAt ?? null,
    });

    return NextResponse.json({ entitlement: toEntitlementDto(entitlement) }, { status: 201 });
  } catch (error) {
    if (isBillingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create entitlement." },
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
    const entitlements = await service.listEntitlementsForUser(user.id);
    return NextResponse.json({ entitlements: entitlements.map(toEntitlementDto) });
  } catch (error) {
    if (isBillingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list entitlements." },
      { status: 500 },
    );
  }
}
