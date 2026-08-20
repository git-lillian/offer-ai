import Link from "next/link";
import type { ServiceListing } from "@offer-ai/domain";

const SERVICE_TYPE_LABELS: Record<string, string> = {
  personal_statement: "Personal statement",
  strategy: "Strategy",
  mentoring: "Mentoring",
  cv_review: "CV review",
  interview_prep: "Interview prep",
  other: "Other",
};

const SERVICE_TYPE_STYLES: Record<string, string> = {
  personal_statement: "bg-purple-50 text-purple-700 border-purple-200",
  strategy: "bg-blue-50 text-blue-700 border-blue-200",
  mentoring: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cv_review: "bg-amber-50 text-amber-700 border-amber-200",
  interview_prep: "bg-slate-100 text-slate-700 border-slate-200",
  other: "bg-slate-50 text-slate-600 border-slate-200",
};

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

export function ListingCard({
  listing,
  providerName,
}: {
  listing: ServiceListing;
  providerName?: string;
}) {
  return (
    <Link
      href={`/marketplace/listings/${listing.id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 flex-1 font-bold text-slate-900">{listing.title}</h3>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${SERVICE_TYPE_STYLES[listing.serviceType] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}
        >
          {SERVICE_TYPE_LABELS[listing.serviceType] ?? listing.serviceType}
        </span>
      </div>

      {providerName ? (
        <p className="mt-1 text-sm text-slate-500">
          by{" "}
          <span className="font-medium text-slate-700">{providerName}</span>
        </p>
      ) : null}

      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
        {listing.description || "No description provided."}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Price</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">
            {formatPrice(listing.price, listing.currencyCode)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Turnaround</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">{listing.turnaroundDays} days</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${listing.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
        >
          {listing.isActive ? "Active" : "Inactive"}
        </span>
        <span className="text-xs font-semibold text-blue-600">View listing →</span>
      </div>
    </Link>
  );
}
