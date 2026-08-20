import Link from "next/link";
import type { ProviderProfile } from "@offer-ai/domain";

const VERIFICATION_STYLES: Record<string, string> = {
  verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

export function ProviderCard({ provider }: { provider: ProviderProfile }) {
  return (
    <Link
      href={`/marketplace/providers/${provider.id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-slate-900">{provider.displayName}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
            {provider.bio || "No bio provided."}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${VERIFICATION_STYLES[provider.verificationStatus] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}
        >
          {provider.verificationStatus}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {provider.specialisms.slice(0, 4).map((s) => (
          <span
            key={s}
            className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
          >
            {s}
          </span>
        ))}
        {provider.specialisms.length > 4 ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            +{provider.specialisms.length - 4}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        {provider.countryScope.length > 0 ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
            {provider.countryScope.join(", ")}
          </span>
        ) : null}
        {provider.languageScope.length > 0 ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
            {provider.languageScope.join(", ")}
          </span>
        ) : null}
      </div>

      <p className="mt-4 text-xs font-semibold text-blue-600">View profile →</p>
    </Link>
  );
}
