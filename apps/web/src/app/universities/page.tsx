import Link from "next/link";
import { institutionSearchParamsSchema } from "@offer-ai/contracts";
import { CatalogueQueryRepository } from "@offer-ai/database";
import { getServerClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { Pagination } from "@/components/catalogue/pagination";

export const metadata = {
  title: "Universities | Offer.ai",
};

const PAGE_SIZE = 24;

export default async function UniversitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = institutionSearchParamsSchema.safeParse({
    query: first(raw.query),
    countryCode: first(raw.country),
    page: Number(first(raw.page) ?? "1"),
    pageSize: PAGE_SIZE,
  });

  const params = parsed.success ? parsed.data : { page: 1, pageSize: PAGE_SIZE };
  const supabase = await getServerClient();
  const { total, items } = await new CatalogueQueryRepository(supabase).searchInstitutions({
    query: params.query,
    countryCode: params.countryCode,
    page: params.page,
    pageSize: PAGE_SIZE,
  });

  const baseHref = "/universities";

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-6xl space-y-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
              Admissions catalogue
            </p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">Universities</h1>
            <p className="mt-2 text-slate-600">
              Browse UK universities and their courses. All facts show their
              official source and the date they were last checked.
            </p>
          </div>

          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="block flex-1 min-w-64">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Search universities
              </span>
              <input
                name="query"
                defaultValue={params.query ?? ""}
                placeholder="Name or city, e.g. Edinburgh"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Country</span>
              <select
                name="country"
                defaultValue={params.countryCode ?? ""}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Any country</option>
                <option value="GB">United Kingdom</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Search
            </button>
          </form>

          {items.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
              <p className="text-slate-600">
                No universities match your search. Try a different name or city.
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((institution) => (
                <li key={institution.id}>
                  <Link
                    href={`/universities/${institution.slug}`}
                    className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow"
                  >
                    <h2 className="font-bold text-slate-900">{institution.name}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {institution.city ? `${institution.city}, ` : ""}
                      {institution.countryCode}
                    </p>
                    <p className="mt-3 text-xs font-semibold text-blue-600">
                      {institution.courseCount} course
                      {institution.courseCount === 1 ? "" : "s"} →
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Pagination
            page={params.page}
            pageSize={PAGE_SIZE}
            total={total}
            href={`${baseHref}?query=${encodeURIComponent(params.query ?? "")}&country=${encodeURIComponent(params.countryCode ?? "")}`}
          />
        </section>
      </main>
    </>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
