import type { Notification } from "@offer-ai/notifications";
import { markSentAction, markFailedAction } from "@/app/notifications/actions";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

const CHANNEL_STYLES: Record<string, string> = {
  email: "bg-blue-50 text-blue-700 border-blue-200",
  push: "bg-purple-50 text-purple-700 border-purple-200",
  in_app: "bg-slate-100 text-slate-700 border-slate-200",
};

const TYPE_LABELS: Record<string, string> = {
  deadline: "Deadline",
  application: "Application",
  marketplace: "Marketplace",
  billing: "Billing",
  system: "System",
};

export function NotificationCard({ notification }: { notification: Notification }) {
  const isPending = notification.status === "pending";
  const isSent = notification.status === "sent";
  const isFailed = notification.status === "failed";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[notification.status] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}
          >
            {notification.status}
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${CHANNEL_STYLES[notification.channel] ?? "bg-slate-100 text-slate-700"}`}
          >
            {notification.channel}
          </span>
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
            {TYPE_LABELS[notification.notificationType] ?? notification.notificationType}
          </span>
        </div>
        <span className="text-xs text-slate-500">{notification.createdAt.toLocaleDateString()}</span>
      </div>

      <h3 className="mt-4 text-base font-bold text-slate-900">{notification.title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{notification.body}</p>

      <dl className="mt-4 grid grid-cols-2 gap-4 text-xs">
        <div>
          <dt className="font-medium text-slate-500">Scheduled</dt>
          <dd className="mt-1 text-slate-900">{notification.scheduledAt.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Sent</dt>
          <dd className="mt-1 text-slate-900">{notification.sentAt ? notification.sentAt.toLocaleString() : "—"}</dd>
        </div>
      </dl>

      {Object.keys(notification.payload).length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900">Payload</summary>
          <pre className="mt-2 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
            {JSON.stringify(notification.payload, null, 2)}
          </pre>
        </details>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {isPending ? (
          <>
            <form action={markSentAction as unknown as (formData: FormData) => Promise<void>}>
              <input type="hidden" name="notificationId" value={notification.id} />
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Mark sent
              </button>
            </form>
            <form action={markFailedAction as unknown as (formData: FormData) => Promise<void>}>
              <input type="hidden" name="notificationId" value={notification.id} />
              <button
                type="submit"
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                Mark failed
              </button>
            </form>
          </>
        ) : null}
        {isSent ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Delivered</span> : null}
        {isFailed ? (
          <form action={markSentAction as unknown as (formData: FormData) => Promise<void>}>
            <input type="hidden" name="notificationId" value={notification.id} />
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Retry · Mark sent
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
