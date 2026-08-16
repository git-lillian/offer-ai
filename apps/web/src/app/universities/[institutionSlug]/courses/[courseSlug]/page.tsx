import { notFound } from "next/navigation";
import Link from "next/link";
import { CatalogueQueryRepository } from "@offer-ai/database";
import { getServerClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { Provenance, FixtureNotice } from "@/components/catalogue/provenance";

export const metadata = {
  title: "Course | Offer.ai",
};

const LEVEL_LABELS: Record<string, string> = {
  foundation: "Foundation",
  undergraduate: "Undergraduate",
  postgraduate_taught: "Postgraduate taught",
  postgraduate_research: "Postgraduate research",
  phd: "PhD",
};

const REQUIREMENT_KIND_LABELS: Record<string, string> = {
  academic: "Academic requirements",
  language: "English requirements",
  application: "Application requirements",
};

export default async function CoursePage({
  params,
}: {
  params: Promise<{ institutionSlug: string; courseSlug: string }>;
}) {
  const { institutionSlug, courseSlug } = await params;
  const supabase = await getServerClient();
  const course = await new CatalogueQueryRepository(
    supabase,
  ).getCourseBySlugs(institutionSlug, courseSlug);
  if (!course) notFound();

  const requirements = course.requirements.filter(
    (req) => req.verificationStatus !== "superseded" && req.verificationStatus !== "rejected",
  );
  const fixtures = requirements.filter((req) => req.sourceId === null);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-4xl space-y-8">
          <div>
            <Link
              href={`/universities/${course.institutionSlug}`}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              ← {course.institutionName}
            </Link>
            <p className="mt-4 text-sm font-semibold uppercase tracking-widest text-blue-600">
              {course.institutionName}
            </p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">{course.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                {LEVEL_LABELS[course.level] ?? course.level.replace(/_/g, " ")}
              </span>
              {course.applicationRoutes.map((route) => (
                <span
                  key={route}
                  className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600"
                >
                  {route.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Key facts</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Duration</dt>
                  <dd className="font-semibold text-slate-900">
                    {course.durationMonths ? `${course.durationMonths} months` : "Not stated"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Subject</dt>
                  <dd className="font-semibold text-slate-900">
                    {course.subjectName ?? "Not stated"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">International applicants</dt>
                  <dd className="font-semibold text-slate-900">
                    {course.internationalApplicantsSupported === null
                      ? "Not stated"
                      : course.internationalApplicantsSupported
                        ? "Welcome"
                        : "Not accepted"}
                  </dd>
                </div>
                {course.websiteUrl ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Official page</dt>
                    <dd className="font-semibold">
                      <Link
                        href={course.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline decoration-blue-200 hover:text-blue-700"
                      >
                        Visit
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Intakes & fees</h2>
              {course.intakes.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No intakes published yet.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {course.intakes.map((intake) => (
                    <li key={intake.id} className="border-l-2 border-blue-200 pl-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-semibold text-slate-900">
                          {intake.intakeMonth}/{intake.intakeYear}
                          {intake.closed ? (
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                              closed
                            </span>
                          ) : null}
                        </p>
                        {intake.tuitionFee !== null ? (
                          <p className="font-semibold text-slate-900">
                            £{intake.tuitionFee.toLocaleString()}
                            {intake.feeCurrencyCode ? ` ${intake.feeCurrencyCode}` : ""}
                          </p>
                        ) : null}
                      </div>
                      {intake.applicationDeadline ? (
                        <p className="mt-1 text-sm text-slate-600">
                          Application deadline:{" "}
                          {new Date(intake.applicationDeadline).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      ) : null}
                      {intake.cycleCode ? (
                        <p className="mt-0.5 text-xs text-slate-400">Cycle {intake.cycleCode}</p>
                      ) : null}
                      {intake.feeSource ? (
                        <div className="mt-2">
                          <Provenance
                            sourceName={intake.feeSource.name}
                            sourceUrl={intake.feeSource.url}
                            lastVerifiedAt={intake.feeSource.lastVerifiedAt}
                            sourceOwner={intake.feeSource.sourceOwner}
                          />
                        </div>
                      ) : null}
                      {intake.applicationDeadlineSource ? (
                        <div className="mt-1">
                          <Provenance
                            sourceName={intake.applicationDeadlineSource.name}
                            sourceUrl={intake.applicationDeadlineSource.url}
                            lastVerifiedAt={intake.applicationDeadlineSource.lastVerifiedAt}
                            sourceOwner={intake.applicationDeadlineSource.sourceOwner}
                          />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {requirements.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Entry requirements</h2>
              {fixtures.length > 0 ? <FixtureNotice /> : null}
              <div className="mt-4 space-y-6">
                {requirements.map((requirement) => (
                  <div key={requirement.id}>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                      {REQUIREMENT_KIND_LABELS[requirement.kind] ?? requirement.kind}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-800">
                      {requirement.sourceText}
                    </p>
                    {requirement.verificationStatus !== "human_verified" &&
                    requirement.verificationStatus !== "unverified" ? (
                      <p className="mt-1 text-xs text-slate-400">
                        Status: {requirement.verificationStatus.replace(/_/g, " ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}
