import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ApplicationCaseRepository,
  CourseRepository,
  InstitutionRepository,
  StudentProfileRepository,
} from "@offer-ai/database";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { ApplicationOsService } from "@/lib/services/application-os";
import { TaskCard } from "@/components/application-os/TaskCard";
import { CreateTaskForm } from "@/components/application-os/CreateTaskForm";

export const metadata = {
  title: "Tasks | Offer.ai",
};

export default async function CaseTasksPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const user = await requireUser();
  const supabase = await getServerClient();

  const caseRepo = new ApplicationCaseRepository(supabase);
  const applicationCase = await caseRepo.findById(caseId);
  if (!applicationCase) notFound();

  const profile = await new StudentProfileRepository(supabase).findByUserId(user.id);
  if (applicationCase.studentId !== (profile?.id ?? "")) notFound();

  const osService = new ApplicationOsService(supabase);
  const tasks = await osService.listTasks(caseId, user.id).catch(() => []);

  const [institution, course] = await Promise.all([
    new InstitutionRepository(supabase).findById(applicationCase.institutionId),
    new CourseRepository(supabase).findById(applicationCase.courseId),
  ]);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-4xl space-y-8">
          <div>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/dashboard" className="font-semibold text-blue-600 hover:text-blue-700">
                ← Dashboard
              </Link>
              <span className="text-slate-300">·</span>
              <Link href={`/cases/${caseId}`} className="font-semibold text-slate-600 hover:text-slate-900">
                ← Case
              </Link>
              <span className="text-slate-300">·</span>
              <Link href={`/cases/${caseId}/os`} className="font-semibold text-blue-600 hover:text-blue-700">
                Application OS
              </Link>
            </div>
            <h1 className="mt-4 text-3xl font-bold text-slate-900">Tasks</h1>
            <p className="mt-2 text-slate-600">
              {course?.title ?? "Course"} {institution ? `· ${institution.name}` : ""} — {tasks.length} task
              {tasks.length === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              This is the task slice of the Application OS. For milestones and overview, open the OS cockpit.
            </p>
          </div>

          <CreateTaskForm caseId={caseId} />

          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Checklist</h2>
              <Link href={`/cases/${caseId}/os`} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                Open OS →
              </Link>
            </div>
            {tasks.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <p className="font-semibold text-slate-900">No tasks yet</p>
                <p className="mt-2 text-sm text-slate-600">Create your first task or visit the OS to seed the checklist from catalogue data.</p>
                <Link
                  href={`/cases/${caseId}/os`}
                  className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  Go to Application OS
                </Link>
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

          <div className="flex gap-3">
            <Link href={`/cases/${caseId}/os`} className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
              Open Application OS
            </Link>
            <Link
              href={`/cases/${caseId}`}
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to case
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
