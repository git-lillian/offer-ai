import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { ExplainForm } from "@/components/adviser/explain-form";
import { StudentProfileRepository } from "@offer-ai/database";
import { createSavedCourseService } from "@/lib/services/saved-course";
import { createRecommendationService } from "@/lib/services/recommendation";

export const metadata = {
  title: "AI Adviser | Offer.ai",
};

type CourseOption = {
  id: string;
  title: string;
  subtitle: string;
};

export default async function AdviserPage() {
  const user = await requireUser();
  const supabase = await getServerClient();
  const profileRepo = new StudentProfileRepository(supabase);
  const profile = await profileRepo.findByUserId(user.id);

  if (!profile) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-slate-50 px-6 py-10">
          <section className="mx-auto max-w-4xl">
            <h1 className="text-3xl font-bold text-slate-900">AI Adviser</h1>
            <p className="mt-2 text-slate-600">
              Complete onboarding to get personalised eligibility explanations.
            </p>
            <Link
              href="/onboarding"
              className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Go to onboarding →
            </Link>
          </section>
        </main>
      </>
    );
  }

  // Delivery orchestrates — domain decides. Fetch saved courses + deterministic recommendations.
  let courseOptions: CourseOption[] = [];
  let error: string | null = null;

  try {
    const savedService = await createSavedCourseService();
    const saved = await savedService.listForUser(user.id);

    const recommendationService = await createRecommendationService();
    let recommendations: Awaited<ReturnType<typeof recommendationService.generateSampleForUser>> = [];
    try {
      recommendations = await recommendationService.generateSampleForUser(user.id, 12);
    } catch {
      recommendations = [];
    }

    const savedIds = new Set(saved.map((s) => s.course.id));

    // Build lookup for course titles from saved + recommendations
    const courseIdsFromRecs = recommendations.map((r) => r.courseId);
    const allIds = Array.from(new Set([...savedIds, ...courseIdsFromRecs]));

    const titleById = new Map<string, { title: string; subtitle: string }>();
    if (allIds.length > 0) {
      const { data } = await supabase
        .from("catalog_courses")
        .select("id, title, slug, level, catalog_institutions(name, slug, city)")
        .in("id", allIds);
      type Row = {
        id: string;
        title: string;
        slug: string;
        level: string;
        catalog_institutions: { name: string; slug: string; city: string | null } | null;
      };
      for (const row of (data ?? []) as unknown as Row[]) {
        titleById.set(row.id, {
          title: row.title,
          subtitle: `${row.catalog_institutions?.name ?? "Unknown"} · ${row.level}`,
        });
      }
    }

    // Saved courses first (user curated), then recommendations not already saved
    for (const { course } of saved) {
      const meta = titleById.get(course.id);
      courseOptions.push({
        id: course.id,
        title: meta?.title ?? course.title,
        subtitle: meta?.subtitle ?? "Saved course",
      });
    }
    for (const rec of recommendations) {
      if (savedIds.has(rec.courseId)) continue;
      const meta = titleById.get(rec.courseId);
      courseOptions.push({
        id: rec.courseId,
        title: meta?.title ?? "Course",
        subtitle: meta
          ? `${meta.subtitle} · ${rec.eligibility} · ${rec.strategyBand} · score ${rec.score}`
          : `${rec.eligibility} · ${rec.strategyBand}`,
      });
    }

    // De-duplicate by id while preserving order
    const seen = new Set<string>();
    courseOptions = courseOptions.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load adviser data.";
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-4xl space-y-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
              AI Adviser
            </p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">Explain eligibility</h1>
            <p className="mt-2 text-slate-600">
              Deterministic rules decide eligibility, strategy band and score. The AI adviser only
              explains the result — it never decides or contradicts the rules. Every explanation is
              recorded in the <code className="font-mono text-xs">ai_runs</code> ledger with prompt
              version, model and latency for auditability.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">How it works</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>Your profile, qualifications and the course requirements are evaluated deterministically.</li>
              <li>The engine produces eligibility, reasons, blockers and missing information with provenance (profile, catalogue, rules versions).</li>
              <li>The LLM receives only the minimal contexts plus the deterministic reasons — it explains without inventing requirements.</li>
              <li>The run is logged to the ledger and returned with provenance for this UI to display.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link
                href="/recommendations"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                View recommendations →
              </Link>
              <Link
                href="/saved"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                View saved courses →
              </Link>
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          ) : null}

          <ExplainForm courses={courseOptions} />

          <div className="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-slate-100">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              API access
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              The same capability is available via the API. Student is always derived from your
              session — never trust a <code className="font-mono text-xs">studentId</code> from the
              browser.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-800 p-4 text-xs leading-5 text-slate-200">
              <code>
                POST /api/adviser/explain {"\n"}
                {"{"} &quot;courseId&quot;: &quot;uuid&quot; {"}"} {"\n\n"}
                POST /api/adviser/explain-structured {"\n"}
                {"{"} &quot;courseId&quot;: &quot;uuid&quot; {"}"}
              </code>
            </pre>
            <p className="mt-2 text-xs text-slate-400">
              Both validate with{" "}
              <code className="font-mono">explainEligibilityRequestSchema</code> and return{" "}
              <code className="font-mono">explainEligibilityResponseSchema</code> (explanation +
              provenance). FakeProvider is used when AI_PROVIDER=fake (default); no model names
              appear in application code.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Dashboard
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
