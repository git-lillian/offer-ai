import Link from "next/link";
import { notFound } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { BookButton } from "@/components/marketplace/book-button";
import { createMarketplaceService } from "@/lib/services/marketplace";

export const metadata = {
  title: "Listing | Offer.ai",
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  personal_statement: "Personal statement",
  strategy: "Strategy",
  mentoring: "Mentoring",
  cv_review: "CV review",
  interview_prep: "Interview prep",
  other: "Other",
};

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;

  const marketplace = await createMarketplaceService();

  let listing;
  let provider;
  try {
    listing = await marketplace.getListingById(listingId);
    provider = await marketplace.getProviderById(listing.providerId);
  } catch {
    notFound();
  }

  const user = await getOptionalUser();
  const isOwner = user ? provider.userId === user.id : false;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-5xl space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Link href="/marketplace" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                ← Marketplace
              </Link>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">{listing.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {SERVICE_TYPE_LABELS[listing.serviceType] ?? listing.serviceType}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${listing.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                >
                  {listing.isActive ? "Active" : "Inactive"}
                </span>
                <span className="text-xs text-slate-500">
                  Turnaround {listing.turnaroundDays} days · {formatPrice(listing.price, listing.currencyCode)}
                </span>
              </div>
            </div>
            <Link
              href={`/marketplace/providers/${provider.id}`}
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm hover:border-blue-300"
            >
              <p className="text-xs uppercase tracking-wide text-slate-400">Provider</p>
              <p className="font-semibold text-slate-900">{provider.displayName}</p>
              <p className="text-xs text-slate-500">{provider.verificationStatus}</p>
              <p className="mt-1 text-xs font-semibold text-blue-600">View provider →</p>
            </Link>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-bold text-slate-900">About this service</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {listing.description || "No description provided."}
                </p>
                <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Price</dt>
                    <dd className="mt-1 text-lg font-bold text-slate-900">
                      {formatPrice(listing.price, listing.currencyCode)}
                    </dd>
                    <dd className="text-xs text-slate-500">{listing.currencyCode} · platform fee separate</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Turnaround</dt>
                    <dd className="mt-1 text-lg font-bold text-slate-900">{listing.turnaroundDays} days</dd>
                    <dd className="text-xs text-slate-500">Estimated delivery</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Provider</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{provider.displayName}</dd>
                    <dd className="text-xs text-slate-500">{provider.id.slice(0, 8)} · {provider.verificationStatus}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Created</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {new Date(listing.createdAt).toLocaleDateString()}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
                <h3 className="font-semibold text-slate-900">How marketplace works</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Students book; provider confirms. Payments remain separate from subscriptions.</li>
                  <li>An order is created from the booking; platform commission is calculated deterministically.</li>
                  <li>Service fulfilment uses access grants scoped to the order.</li>
                </ul>
                <p className="mt-4 text-xs text-slate-500">
                  POST /api/marketplace/bookings with {"{"} serviceListingId, providerId, scheduledAt {"}"} — student
                  is derived from your session.
                </p>
              </div>
            </div>

            <div className="lg:col-span-2">
              {isOwner ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                  <h3 className="font-semibold text-amber-900">You own this listing</h3>
                  <p className="mt-2 text-sm text-amber-800">
                    Students will see the booking form. As the owning provider you cannot book your own service.
                  </p>
                  <div className="mt-4 flex gap-3 text-sm">
                    <Link href={`/marketplace/providers/${provider.id}`} className="font-semibold text-amber-900 underline">
                      Manage provider
                    </Link>
                    <span className="text-amber-700">·</span>
                    <Link href="/marketplace/bookings" className="font-semibold text-amber-900 underline">
                      Bookings
                    </Link>
                  </div>
                </div>
              ) : !user ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
                  <p className="font-semibold text-slate-900">Sign in to book</p>
                  <p className="mt-2 text-sm text-slate-600">You need a student profile to book services.</p>
                  <Link
                    href="/login"
                    className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Sign in
                  </Link>
                </div>
              ) : !listing.isActive ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <p className="font-semibold text-slate-900">Listing inactive</p>
                  <p className="mt-2 text-sm text-slate-600">This provider has paused this service. Check back later.</p>
                </div>
              ) : (
                <BookButton serviceListingId={listing.id} providerId={listing.providerId} />
              )}

              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600">
                <p>
                  By booking you agree to Offer.ai&apos;s marketplace terms. Orders and commissions are tracked
                  separately from your subscription.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
