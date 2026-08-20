import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { GapCard } from "@/components/experience/gap-card";
import { createExperienceGapService } from "@/lib/services/experience-gap";

export const metadata = {
  title: "Experience gaps | Offer.ai",
};

export default async function ExperiencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const raw = await searchParams;
  const courseIdsParam = raw.courseIds;
  const courseIds = Array.isArray(courseIdsParam)
    ? courseIdsParam.flatMap((v) => v.split(",")).map((s) => s.trim()).filter(Boolean)
    : typeof courseIdsParam === "string"
      ? courseIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  const service = await createExperienceGapService();
  let result: Awaited<ReturnType<typeof service.analyzeForUser>> | null = null;
  let error: string | null = null;

  try {
    result = await service.analyzeForUser(user.id, courseIds);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to run gap analysis.";
  }

  const experiences = result?.experiences ?? [];
  const gaps = result?.gaps ?? [];
  const suggested = result?.suggestedOpportunityTypes ?? [];
  const summary = result?.summary ?? "";

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-4xl space-y-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Experience builder</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">Your experience profile</h1>
            <p className="mt-2 text-slate-600">
              Deterministic gap analysis compares your experiences and goals against your intended study level. Rules decide — no LLM. Suggested opportunities help you strengthen future applications.
            </p>
          </div>

          {error ? (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Experiences</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{experiences.length}</p>
              <p className="text-xs text-slate-600">Recorded experiences</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gaps found</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{gaps.length}</p>
              <p className="text-xs text-slate-600">Areas to strengthen</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Focus types</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {suggested.length > 0 ? suggested.join(", ") : "No specific type"}
              </p>
              <p className="text-xs text-slate-600">Suggested opportunity categories</p>
            </div>
          </div>

          {summary ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-6 py-4">
              <p className="text-sm font-medium text-blue-900">{summary}</p>
            </div>
          ) : null}

          <div>
            <h2 className="text-lg font-bold text-slate-900">Your experiences</h2>
            {experiences.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
                <p className="font-semibold text-slate-900">No experiences recorded yet</p>
                <p className="mt-2 text-sm text-slate-600">
                  Add experiences via onboarding or your profile to get tailored suggestions. Experiences map to opportunity types: internships, volunteering, research, competitions and courses.
                </p>
                <Link
                  href="/onboarding"
                  className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Complete onboarding →
                </Link>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {experiences.map((exp) => (
                  <li key={exp.id} className="rounded-xl border border-slate-200 bg-white px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{exp.title}</p>
                        <p className="text-xs text-slate-600">
                          {exp.experienceType} {exp.organisationName ? `· ${exp.organisationName}` : ""}{" "}
                          {exp.startedAt ? `· ${exp.startedAt.toISOString().slice(0, 10)}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {exp.experienceType}
                      </span>
                    </div>
                    {exp.description ? <p className="mt-2 text-sm text-slate-600">{exp.description}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Gaps & suggestions</h2>
              {suggested.length > 0 ? (
                <Link
                  href={`/opportunities?opportunityType=${encodeURIComponent(suggested[0] ?? "")}`}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  Browse {suggested[0]} →
                </Link>
              ) : null}
            </div>
            {gaps.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
                <p className="font-semibold text-emerald-900">Well-rounded profile</p>
                <p className="mt-2 text-sm text-emerald-700">
                  No gaps detected for your current target pathway. Keep building with complementary opportunities.
                </p>
                <Link
                  href="/opportunities"
                  className="mt-4 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Explore opportunities
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {gaps.map((gap) => (
                  <GapCard key={gap.code} gap={gap} />
                ))}
              </div>
            )}
          </div>

          {suggested.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-slate-900">Next steps</h3>
              <p className="mt-1 text-sm text-slate-600">
                Focus your search on the suggested types to close gaps efficiently. Each opportunity type maps to specific experiences valued by UK universities.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {suggested.map((type) => (
                  <Link
                    key={type}
                    href={`/opportunities?opportunityType=${encodeURIComponent(type)}`}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Browse {type} →
                  </Link>
                ))}
                <Link
                  href="/opportunities"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  View all opportunities
                </Link>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                POST /api/gap-analysis with {"{ courseIds: string[] }"} (student derived from session) · GET /api/opportunities with filters
              </p>
            </div>
          ) : null}

          <div className="flex gap-3">
            <Link
              href="/opportunities"
              className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Browse opportunities
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Dashboard
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
