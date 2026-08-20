import { NextResponse } from "next/server";
import { createServiceOrderSchema, createOrderWithRateSchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";
import { createMarketplaceService, toOrderDto } from "@/lib/services/marketplace";

export async function GET() {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const service = await createMarketplaceService();
    const orders = await service.listOrdersForStudent(user.id);

    return NextResponse.json({
      orders: orders.map(toOrderDto),
    });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list orders." },
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

    // Support two creation styles: explicit platformFee or rate-based
    const hasRate = body !== null && typeof body === "object" && "rate" in body;

    if (hasRate) {
      const parsed = createOrderWithRateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid input." },
          { status: 400 },
        );
      }

      const service = await createMarketplaceService();
      const order = await service.createOrderWithRateForUser(user.id, parsed.data);
      return NextResponse.json({ order: toOrderDto(order) }, { status: 201 });
    }

    const parsed = createServiceOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const service = await createMarketplaceService();
    const order = await service.createOrderForUser(user.id, {
      bookingId: parsed.data.bookingId,
      amount: parsed.data.amount,
      platformFee: parsed.data.platformFee,
      currencyCode: parsed.data.currencyCode,
    });

    return NextResponse.json({ order: toOrderDto(order) }, { status: 201 });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create order." },
      { status: 500 },
    );
  }
}
