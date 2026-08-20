import { NextResponse } from "next/server";
import { createServiceListingSchema, listServiceListingsSchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";
import { createMarketplaceService, toListingDto } from "@/lib/services/marketplace";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const raw = {
      query: url.searchParams.get("query") ?? undefined,
      serviceType: url.searchParams.get("serviceType") ?? url.searchParams.get("type") ?? undefined,
      providerId: url.searchParams.get("providerId") ?? undefined,
      isActive: url.searchParams.get("isActive") ? url.searchParams.get("isActive") === "true" : undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    };

    const parsed = listServiceListingsSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid query." },
        { status: 400 },
      );
    }

    const service = await createMarketplaceService();
    const { listings, total } = await service.listListings({
      query: parsed.data.query,
      serviceType: parsed.data.serviceType,
      providerId: parsed.data.providerId,
      isActive: parsed.data.isActive,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    return NextResponse.json({
      listings: listings.map(toListingDto),
      total,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list listings." },
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
    const parsed = createServiceListingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const service = await createMarketplaceService();
    const listing = await service.createListingForUser(user.id, parsed.data);

    return NextResponse.json({ listing: toListingDto(listing) }, { status: 201 });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create listing." },
      { status: 500 },
    );
  }
}
