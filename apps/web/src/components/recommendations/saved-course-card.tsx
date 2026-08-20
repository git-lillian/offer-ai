import Link from "next/link";
import { UnsaveButton } from "./unsave-button";

export interface SavedCourseCardCourse {
  id: string;
  title: string;
  slug: string;
  level: string;
  institutionName: string;
  institutionSlug: string;
  institutionCity: string | null;
  tuitionFee: number | null;
  currencyCode: string | null;
  savedAt: Date;
}

const LEVEL_LABELS: Record<string, string> = {
  foundation: "Foundation",
  undergraduate: "Undergraduate",
  postgraduate_taught: "Postgraduate taught",
  postgraduate_research: "Postgraduate research",
  phd: "PhD",
};

export function SavedCourseCard({ course }: { course: SavedCourseCardCourse }) {
  const href =
    course.institutionSlug && course.slug
      ? `/universities/${course.institutionSlug}/courses/${course.slug}`
      : undefined;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          {course.tuitionFee !== null ? (
            <span className="font-semibold text-slate-900">
              {course.currencyCode ?? "GBP"} {course.tuitionFee.toLocaleString()}
            </span>
          ) : (
            <span className="text-slate-500">Fee not stated</span>
          )}
          <span className="text-xs text-slate-400">
            Saved {course.savedAt.toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {href ? (
          <Link
            href={href}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            View
          </Link>
        ) : null}
        <UnsaveButton courseId={course.id} />
      </div>
    </div>
  );
}
