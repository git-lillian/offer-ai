import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ApplicationCaseRepository,
  StudentProfileRepository,
  ApplicationTaskRepository,
} from "@offer-ai/database";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";

export const metadata = {
  title: "Dashboard | Offer.ai",
};

function profileCompletion(profile: {
  currentCountryCode: string | null;
  nationalityCountryCode: string | null;
  currentEducationLevel: string | null;
  intendedStudyLevel: string | null;
  budgetRange: { min: number | null; max: number | null } | null;
  englishProficiencyStatus: string | null;
}): { completed: number; total: number } {
  const checks = [
    profile.currentCountryCode !== null,
    profile.nationalityCountryCode !== null,
    profile.currentEducationLevel !== null,
    profile.intendedStudyLevel !== null,
    profile.budgetRange !== null,
    profile.englishProficiencyStatus !== null,
  ];
  return { completed: checks.filter(Boolean).length, total: checks.length };
}

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await getServerClient();

  const profileRepo = new StudentProfileRepository(supabase);
  const caseRepo = new ApplicationCaseRepository(supabase);
  const taskRepo = new ApplicationTaskRepository(supabase);

  const [profile, cases] = await Promise.all([
    profileRepo.findById(user.id),
    caseRepo.listByStudent(user.id),
  ]);

  if (profile && !profile.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  const tasks = await Promise.all(
    cases.map(async (applicationCase) => {
      const list = await taskRepo.listByCase(applicationCase.id);
      return { case: applicationCase, tasks: list };
    }),
  );

  const completion = profile ? profileCompletion(profile) : { completed: 0, total: 6 };
  const pendingTasks = tasks.flatMap(({ tasks }) =>
    tasks.filter((task) => task.status !== "completed" && task.status !== "cancelled"),
  );

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-6xl space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
                Dashboard
              </p>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">
                Welcome, {profile?.fullName ?? user.email}
              </h1>
              <p className="mt-2 text-slate-600">
                Your applications and next steps at a glance.
              </p>
            </div>
            <Link
              href="/cases/new"
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Create application case
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Profile completion
              </h2>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {completion.completed}/{completion.total}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{
                    width: `${(completion.completed / completion.total) * 100}%`,
                  }}
                />
              </div>
              {completion.completed < completion.total ? (
                <Link
                  href="/onboarding"
                  className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  Continue onboarding →
                </Link>
              ) : (
                <p className="mt-4 text-sm text-green-700">Profile complete</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Application cases
              </h2>
              <p className="mt-3 text-3xl font-bold text-slate-900">{cases.length}</p>
              <Link
                href="/cases/new"
                className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Start a new application →
              </Link>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Tasks needing action
              </h2>
              <p className="mt-3 text-3xl font-bold text-slate-900">{pendingTasks.length}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Your application cases</h2>
            </div>

            {cases.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-slate-600">
                  You have no application cases yet. Create your first one to
                  start building your applications.
                </p>
                <Link
                  href="/cases/new"
                  className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  Create your first case
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {cases.map((applicationCase) => (
                  <li key={applicationCase.id}>
                    <Link
                      href={`/cases/${applicationCase.id}`}
                      className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          Case {applicationCase.id.slice(0, 8)}
                        </p>
                        <p className="text-sm text-slate-500">
                          Created {applicationCase.createdAt.toLocaleDateString()}
                        </p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                        {applicationCase.currentStatus.replace(/_/g, " ")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
