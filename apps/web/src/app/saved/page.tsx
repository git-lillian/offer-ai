import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { SavedCourseCard } from "@/components/recommendations/saved-course-card";
import { SavedCourseRepository } from "@offer-ai/database";
import { createSavedCourseService } from "@/lib/services/saved-course";

export const metadata = {
  title: "Saved courses | Offer.ai",
};

export default async function SavedCoursesPage() {
  const user = await requireUser();
  // Saved courses are listed via SavedCourseRepository (RLS owner-only) — see service layer.
  void SavedCourseRepository;
  const service = await createSavedCourseService();

  let saved: Awaited<ReturnType<typeof service.listForUser>> = [];
  let error: string | null = null;

  try {
    saved = await service.listForUser(user.id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load saved courses.";
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-4xl space-y-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Your list</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">Saved courses</h1>
            <p className="mt-2 text-slate-600">
              Courses you&apos;ve saved for later. Remove any you no longer need or continue to
              recommendations to discover more.
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

          {saved.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <p className="font-semibold text-slate-900">No saved courses yet</p>
              <p className="mt-2 text-sm text-slate-600">
                Save courses from recommendations or the catalogue to keep them here.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link
                  href="/recommendations"
                  className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  View recommendations
                </Link>
                <Link
                  href="/universities"
                  className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Browse universities
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">{saved.length} saved course{saved.length === 1 ? "" : "s"}</p>
              {saved.map(({ saved: row, course }) => (
                <SavedCourseCard
                  key={row.id}
                  course={{
                    id: course.id,
                    title: course.title,
                    slug: course.slug,
                    level: course.level,
                    institutionName: course.institutionName,
                    institutionSlug: course.institutionSlug,
                    institutionCity: course.institutionCity,
                    tuitionFee: course.tuitionFee,
                    currencyCode: course.currencyCode,
                    savedAt: row.createdAt,
                  }}
                />
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <Link
              href="/recommendations"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Recommendations
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
