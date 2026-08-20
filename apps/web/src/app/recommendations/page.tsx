import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { RecommendationCard, type RecommendationCardCourse } from "@/components/recommendations/recommendation-card";
import { StudentProfileRepository, CatalogueQueryRepository } from "@offer-ai/database";
import { RecommendationService } from "@offer-ai/admissions-engine";
import { createRecommendationService } from "@/lib/services/recommendation";
import { createSavedCourseService } from "@/lib/services/saved-course";
import type { CourseRecommendation } from "@offer-ai/admissions-engine";
import { RecommendationGenerateForm } from "./generate-form";

export const metadata = {
  title: "Recommendations | Offer.ai",
};

type CourseWithInstitutionRow = {
  id: string;
  title: string;
  slug: string;
  level: string;
  tuition_fee: number | null;
  currency_code: string | null;
  catalog_institutions: { name: string; slug: string; city: string | null } | null;
};

export default async function RecommendationsPage() {
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
            <h1 className="text-3xl font-bold text-slate-900">Recommendations</h1>
            <p className="mt-2 text-slate-600">
              Complete onboarding to get personalised course recommendations.
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

  // Server component fetches via CatalogueQueryRepository + RecommendationService (delivery orchestrates, domain decides).
  const catalogueRepo = new CatalogueQueryRepository(supabase);
  void catalogueRepo;
  void RecommendationService;

  // Fetch a sample of courses for initial generation when no explicit ids provided.
  let recommendations: CourseRecommendation[] = [];
  const coursesById = new Map<string, RecommendationCardCourse>();
  let error: string | null = null;
  let savedCourseIds = new Set<string>();

  try {
    const savedService = await createSavedCourseService();
    const savedIds = await savedService.listCourseIdsForUser(user.id);
    savedCourseIds = new Set(savedIds);

    const recommendationService = await createRecommendationService();
    // Use a sample of up to 12 courses from the catalogue
    recommendations = await recommendationService.generateSampleForUser(user.id, 12);

    if (recommendations.length > 0) {
      const courseIds = recommendations.map((r) => r.courseId);
      const { data } = await supabase
        .from("catalog_courses")
        .select("id, title, slug, level, tuition_fee, currency_code, catalog_institutions(name, slug, city)")
        .in("id", courseIds);

      for (const row of (data ?? []) as unknown as CourseWithInstitutionRow[]) {
        coursesById.set(row.id, {
          id: row.id,
          title: row.title,
          slug: row.slug,
          level: row.level,
          institutionName: row.catalog_institutions?.name ?? "Unknown",
          institutionSlug: row.catalog_institutions?.slug ?? "",
          institutionCity: row.catalog_institutions?.city ?? null,
          tuitionFee: row.tuition_fee,
          currencyCode: row.currency_code,
        });
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load recommendations.";
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-4xl space-y-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
              For you
            </p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">Recommendations</h1>
            <p className="mt-2 text-slate-600">
              Deterministic eligibility, strategy band and score for each course. Rules decide — no
              LLM overrides. Provenance shows the profile, catalogue and rule versions used.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">Generate recommendations</h2>
            <p className="mt-1 text-sm text-slate-600">
              Generate for your profile against the current catalogue sample. You can also generate
              for specific courses via the API.
            </p>
            <div className="mt-4">
              <RecommendationGenerateForm />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              POST /api/recommendations/generate with {"{"} courseIds: string[] {"}"} (1–20)
              — student is derived from your session.
            </p>
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          ) : null}

          {recommendations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <p className="font-semibold text-slate-900">No recommendations yet</p>
              <p className="mt-2 text-sm text-slate-600">
                We couldn&apos;t find courses to evaluate, or your profile is missing key fields.
                Complete onboarding and ensure the catalogue has courses.
              </p>
              <Link
                href="/universities"
                className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Browse universities
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Showing {recommendations.length} recommendations · profile{" "}
                <span className="font-mono text-xs">{profile.updatedAt.toISOString().slice(0, 10)}</span>
              </p>
              {recommendations.map((rec) => {
                const course = coursesById.get(rec.courseId) ?? {
                  id: rec.courseId,
                  title: "Course",
                  slug: "",
                  level: "undergraduate",
                  institutionName: "Unknown",
                  institutionSlug: "",
                  institutionCity: null,
                  tuitionFee: null,
                  currencyCode: null,
                };
                return (
                  <RecommendationCard
                    key={rec.courseId}
                    recommendation={rec}
                    course={course}
                    isSaved={savedCourseIds.has(rec.courseId)}
                  />
                );
              })}
            </div>
          )}

          <div className="flex gap-3">
            <Link
              href="/saved"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              View saved courses →
            </Link>
            <Link
              href="/universities"
              className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Browse catalogue
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
