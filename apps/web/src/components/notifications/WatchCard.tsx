import type { DeadlineWatch } from "@offer-ai/notifications";
import { deleteWatchAction } from "@/app/notifications/actions";

export function WatchCard({ watch }: { watch: DeadlineWatch }) {
  const hasReminder = watch.nextReminderAt !== null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">
            {watch.watchType === "deadline" ? "Deadline watch" : "Availability watch"}
          </h3>
          <p className="mt-1 text-xs font-mono text-slate-500">Watch {watch.id.slice(0, 8)} · Intake {watch.courseIntakeId.slice(0, 8)}</p>
          <p className="mt-1 text-xs text-slate-500">Student {watch.studentId.slice(0, 8)} · Type {watch.watchType}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
            hasReminder ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-600 border-slate-200"
          }`}
        >
          {hasReminder ? "Scheduled" : "No reminder"}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-xs font-medium text-slate-500">Next reminder</dt>
          <dd className="mt-1 font-semibold text-slate-900">{watch.nextReminderAt ? watch.nextReminderAt.toLocaleString() : "—"}</dd>
          {hasReminder ? <p className="mt-1 text-xs text-slate-500">Computed from intake deadline minus your reminder offsets.</p> : <p className="mt-1 text-xs text-slate-500">Deadline is past, unknown, or all offsets are in the past.</p>}
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Created</dt>
          <dd className="mt-1 text-slate-900">{watch.createdAt.toLocaleDateString()}</dd>
        </div>
      </dl>

      <div className="mt-4 flex gap-2">
        <form action={deleteWatchAction as unknown as (formData: FormData) => Promise<void>}>
          <input type="hidden" name="watchId" value={watch.id} />
          <button type="submit" className="rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
            Remove watch
          </button>
        </form>
      </div>
    </div>
  );
}
