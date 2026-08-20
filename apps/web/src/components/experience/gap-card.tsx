import Link from "next/link";
import type { ExperienceGapDto } from "@offer-ai/contracts";

const SEVERITY_STYLES: Record<string, string> = {
  gap: "border-red-200 bg-red-50 text-red-700",
  suggestion: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-slate-200 bg-slate-50 text-slate-600",
};

const SEVERITY_LABELS: Record<string, string> = {
  gap: "Gap",
  suggestion: "Suggestion",
  info: "Info",
};

export function GapCard({ gap }: { gap: ExperienceGapDto }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${SEVERITY_STYLES[gap.severity] ?? "border-slate-200 bg-slate-50 text-slate-600"}`}
            >
              {SEVERITY_LABELS[gap.severity] ?? gap.severity}
            </span>
            <span className="font-mono text-xs text-slate-500">{gap.code}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700">{gap.message}</p>
        </div>
      </div>

      {gap.suggestedOpportunityTypes.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Suggested:
          </span>
          {gap.suggestedOpportunityTypes.map((type) => (
            <Link
              key={type}
              href={`/opportunities?opportunityType=${encodeURIComponent(type)}`}
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              {type}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
