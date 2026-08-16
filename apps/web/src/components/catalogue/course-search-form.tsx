"use client";

import { useRouter } from "next/navigation";
import type { CourseSearchParams, CatalogueFacets } from "@offer-ai/contracts";

const LEVEL_LABELS: Record<string, string> = {
  foundation: "Foundation",
  undergraduate: "Undergraduate",
  postgraduate_taught: "Postgraduate taught",
  postgraduate_research: "Postgraduate research",
  phd: "PhD",
};

/**
 * Catalogue search form — submits via GET so results stay shareable and
 * server-rendered. Facets drive the filter options; filters compose with AND.
 */
export function CourseSearchForm({
  initial,
  facets,
  actionPath,
}: {
  initial: CourseSearchParams;
  facets: CatalogueFacets;
  actionPath: string;
}) {
  const router = useRouter();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    const query = String(data.get("query") ?? "").trim();
    if (query) params.set("query", query);
    const level = String(data.get("level") ?? "");
    if (level) params.set("level", level);
    const subject = String(data.get("subject") ?? "");
    if (subject) params.set("subject", subject);
    const city = String(data.get("city") ?? "");
    if (city) params.set("city", city);
    const intakeYear = String(data.get("intakeYear") ?? "");
    if (intakeYear) params.set("intakeYear", intakeYear);
    const tuitionMin = String(data.get("tuitionMin") ?? "");
    if (tuitionMin) params.set("tuitionMin", tuitionMin);
    const tuitionMax = String(data.get("tuitionMax") ?? "");
    if (tuitionMax) params.set("tuitionMax", tuitionMax);
    if (data.get("international") === "on") params.set("international", "yes");
    const qs = params.toString();
    router.push(qs ? `${actionPath}?${qs}` : actionPath);
  }

  const selected = {
    query: initial.query ?? "",
    level: initial.level ?? "",
    subject: initial.subjectSlug ?? "",
    city: initial.city ?? "",
    intakeYear: initial.intakeYear ? String(initial.intakeYear) : "",
    tuitionMin: initial.tuitionRange?.min ? String(initial.tuitionRange.min) : "",
    tuitionMax: initial.tuitionRange?.max ? String(initial.tuitionRange.max) : "",
    international: initial.internationalApplicantsSupported === true,
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Search</span>
        <input
          name="query"
          defaultValue={selected.query}
          placeholder="University, course or subject"
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Study level</span>
        <select
          name="level"
          defaultValue={selected.level}
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">Any level</option>
          {facets.levels.map((f) => (
            <option key={f.level} value={f.level}>
              {LEVEL_LABELS[f.level] ?? f.level} ({f.count})
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Subject</span>
        <select
          name="subject"
          defaultValue={selected.subject}
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">Any subject</option>
          {facets.subjects.map((f) => (
            <option key={f.id} value={f.slug}>
              {f.name} ({f.count})
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">City</span>
        <select
          name="city"
          defaultValue={selected.city}
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">Any city</option>
          {facets.cities.map((f) => (
            <option key={f.city} value={f.city}>
              {f.city} ({f.count})
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Entry year</span>
        <select
          name="intakeYear"
          defaultValue={selected.intakeYear}
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">Any year</option>
          {facets.intakeYears.map((f) => (
            <option key={f.intakeYear} value={f.intakeYear}>
              {f.intakeYear} ({f.count})
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-3">
        <label className="block flex-1">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Tuition from (£)
          </span>
          <input
            name="tuitionMin"
            type="number"
            min={0}
            defaultValue={selected.tuitionMin}
            placeholder={facets.tuitionMin?.toString() ?? "0"}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="block flex-1">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">to (£)</span>
          <input
            name="tuitionMax"
            type="number"
            min={0}
            defaultValue={selected.tuitionMax}
            placeholder={facets.tuitionMax?.toString() ?? "any"}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </div>

      <div className="flex items-end justify-between gap-3">
        {facets.internationalSupported.known > 0 ? (
          <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-sm font-medium text-slate-700">
            <input
              name="international"
              type="checkbox"
              defaultChecked={selected.international}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-100"
            />
            International applicants
          </label>
        ) : (
          <span />
        )}
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Search
        </button>
      </div>
    </form>
  );
}
