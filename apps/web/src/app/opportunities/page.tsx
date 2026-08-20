import Link from "next/link";
import { listOpportunitiesSchema } from "@offer-ai/contracts";
import { getServerClient } from "@/lib/supabase/server";
import { OpportunityRepository, StudentOpportunityRepository, StudentProfileRepository } from "@offer-ai/database";
import { Navbar } from "@/components/navbar";
import { Pagination } from "@/components/catalogue/pagination";
import { OpportunityCard } from "@/components/experience/opportunity-card";
import { getOptionalUser } from "@/lib/auth";

export const metadata = {
  title: "Opportunities | Offer.ai",
};

const PAGE_SIZE = 12;

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const countryRaw = first(raw.country) ?? first(raw.locationCountryCode);
  const parsed = listOpportunitiesSchema.safeParse({
    query: first(raw.query),
    opportunityType: first(raw.type) ?? first(raw.opportunityType) ?? first(raw.opportunity_type),
    locationCountryCode: countryRaw ? countryRaw.toUpperCase() : undefined,
    isRemote: first(raw.remote) ?? first(raw.isRemote),
    providerName: first(raw.provider) ?? first(raw.providerName),
    page: Number(first(raw.page) ?? "1"),
    pageSize: PAGE_SIZE,
  });

  const params = parsed.success ? parsed.data : { page: 1, pageSize: PAGE_SIZE };
  const supabase = await getServerClient();
  const repo = new OpportunityRepository(supabase);
  const { opportunities, total } = await repo.list({
    query: params.query,
    opportunityType: params.opportunityType,
    locationCountryCode: params.locationCountryCode,
    isRemote: params.isRemote,
    providerName: params.providerName,
    page: params.page,
    pageSize: PAGE_SIZE,
  });

  // Saved state for authenticated user
  const user = await getOptionalUser();
  let savedIds = new Set<string>();
  if (user) {
    try {
      const profileRepo = new StudentProfileRepository(supabase);
      const profile = await profileRepo.findByUserId(user.id);
      if (profile) {
        const savedRepo = new StudentOpportunityRepository(supabase);
        const saved = await savedRepo.listByStudent(profile.id, "saved");
        savedIds = new Set(saved.map((s) => s.opportunityId));
      }
    } catch {
      savedIds = new Set<string>();
    }
  }

  const baseHref = buildBaseHref(params);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-6xl space-y-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Experience builder</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">Opportunities</h1>
            <p className="mt-2 text-slate-600">
              Browse internships, volunteering, courses, competitions and research placements to strengthen your application. Save opportunities you care about.
            </p>
          </div>

          <form method="get" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Search</span>
                <input
                  name="query"
                  defaultValue={params.query ?? ""}
                  placeholder="Title or description"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Type</span>
                <select
                  name="type"
                  defaultValue={params.opportunityType ?? ""}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Any type</option>
                  <option value="internship">Internship</option>
                  <option value="volunteering">Volunteering</option>
                  <option value="course">Course</option>
                  <option value="competition">Competition</option>
                  <option value="research">Research</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Country (ISO)</span>
                <input
                  name="country"
                  defaultValue={params.locationCountryCode ?? ""}
                  placeholder="e.g. GB"
                  maxLength={2}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Remote</span>
                <select
                  name="remote"
                  defaultValue={params.isRemote === undefined ? "" : String(params.isRemote)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Any</option>
                  <option value="true">Remote only</option>
                  <option value="false">On-site only</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Provider</span>
                <input
                  name="provider"
                  defaultValue={params.providerName ?? ""}
                  placeholder="Provider name"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Search
                </button>
              </div>
            </div>
            <div className="mt-3 flex gap-3 text-xs">
              <Link href="/opportunities" className="font-medium text-slate-600 hover:text-slate-900">
                Clear filters
              </Link>
              <span className="text-slate-400">·</span>
              <Link href="/experiences" className="font-medium text-blue-600 hover:text-blue-700">
                Gap analysis →
              </Link>
            </div>
          </form>

          {opportunities.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
              <p className="font-semibold text-slate-900">No opportunities found</p>
              <p className="mt-2 text-sm text-slate-600">Try adjusting your filters or search terms.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Showing {opportunities.length} of {total} opportunities · Page {params.page}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {opportunities.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={{
                      id: opp.id,
                      title: opp.title,
                      providerName: opp.providerName,
                      opportunityType: opp.opportunityType,
                      locationCountryCode: opp.locationCountryCode,
                      isRemote: opp.isRemote,
                      durationMonths: opp.durationMonths,
                      description: opp.description,
                      url: opp.url,
                      createdAt: opp.createdAt.toISOString(),
                    }}
                    isSaved={savedIds.has(opp.id)}
                  />
                ))}
              </div>
            </>
          )}

          <Pagination page={params.page} pageSize={PAGE_SIZE} total={total} href={baseHref} />
        </section>
      </main>
    </>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildBaseHref(params: {
  query?: string;
  opportunityType?: string;
  locationCountryCode?: string;
  isRemote?: boolean;
  providerName?: string;
}): string {
  const sp = new URLSearchParams();
  if (params.query) sp.set("query", params.query);
  if (params.opportunityType) sp.set("type", params.opportunityType);
  if (params.locationCountryCode) sp.set("country", params.locationCountryCode);
  if (params.isRemote !== undefined) sp.set("remote", String(params.isRemote));
  if (params.providerName) sp.set("provider", params.providerName);
  const qs = sp.toString();
  return qs ? `/opportunities?${qs}` : "/opportunities";
}
