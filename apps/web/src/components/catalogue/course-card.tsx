import Link from "next/link";
import type { CourseSummary } from "@offer-ai/database";

const LEVEL_LABELS: Record<string, string> = {
  foundation: "Foundation",
  undergraduate: "Undergraduate",
  postgraduate_taught: "Postgraduate taught",
  postgraduate_research: "Postgraduate research",
  phd: "PhD",
};

export function CourseCard({ course }: { course: CourseSummary }) {
  return (
    <li>
      <Link
        href={`/universities/${course.institutionSlug}/courses/${course.slug}`}
        className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900">{course.title}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {course.institutionName}
              {course.institutionCity ? `, ${course.institutionCity}` : ""}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {LEVEL_LABELS[course.level] ?? course.level.replace(/_/g, " ")}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {course.tuitionFee !== null ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Tuition</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">
                £{course.tuitionFee.toLocaleString()}
              </dd>
            </div>
          ) : null}
          {course.durationMonths !== null ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Duration</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">
                {course.durationMonths} months
              </dd>
            </div>
          ) : null}
          {course.subjectName ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Subject</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">{course.subjectName}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Open intakes</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{course.openIntakeCount}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {course.applicationRoutes.includes("ucas") ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
              UCAS
            </span>
          ) : null}
          {course.internationalApplicantsSupported === true ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
              International applicants welcome
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
