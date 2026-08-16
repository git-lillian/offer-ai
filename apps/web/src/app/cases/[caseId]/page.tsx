import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ApplicationCaseRepository,
  ApplicationTaskRepository,
  CourseIntakeRepository,
  CourseRepository,
  InstitutionRepository,
  StudentProfileRepository,
} from "@offer-ai/database";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { TransitionStatusForm } from "./transition-form";
import type { ApplicationCaseStatus } from "@offer-ai/domain";

export const metadata = {
  title: "Application case | Offer.ai",
};

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const user = await requireUser();
  const supabase = await getServerClient();

  const caseRepo = new ApplicationCaseRepository(supabase);
  const [applicationCase, events, tasks] = await Promise.all([
    caseRepo.findById(caseId),
    caseRepo.listEvents(caseId),
    new ApplicationTaskRepository(supabase).listByCase(caseId),
  ]);

  if (!applicationCase) {
    notFound();
  }

  // RLS prevents other students from reading this case; double-check that
  // the case belongs to the authenticated user's student profile.
  const profile = await new StudentProfileRepository(supabase).findByUserId(user.id);
  if (applicationCase.studentId !== (profile?.id ?? "")) {
    notFound();
  }

  const [institution, course, intake] = await Promise.all([
    new InstitutionRepository(supabase).findById(applicationCase.institutionId),
    new CourseRepository(supabase).findById(applicationCase.courseId),
    new CourseIntakeRepository(supabase).findById(applicationCase.courseIntakeId),
  ]);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-4xl space-y-8">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              ← Back to dashboard
            </Link>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
                  Application case
                </p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">
                  {course?.title ?? "Course"}
                </h1>
                <p className="mt-1 text-slate-600">
                  {institution?.name}
                  {intake
                    ? ` — intake ${intake.intakeMonth}/${intake.intakeYear}`
                    : ""}
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                {applicationCase.currentStatus.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Update status</h2>
            <p className="mt-1 text-sm text-slate-600">
              Status changes are recorded in the append-only event history.
            </p>
            <div className="mt-4">
              <TransitionStatusForm
                caseId={applicationCase.id}
                currentStatus={applicationCase.currentStatus}
              />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Timeline</h2>
              {events.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No events yet.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {events.map((event) => (
                    <li key={event.id} className="border-l-2 border-blue-200 pl-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {event.eventType.replace(/_/g, " ")}
                      </p>
                      <p className="text-sm text-slate-600">{event.message}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {event.occurredAt.toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Tasks</h2>
              {tasks.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No tasks yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-4"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{task.title}</p>
                        {task.dueAt ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Due {task.dueAt.toLocaleDateString()}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          task.status === "completed"
                            ? "bg-green-50 text-green-700"
                            : task.status === "in_progress"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {task.status.replace(/_/g, " ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

export type { ApplicationCaseStatus };
