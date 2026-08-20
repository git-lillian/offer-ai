import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { PreferenceForm } from "@/components/notifications/PreferenceForm";
import { createNotificationService } from "@/lib/services/notification";

export const metadata = {
  title: "Notification preferences | Offer.ai",
};

export default async function NotificationPreferencesPage() {
  const user = await requireUser();
  const service = await createNotificationService();
  let preference: Awaited<ReturnType<typeof service.getPreferencesForUser>> = null;
  let error: string | null = null;

  try {
    preference = await service.getPreferencesForUser(user.id);
    if (!preference) {
      // Ensure defaults exist for display — will be created on first save if missing
      preference = await service.ensurePreferencesForUser(user.id);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load preferences.";
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-3xl space-y-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Settings</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">Notification preferences</h1>
            <p className="mt-2 text-slate-600">
              Per-user opt-in and deadline reminder offsets. These feed into deadline_watches&apos; next_reminder_at calculation. Validated with zod at every boundary.
            </p>
          </div>

          {error ? (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <PreferenceForm preference={preference} />

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">How reminders are scheduled</h2>
            <p className="mt-2 text-sm text-slate-600">
              Volatile facts (deadlines) live in the catalogue with provenance. For each watch, next_reminder_at is the earliest future date among (deadline − days) that is ≥ now. If all candidates are in the past or deadline is null/past, next_reminder_at is null.
            </p>
            <p className="mt-3 text-xs text-slate-500">GET /api/notifications/preferences · PUT /api/notifications/preferences with updateNotificationPreferenceSchema · GET /api/notifications/watches · POST /api/notifications/watches</p>
          </div>

          <div className="flex gap-3">
            <Link href="/notifications" className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
              ← Inbox
            </Link>
            <Link href="/notifications/watches" className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Watches →
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
