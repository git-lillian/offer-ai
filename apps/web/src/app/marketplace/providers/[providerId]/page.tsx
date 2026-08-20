import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getOptionalUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { ListingCard } from "@/components/marketplace/listing-card";
import { CreateListingForm } from "@/components/marketplace/create-listing-form";
import { createMarketplaceService } from "@/lib/services/marketplace";
import type { ServiceListing } from "@offer-ai/domain";

export const metadata = {
  title: "Provider | Offer.ai",
};

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;

  const supabase = await getServerClient();
  void supabase;

  const marketplace = await createMarketplaceService();

  let provider;
  try {
    provider = await marketplace.getProviderById(providerId);
  } catch {
    notFound();
  }

  let listings: ServiceListing[] = [];
  let error: string | null = null;
  try {
    listings = await marketplace.listListingsByProvider(providerId);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load listings.";
  }

  const user = await getOptionalUser();
  const isOwner = user ? provider.userId === user.id : false;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-6xl space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link href="/marketplace" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                ← Marketplace
              </Link>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">{provider.displayName}</h1>
              <p className="mt-2 max-w-2xl text-slate-600">{provider.bio || "No bio provided."}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    provider.verificationStatus === "verified"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : provider.verificationStatus === "rejected"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {provider.verificationStatus}
                </span>
                {provider.specialisms.map((s) => (
                  <span key={s} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                {provider.countryScope.length > 0 ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                    Countries: {provider.countryScope.join(", ")}
                  </span>
                ) : null}
                {provider.languageScope.length > 0 ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                    Languages: {provider.languageScope.join(", ")}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Provider {provider.id.slice(0, 8)} · Created {new Date(provider.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {isOwner ? (
                <span className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                  You own this provider profile
                </span>
              ) : null}
              <Link href="/marketplace/bookings" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                My bookings →
              </Link>
            </div>
          </div>

          {isOwner ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Manage listings</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Create new services for students to discover. Students will book via the listing page.
                </p>
                <div className="mt-4">
                  <CreateListingForm providerId={provider.id} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
                <h3 className="font-semibold text-slate-900">Tips for good listings</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Be specific about deliverables (e.g. “Full PS review + inline comments + 30-min call”).</li>
                  <li>Set a realistic turnaround (1–90 days, validated).</li>
                  <li>Use a clear title (≤ 200 chars) and describe revisions and scope.</li>
                  <li>Price in ISO 4217 currency (GBP, USD, EUR…). Billing subscriptions are separate.</li>
                </ul>
              </div>
            </div>
          ) : null}

          <div>
            <h2 className="text-lg font-bold text-slate-900">Listings {listings.length > 0 ? `· ${listings.length}` : ""}</h2>
            {error ? (
              <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {listings.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <p className="font-semibold text-slate-900">No listings yet</p>
                <p className="mt-2 text-sm text-slate-600">
                  {isOwner
                    ? "Create your first listing above — it becomes discoverable once active."
                    : "This provider has not published any services yet."}
                </p>
              </div>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {listings.map((listing) => (
                  <li key={listing.id}>
                    <ListingCard listing={listing} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
