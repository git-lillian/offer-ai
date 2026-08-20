import { NextResponse } from "next/server";
import { createBookingSchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";
import { createMarketplaceService, toBookingDto } from "@/lib/services/marketplace";

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
    const bookings = await service.listBookingsForStudent(user.id);

    return NextResponse.json({
      bookings: bookings.map(toBookingDto),
    });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list bookings." },
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
    const parsed = createBookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const service = await createMarketplaceService();
    const booking = await service.createBookingForUser(user.id, {
      serviceListingId: parsed.data.serviceListingId,
      providerId: parsed.data.providerId,
      scheduledAt: parsed.data.scheduledAt ?? null,
    });

    return NextResponse.json({ booking: toBookingDto(booking) }, { status: 201 });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create booking." },
      { status: 500 },
    );
  }
}
