import Link from "next/link";
import type { OpportunityDto } from "@offer-ai/contracts";
import { Button } from "@offer-ai/ui";

const TYPE_LABELS: Record<string, string> = {
  internship: "Internship",
  volunteering: "Volunteering",
  course: "Course",
  competition: "Competition",
  research: "Research",
};

const TYPE_STYLES: Record<string, string> = {
  internship: "bg-blue-50 text-blue-700 border-blue-200",
  volunteering: "bg-emerald-50 text-emerald-700 border-emerald-200",
  course: "bg-amber-50 text-amber-700 border-amber-200",
  competition: "bg-purple-50 text-purple-700 border-purple-200",
  research: "bg-slate-100 text-slate-700 border-slate-200",
};

export function OpportunityCard({
  opportunity,
  isSaved = false,
}: {
  opportunity: OpportunityDto;
  isSaved?: boolean;
}) {
  const href = `/opportunities/${opportunity.id}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link href={href} className="font-bold text-slate-900 hover:text-blue-700">
            {opportunity.title}
          </Link>
          <p className="mt-1 text-sm text-slate-600">
            {opportunity.providerName}
            {opportunity.locationCountryCode ? ` · ${opportunity.locationCountryCode}` : ""}
            {opportunity.isRemote ? " · Remote" : ""}
          </p>
          {opportunity.durationMonths !== null ? (
            <p className="mt-1 text-xs text-slate-500">{opportunity.durationMonths} months</p>
          ) : null}
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${TYPE_STYLES[opportunity.opportunityType] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}
        >
          {TYPE_LABELS[opportunity.opportunityType] ?? opportunity.opportunityType}
        </span>
      </div>

      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-700">{opportunity.description || "No description provided."}</p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {opportunity.url ? (
            <a
              href={opportunity.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-blue-600 underline decoration-blue-200 hover:text-blue-700"
            >
              External link
            </a>
          ) : null}
          <Link href={href} className="text-xs font-semibold text-slate-600 hover:text-slate-900">
            View detail →
          </Link>
        </div>
        {isSaved ? (
          <span className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
            Saved ✓
          </span>
        ) : (
          <Link href={href}>
            <Button variant="secondary" size="sm">
              Save
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
