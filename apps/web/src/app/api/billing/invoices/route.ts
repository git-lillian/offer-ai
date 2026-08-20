import { NextResponse } from "next/server";
import { createInvoiceSchema } from "@offer-ai/contracts";
import { isBillingError } from "@offer-ai/billing";
import { getServerClient } from "@/lib/supabase/server";
import { createBillingService, createBillingServiceWithServiceRole, toInvoiceDto } from "@/lib/services/billing";

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
    const parsed = createInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const service = createBillingServiceWithServiceRole();
    const invoice = await service.createInvoiceForUser(user.id, {
      customerId: parsed.data.customerId,
      stripeInvoiceId: parsed.data.stripeInvoiceId ?? null,
      amountDue: parsed.data.amountDue,
      currencyCode: parsed.data.currencyCode,
      status: parsed.data.status,
    });

    return NextResponse.json({ invoice: toInvoiceDto(invoice) }, { status: 201 });
  } catch (error) {
    if (isBillingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create invoice." },
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
    const invoices = await service.listInvoicesForUser(user.id);
    return NextResponse.json({ invoices: invoices.map(toInvoiceDto) });
  } catch (error) {
    if (isBillingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list invoices." },
      { status: 500 },
    );
  }
}
