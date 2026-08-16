import { notFound } from "next/navigation";
import Link from "next/link";
import { courseSearchParamsSchema } from "@offer-ai/contracts";
import { CatalogueQueryRepository } from "@offer-ai/database";
import { getServerClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { CourseCard } from "@/components/catalogue/course-card";
import { CourseSearchForm } from "@/components/catalogue/course-search-form";
import { Pagination } from "@/components/catalogue/pagination";

export const metadata = {
  title: "University courses | Offer.ai",
};

const PAGE_SIZE = 12;

export default async function InstitutionPage({
  params,
  searchParams,
}: {
  params: Promise<{ institutionSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { institutionSlug } = await params;
  const raw = await searchParams;
  const parsed = courseSearchParamsSchema.safeParse({
    query: first(raw.query),
    subjectSlug: first(raw.subject),
    level: first(raw.level),
    city: first(raw.city),
    intakeYear: raw.intakeYear ? Number(first(raw.intakeYear)) : undefined,
    tuitionRange:
      raw.tuitionMin || raw.tuitionMax
        ? {
            min: raw.tuitionMin ? Number(first(raw.tuitionMin)) : undefined,
            max: raw.tuitionMax ? Number(first(raw.tuitionMax)) : undefined,
            currencyCode: "GBP",
          }
        : undefined,
    internationalApplicantsSupported: first(raw.international) === "yes" ? true : undefined,
    page: Number(first(raw.page) ?? "1"),
    pageSize: PAGE_SIZE,
  });

  const search = parsed.success ? parsed.data : { page: 1, pageSize: PAGE_SIZE };
  const supabase = await getServerClient();
  const repo = new CatalogueQueryRepository(supabase);

  const institution = await repo.getInstitutionBySlug(institutionSlug);
  if (!institution) notFound();

  const result = await repo.searchCoursesByInstitution(institutionSlug, search);
  const baseHref = `/universities/${institutionSlug}`;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-6xl space-y-8">
          <div>
            <Link
              href="/universities"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              ← All universities
            </Link>
            <p className="mt-4 text-sm font-semibold uppercase tracking-widest text-blue-600">
              {institution.city ? `${institution.city} · ` : ""}
              {institution.countryCode}
            </p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">{institution.name}</h1>
            {institution.websiteUrl ? (
              <p className="mt-2 text-sm">
                <Link
                  href={institution.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 underline decoration-blue-200 hover:text-blue-700"
                >
                  Official website
                </Link>
              </p>
            ) : null}
          </div>

          <CourseSearchForm
            initial={search}
            facets={result.facets}
            actionPath={baseHref}
          />

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Courses ({result.total})
            </h2>
            {result.items.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
                <p className="text-slate-600">
                  No courses match the current filters.
                </p>
              </div>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {result.items.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </ul>
            )}
          </div>

          <Pagination
            page={search.page}
            pageSize={PAGE_SIZE}
            total={result.total}
            href={baseHref}
          />
        </section>
      </main>
    </>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
