import { NextResponse } from "next/server";
import { listOpportunitiesSchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";
import { OpportunityRepository } from "@offer-ai/database";

function toDto(opportunity: import("@offer-ai/domain").Opportunity) {
  return {
    id: opportunity.id,
    title: opportunity.title,
    providerName: opportunity.providerName,
    opportunityType: opportunity.opportunityType,
    locationCountryCode: opportunity.locationCountryCode,
    isRemote: opportunity.isRemote,
    durationMonths: opportunity.durationMonths,
    description: opportunity.description,
    url: opportunity.url,
    createdAt: opportunity.createdAt.toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const countryRaw = url.searchParams.get("locationCountryCode") ?? url.searchParams.get("country") ?? undefined;
    const raw = {
      query: url.searchParams.get("query") ?? undefined,
      opportunityType: url.searchParams.get("opportunityType") ?? url.searchParams.get("type") ?? undefined,
      locationCountryCode: countryRaw ? countryRaw.toUpperCase() : undefined,
      isRemote: url.searchParams.get("isRemote") ?? url.searchParams.get("remote") ?? undefined,
      providerName: url.searchParams.get("providerName") ?? url.searchParams.get("provider") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    };

    const parsed = listOpportunitiesSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid query." },
        { status: 400 },
      );
    }

    // Public catalogue — use RLS-enforced client (anon or authenticated)
    const supabase = await getServerClient();
    const repo = new OpportunityRepository(supabase);
    const { opportunities, total } = await repo.list({
      query: parsed.data.query,
      opportunityType: parsed.data.opportunityType,
      locationCountryCode: parsed.data.locationCountryCode,
      isRemote: parsed.data.isRemote,
      providerName: parsed.data.providerName,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    return NextResponse.json({
      opportunities: opportunities.map(toDto),
      total,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list opportunities." },
      { status: 500 },
    );
  }
}
