import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ApplicationCaseRepository,
  CourseIntakeRepository,
  CourseRepository,
  InstitutionRepository,
  StudentProfileRepository,
} from "@offer-ai/database";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { ApplicationOsService } from "@/lib/services/application-os";
import { TaskCard } from "@/components/application-os/TaskCard";
import { MilestoneCard } from "@/components/application-os/MilestoneCard";
import { CreateTaskForm } from "@/components/application-os/CreateTaskForm";
import { CreateMilestoneForm } from "@/components/application-os/CreateMilestoneForm";

export const metadata = {
  title: "Application OS | Offer.ai",
};

export default async function ApplicationOsPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const user = await requireUser();
  const supabase = await getServerClient();

  const caseRepo = new ApplicationCaseRepository(supabase);
  const applicationCase = await caseRepo.findById(caseId);

  if (!applicationCase) {
    notFound();
  }

  const profile = await new StudentProfileRepository(supabase).findByUserId(user.id);
  if (applicationCase.studentId !== (profile?.id ?? "")) {
    notFound();
  }

  const osService = new ApplicationOsService(supabase);
  const [tasks, milestones] = await Promise.all([
    osService.listTasks(caseId, user.id).catch(() => []),
    osService.listMilestones(caseId, user.id).catch(() => []),
  ]);

  const [institution, course, intake] = await Promise.all([
    new InstitutionRepository(supabase).findById(applicationCase.institutionId),
    new CourseRepository(supabase).findById(applicationCase.courseId),
    new CourseIntakeRepository(supabase).findById(applicationCase.courseIntakeId),
  ]);

  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const pendingTasks = tasks.filter((t) => t.status === "pending").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length;
  const overdueTasks = tasks.filter(
    (t) => t.dueAt && t.dueAt < new Date() && t.status !== "completed" && t.status !== "cancelled",
  ).length;

  const completedMilestones = milestones.filter((m) => m.status === "completed").length;

  const completionPct = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const nextOrder = milestones.length > 0 ? Math.max(...milestones.map((m) => m.sortOrder)) + 1 : milestones.length;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-6xl space-y-8">
          <div>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/dashboard" className="font-semibold text-blue-600 hover:text-blue-700">
                ← Dashboard
              </Link>
              <span className="text-slate-300">·</span>
              <Link href={`/cases/${caseId}`} className="font-semibold text-slate-600 hover:text-slate-900">
                ← Case detail
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Application OS</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">{course?.title ?? "Course"}</h1>
                <p className="mt-1 text-slate-600">
                  {institution?.name ?? "Institution"}
                  {intake ? ` — intake ${intake.intakeMonth}/${intake.intakeYear}` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Case {applicationCase.id.slice(0, 8)} · {applicationCase.currentStatus.replace(/_/g, " ")}
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                {applicationCase.currentStatus.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Progress</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {completedTasks}/{tasks.length}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${completionPct}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-600">{completionPct}% completed</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tasks needing action</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{pendingTasks + inProgressTasks}</p>
              <p className="mt-1 text-xs text-slate-600">
                {pendingTasks} pending · {inProgressTasks} in progress
                {overdueTasks > 0 ? ` · ${overdueTasks} overdue` : ""}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Milestones</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {completedMilestones}/{milestones.length}
              </p>
              <p className="mt-1 text-xs text-slate-600">{milestones.length} total · ordered by sortOrder</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deadline</p>
              <p className="mt-2 text-sm font-bold text-slate-900">
                {intake?.applicationDeadline ? new Date(intake.applicationDeadline).toLocaleDateString() : "No deadline"}
              </p>
              <p className="mt-1 text-xs text-slate-500">From catalogue intake (volatile fact, provenance kept)</p>
              <Link href={`/cases/${caseId}`} className="mt-3 inline-block text-xs font-semibold text-blue-600 hover:text-blue-700">
                View case →
              </Link>
            </div>
          </div>

          {/* Create forms */}
          <div className="grid gap-6 lg:grid-cols-2">
            <CreateTaskForm caseId={caseId} />
            <CreateMilestoneForm caseId={caseId} nextOrder={nextOrder} />
          </div>

          {/* Main two-column */}
          <div className="grid gap-8 lg:grid-cols-5">
            {/* Tasks */}
            <div className="lg:col-span-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Checklist</h2>
                <span className="text-sm text-slate-600">
                  {tasks.length} task{tasks.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Deterministic tasks from course + catalogue requirements. LLM explains, rules decide. Volatile dates derive from intake deadline in the DB.
              </p>
              {tasks.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                  <p className="font-semibold text-slate-900">No tasks yet</p>
                  <p className="mt-2 text-sm text-slate-600">
                    The OS checklist builds on case creation from catalogue data. Create a task manually or re-seed via your intake.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {tasks.map((task) => (
                    <li key={task.id}>
                      <TaskCard task={task} caseId={caseId} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Milestones */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Milestones</h2>
                <span className="text-sm text-slate-600">{milestones.length} total</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">Timeline checkpoints — prepare → submit → await decision. Ordered by sortOrder.</p>
              {milestones.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
                  <p className="font-semibold text-slate-900">No milestones yet</p>
                  <p className="mt-2 text-sm text-slate-600">Milestones group progress. Create one to track your timeline.</p>
                </div>
              ) : (
                <ol className="mt-4 space-y-3">
                  {[...milestones]
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime())
                    .map((m) => (
                      <li key={m.id}>
                        <MilestoneCard milestone={m} caseId={caseId} />
                      </li>
                    ))}
                </ol>
              )}

              <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-900">How the OS works</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-800">
                  <li>Tasks are the checklist (transcript, personal statement, reference…)</li>
                  <li>Milestones are timeline checkpoints (prepare → submit → await)</li>
                  <li>Due dates derive from catalogue intakes — never hard-coded</li>
                  <li>Complete a task with evidence; complete a milestone to close a stage</li>
                </ul>
                <p className="mt-3 text-xs text-blue-700">
                  API: POST /api/cases/{caseId.slice(0, 8)}/tasks · PATCH /api/cases/{caseId.slice(0, 8)}/tasks/[id] · POST /api/cases/
                  {caseId.slice(0, 8)}/milestones
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/cases/${caseId}`}
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Back to case
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Dashboard
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
