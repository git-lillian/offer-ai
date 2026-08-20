import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { Pagination } from "@/components/catalogue/pagination";
import { ProviderCard } from "@/components/marketplace/provider-card";
import { ListingCard } from "@/components/marketplace/listing-card";
import { createMarketplaceService } from "@/lib/services/marketplace";
import type { ServiceType, ProviderProfile, ServiceListing } from "@offer-ai/domain";

export const metadata = {
  title: "Marketplace | Offer.ai",
};

const PAGE_SIZE = 12;

const SERVICE_TYPES: { value: string; label: string }[] = [
  { value: "", label: "Any service" },
  { value: "personal_statement", label: "Personal statement" },
  { value: "strategy", label: "Strategy" },
  { value: "mentoring", label: "Mentoring" },
  { value: "cv_review", label: "CV review" },
  { value: "interview_prep", label: "Interview prep" },
  { value: "other", label: "Other" },
];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const query = first(raw.query);
  const serviceTypeRaw = first(raw.type) ?? first(raw.serviceType);
  const page = Number(first(raw.page) ?? "1");
  const isVerified = first(raw.verified) === "true";

  const serviceType = serviceTypeRaw && isServiceType(serviceTypeRaw) ? serviceTypeRaw : undefined;

  const supabase = await getServerClient();
  const marketplace = await createMarketplaceService();

  const user = await getOptionalUser();

  let providers: ProviderProfile[] = [];
  let providerTotal = 0;
  let providerError: string | null = null;
  try {
    const result = await marketplace.listProviders({
      query,
      page: isNaN(page) ? 1 : page,
      pageSize: PAGE_SIZE,
      onlyVerified: isVerified || undefined,
    });
    providers = result.providers;
    providerTotal = result.total;
  } catch (e) {
    // If RLS hides providers for anon, show empty and message
    providerError = e instanceof Error ? e.message : "Unable to load providers.";
  }

  let listings: ServiceListing[] = [];
  let listingTotal = 0;
  let listingError: string | null = null;
  let providerMap = new Map<string, string>();
  try {
    const result = await marketplace.listListings({
      query,
      serviceType,
      isActive: true,
      page: isNaN(page) ? 1 : page,
      pageSize: PAGE_SIZE,
    });
    listings = result.listings;
    listingTotal = result.total;

    if (listings.length > 0) {
      const ids = [...new Set(listings.map((l) => l.providerId))];
      // Fetch provider names for listing cards (best effort)
      try {
        const { data } = await supabase.from("provider_profiles").select("id, display_name").in("id", ids);
        for (const row of (data ?? []) as { id: string; display_name: string }[]) {
          providerMap.set(row.id, row.display_name);
        }
      } catch {
        providerMap = new Map();
      }
    }
  } catch (e) {
    listingError = e instanceof Error ? e.message : "Unable to load listings.";
  }

  const baseHref = buildBaseHref({ query, serviceType });

  // Check if current user already has provider profile
  let hasProviderProfile = false;
  if (user) {
    try {
      const existing = await marketplace.getProviderForUser(user.id);
      hasProviderProfile = existing !== null;
    } catch {
      hasProviderProfile = false;
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-6xl space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Marketplace</p>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Find expert help</h1>
              <p className="mt-2 max-w-2xl text-slate-600">
                Browse human advisers — personal statement review, application strategy, mentoring, CV and
                interview prep. Offer.ai takes a platform fee; marketplace payments are separate from
                subscriptions.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/marketplace/bookings"
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                My bookings
              </Link>
              {user ? (
                <Link
                  href={hasProviderProfile ? "/marketplace/providers/new" : "/marketplace/providers/new"}
                  className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {hasProviderProfile ? "Provider dashboard" : "Become a provider"}
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Sign in to book →
                </Link>
              )}
            </div>
          </div>

          <form method="get" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Search</span>
                <input
                  name="query"
                  defaultValue={query ?? ""}
                  placeholder="Title, description or provider"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Service type</span>
                <select
                  name="type"
                  defaultValue={serviceType ?? ""}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                >
                  {SERVICE_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end gap-3">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Search
                </button>
                <Link
                  href="/marketplace"
                  className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Clear
                </Link>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Showing providers and active listings. Filter by service type or search by title.
            </p>
          </form>

          {/* Providers */}
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                Providers {providerTotal > 0 ? `· ${providerTotal}` : ""}
              </h2>
              <Link href="/marketplace/providers/new" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                Become a provider →
              </Link>
            </div>

            {providerError ? (
              <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {providerError}
              </div>
            ) : null}

            {!user ? (
              <p className="mt-3 text-sm text-slate-600">
                <Link href="/login" className="font-medium text-blue-600 underline">
                  Sign in
                </Link>{" "}
                to discover verified providers.
              </p>
            ) : null}

            {providers.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <p className="font-semibold text-slate-900">No providers found</p>
                <p className="mt-2 text-sm text-slate-600">Try adjusting your search or be the first to offer services.</p>
                <Link
                  href="/marketplace/providers/new"
                  className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  Create provider profile
                </Link>
              </div>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {providers.map((provider) => (
                  <li key={provider.id}>
                    <ProviderCard provider={provider} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Listings */}
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Listings {listingTotal > 0 ? `· ${listingTotal}` : ""}
            </h2>

            {listingError ? (
              <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {listingError}
              </div>
            ) : null}

            {listings.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
                <p className="font-semibold text-slate-900">No listings found</p>
                <p className="mt-2 text-sm text-slate-600">
                  No active services match your filters. Clear filters or check back later.
                </p>
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  Showing {listings.length} of {listingTotal} · Page {isNaN(page) ? 1 : page}
                </p>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {listings.map((listing) => (
                    <li key={listing.id}>
                      <ListingCard listing={listing} providerName={providerMap.get(listing.providerId)} />
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-6">
              <Pagination
                page={isNaN(page) ? 1 : page}
                pageSize={PAGE_SIZE}
                total={listingTotal}
                href={baseHref}
              />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function isServiceType(value: string): value is ServiceType {
  return (
    value === "personal_statement" ||
    value === "strategy" ||
    value === "mentoring" ||
    value === "cv_review" ||
    value === "interview_prep" ||
    value === "other"
  );
}

function buildBaseHref(params: { query?: string; serviceType?: string }): string {
  const sp = new URLSearchParams();
  if (params.query) sp.set("query", params.query);
  if (params.serviceType) sp.set("type", params.serviceType);
  const qs = sp.toString();
  return qs ? `/marketplace?${qs}` : "/marketplace";
}
