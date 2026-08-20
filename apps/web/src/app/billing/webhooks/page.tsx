import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { createBillingServiceWithServiceRole } from "@/lib/services/billing";

export const metadata = {
  title: "Webhook events | Offer.ai",
};

export default async function WebhooksPage() {
  await requireUser();
  const service = createBillingServiceWithServiceRole();
  const events = await service.listAllWebhookEvents();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-6xl space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Billing</p>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Webhook events</h1>
              <p className="mt-2 max-w-2xl text-slate-600">
                Stripe webhook idempotency ledger. Events are validated with{" "}
                <span className="font-mono text-xs">stripeWebhookPayloadSchema</span> and deduplicated by
                Stripe event ID. Service-role only — RLS blocks browser writes.
              </p>
            </div>
            <Link
              href="/billing"
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Back to billing
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Recent events · {events.length}</h2>
              <p className="mt-1 text-sm text-slate-600">Admin view — shows processed and unprocessed events.</p>
            </div>

            {events.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="font-semibold text-slate-900">No webhook events yet</p>
                <p className="mt-2 text-sm text-slate-600">
                  POST to <span className="font-mono text-xs">/api/billing/webhooks</span> with a Stripe
                  event payload to populate this ledger.
                </p>
                <pre className="mx-auto mt-6 max-w-xl overflow-auto rounded-xl bg-slate-900 px-4 py-3 text-left text-xs text-slate-100">
                  {`curl -X POST /api/billing/webhooks \\
  -H "Content-Type: application/json" \\
  -d '{"id":"evt_123","type":"invoice.paid","data":{"object":{"id":"in_123"}}}'`}
                </pre>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {events.map((event) => (
                  <li key={event.id} className="px-6 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-sm font-semibold text-slate-900">
                            {event.stripeEventId}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              event.processed
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {event.processed ? "processed" : "unprocessed"}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {event.type}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">Created {event.createdAt.toLocaleString()}</p>
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-700">
                            View payload
                          </summary>
                          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                            {JSON.stringify(event.payload, null, 2)}
                          </pre>
                        </details>
                      </div>
                      <span className="font-mono text-xs text-slate-400">{event.id.slice(0, 8)}</span>
                    </div>
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
