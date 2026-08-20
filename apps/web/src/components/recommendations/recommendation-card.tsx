import Link from "next/link";
import type { CourseRecommendation } from "@offer-ai/admissions-engine";
import { SaveCourseButton } from "./save-button";

export type RecommendationCardCourse = {
  id: string;
  title: string;
  slug: string;
  level: string;
  institutionName: string;
  institutionSlug: string;
  institutionCity: string | null;
  tuitionFee: number | null;
  currencyCode: string | null;
};

const ELIGIBILITY_STYLES: Record<string, string> = {
  eligible: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ineligible: "bg-red-50 text-red-700 border-red-200",
  uncertain: "bg-amber-50 text-amber-700 border-amber-200",
};

const STRATEGY_STYLES: Record<string, string> = {
  aspirational: "bg-purple-50 text-purple-700 border-purple-200",
  target: "bg-blue-50 text-blue-700 border-blue-200",
  safer: "bg-slate-100 text-slate-700 border-slate-200",
};

const LEVEL_LABELS: Record<string, string> = {
  foundation: "Foundation",
  undergraduate: "Undergraduate",
  postgraduate_taught: "Postgraduate taught",
  postgraduate_research: "Postgraduate research",
  phd: "PhD",
};

export function RecommendationCard({
  recommendation,
  course,
  isSaved = false,
}: {
  recommendation: CourseRecommendation;
  course: RecommendationCardCourse;
  isSaved?: boolean;
}) {
  const href =
    course.institutionSlug && course.slug
      ? `/universities/${course.institutionSlug}/courses/${course.slug}`
      : undefined;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {href ? (
            <Link href={href} className="font-bold text-slate-900 hover:text-blue-700">
              {course.title}
            </Link>
          ) : (
            <h3 className="font-bold text-slate-900">{course.title}</h3>
          )}
          <p className="mt-1 text-sm text-slate-600">
            {course.institutionName}
            {course.institutionCity ? ` · ${course.institutionCity}` : ""}
            {" · "}
            {LEVEL_LABELS[course.level] ?? course.level.replace(/_/g, " ")}
          </p>
          {course.tuitionFee !== null ? (
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {course.currencyCode ?? "GBP"} {course.tuitionFee.toLocaleString()}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${ELIGIBILITY_STYLES[recommendation.eligibility] ?? "bg-slate-100 text-slate-700"}`}
          >
            {recommendation.eligibility}
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${STRATEGY_STYLES[recommendation.strategyBand] ?? "bg-slate-100 text-slate-700"}`}
          >
            {recommendation.strategyBand}
          </span>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
            Score {recommendation.score} · {(recommendation.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 text-sm">
        {recommendation.reasons.length > 0 ? (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reasons</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
              {recommendation.reasons.map((r: { code: string; message: string }, idx: number) => (
                <li key={`${r.code}-${idx}`}>
                  <span className="font-medium">{r.code}:</span> {r.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {recommendation.blockers.length > 0 ? (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Blockers</h4>
            <ul className="mt-2 space-y-1">
              {recommendation.blockers.map(
                (b: { code: string; message: string; severity: string }, idx: number) => (
                  <li
                    key={`${b.code}-${idx}`}
                    className={`rounded-lg border px-3 py-2 text-sm ${b.severity === "hard" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}
                  >
                    <span className="font-semibold">{b.code}</span> ({b.severity}): {b.message}
                  </li>
                ),
              )}
            </ul>
          </div>
        ) : null}

        {recommendation.missingInformation.length > 0 ? (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing information</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
              {recommendation.missingInformation.map((m: { field: string; message: string }, idx: number) => (
                <li key={`${m.field}-${idx}`}>
                  <span className="font-medium">{m.field}:</span> {m.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-xs leading-5 text-slate-500">
          Provenance · Profile <span className="font-mono">{recommendation.profileVersion.slice(0, 10)}</span>
          {" · "}Catalogue <span className="font-mono">{recommendation.catalogueVersion.slice(0, 10)}</span>
          {" · "}Rules <span className="font-mono">{recommendation.rulesVersion}</span>
        </p>
        <SaveCourseButton courseId={recommendation.courseId} isSaved={isSaved} />
      </div>
    </div>
  );
}
