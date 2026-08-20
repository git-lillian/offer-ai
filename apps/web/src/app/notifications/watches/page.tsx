import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { WatchCard } from "@/components/notifications/WatchCard";
import { CreateWatchForm } from "@/components/notifications/CreateWatchForm";
import { createNotificationService } from "@/lib/services/notification";

export const metadata = {
  title: "Deadline watches | Offer.ai",
};

export default async function NotificationWatchesPage() {
  const user = await requireUser();
  const service = await createNotificationService();

  let watches: Awaited<ReturnType<typeof service.listWatchesForUser>> = [];
  let preference: Awaited<ReturnType<typeof service.getPreferencesForUser>> = null;
  let error: string | null = null;

  try {
    watches = await service.listWatchesForUser(user.id);
    preference = await service.getPreferencesForUser(user.id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load watches.";
  }

  // Try to surface student profile requirement
  const hasStudentProfile = true; // service returns [] if no profile; we can't know distinction without throwing; keep UI friendly
  void hasStudentProfile;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-4xl space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Deadline monitoring</p>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Deadline watches</h1>
              <p className="mt-2 max-w-2xl text-slate-600">
                Watch a course intake&apos;s application deadline or availability. next_reminder_at is computed from the intake&apos;s application_deadline (with source provenance) and your reminder offsets.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/notifications" className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Inbox
              </Link>
              <Link href="/notifications/preferences" className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Preferences
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Your reminder offsets</h2>
            <p className="mt-2 text-sm text-slate-900">
              {preference ? preference.deadlineReminderDays.join(", ") + " days" : "Default: 7, 3, 1 days"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Edit in preferences · used as (deadline − days) candidates, earliest future chosen.</p>
            {!preference ? (
              <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">No preferences yet — defaults will be used until you save.</p>
            ) : null}
          </div>

          {error ? (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <CreateWatchForm />

          {watches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <p className="font-semibold text-slate-900">No watches yet</p>
              <p className="mt-2 text-sm text-slate-600">Create a watch for a course intake to get deadline reminders. Requires a student profile (complete onboarding first).</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">{watches.length} watch{watches.length === 1 ? "" : "es"}</p>
              <ul className="grid gap-4 sm:grid-cols-2">
                {watches.map((watch) => (
                  <li key={watch.id}>
                    <WatchCard watch={watch} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">How it works</h2>
            <ul className="mt-3 list-disc pl-6 text-sm text-slate-600 space-y-1">
              <li>Volatile facts: application_deadline lives in catalog_course_intakes with fee_source_id and observed_at provenance — never hard-coded.</li>
              <li>next_reminder_at = earliest future (deadline − days) ≥ now; null if deadline is null/past or all offsets are in the past.</li>
              <li>Unique on (student_id, course_intake_id, watch_type); RLS ensures is_student_owner.</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Link href="/notifications" className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
              ← Notifications inbox
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
