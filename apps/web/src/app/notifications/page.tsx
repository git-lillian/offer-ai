import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Pagination } from "@/components/catalogue/pagination";
import { NotificationCard } from "@/components/notifications/NotificationCard";
import { createNotificationService } from "@/lib/services/notification";

export const metadata = {
  title: "Notifications | Offer.ai",
};

const PAGE_SIZE = 20;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const raw = await searchParams;
  const page = Math.max(1, Number(first(raw.page) ?? "1") || 1);
  const statusRaw = first(raw.status);
  const allowedStatuses = new Set(["pending", "sent", "failed"]);
  const status = statusRaw && allowedStatuses.has(statusRaw) ? statusRaw : undefined;
  const channelRaw = first(raw.channel);
  const allowedChannels = new Set(["email", "push", "in_app"]);
  const channel = channelRaw && allowedChannels.has(channelRaw) ? channelRaw : undefined;

  const service = await createNotificationService();
  let notifications: Awaited<ReturnType<typeof service.listNotificationsForUser>>["notifications"] = [];
  let total = 0;
  let error: string | null = null;

  try {
    const result = await service.listNotificationsForUser(user.id, {
      limit: PAGE_SIZE,
      page,
      status,
      channel,
    });
    notifications = result.notifications;
    total = result.total;
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load notifications.";
  }

  const pendingCount = notifications.filter((n) => n.status === "pending").length;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-4xl space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Inbox</p>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Notifications</h1>
              <p className="mt-2 max-w-2xl text-slate-600">
                Delivery abstraction for deadline monitoring, course updates, marketplace messages, billing events and system alerts. Mark pending messages as sent or failed.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/notifications/preferences"
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Preferences
              </Link>
              <Link
                href="/notifications/watches"
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Watches
              </Link>
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <form method="get" className="flex flex-wrap gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Status</span>
                <select
                  name="status"
                  defaultValue={status ?? ""}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Any status</option>
                  <option value="pending">pending</option>
                  <option value="sent">sent</option>
                  <option value="failed">failed</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Channel</span>
                <select
                  name="channel"
                  defaultValue={channel ?? ""}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Any channel</option>
                  <option value="email">email</option>
                  <option value="push">push</option>
                  <option value="in_app">in_app</option>
                </select>
              </label>
              <div className="flex items-end gap-2">
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  Filter
                </button>
                <Link href="/notifications" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Clear
                </Link>
              </div>
              <span className="self-center text-xs text-slate-500">{total} total · {pendingCount} pending on this page</span>
            </form>
            <p className="mt-3 text-xs text-slate-500">GET /api/notifications?limit=20&page=1&amp;status=pending · POST /api/notifications with createNotificationSchema (user derived from session)</p>
          </div>

          {error ? (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {notifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <p className="font-semibold text-slate-900">No notifications</p>
              <p className="mt-2 text-sm text-slate-600">You&apos;re all caught up. Deadline watches and system events will appear here as in_app notifications.</p>
              <div className="mt-6 flex justify-center gap-3">
                <Link href="/notifications/watches" className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700">
                  Manage watches
                </Link>
                <Link href="/dashboard" className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50">
                  Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Showing {notifications.length} of {total} · Page {page} · Pending on page: {pendingCount}
              </p>
              {notifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} />
              ))}
            </div>
          )}

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} href={buildBaseHref({ status, channel })} />

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">How delivery works</h2>
            <p className="mt-2 text-sm text-slate-600">
              Notifications are created by the server/worker via the provider abstraction (packages/notifications). RLS restricts reads to your user_id. Email/push respect your preferences; in_app is always deliverable to inbox.
            </p>
            <ul className="mt-3 list-disc pl-6 text-sm text-slate-600 space-y-1">
              <li>Channel disabled? sendNotification returns pending unchanged — worker skips.</li>
              <li>Marking sent sets status sent and sent_at (checked: sent requires sent_at).</li>
              <li>Marking failed clears sent_at.</li>
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}

function buildBaseHref(params: { status?: string; channel?: string }): string {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.channel) sp.set("channel", params.channel);
  const qs = sp.toString();
  return qs ? `/notifications?${qs}` : "/notifications";
}
