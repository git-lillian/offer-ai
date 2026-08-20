import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import { InvoiceCard } from "@/components/billing/InvoiceCard";
import { EntitlementList } from "@/components/billing/EntitlementBadge";
import { PlanComparison } from "@/components/billing/PlanComparison";
import { createBillingService } from "@/lib/services/billing";

export const metadata = {
  title: "Billing | Offer.ai",
};

export default async function BillingPage() {
  const user = await requireUser();
  const service = await createBillingService();
  const overview = await service.getOverviewForUser(user.id);

  const currentSubscription =
    overview.subscriptions.find((s) => s.status === "active") ?? overview.subscriptions[0] ?? null;

  const hasCustomer = overview.customer !== null;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-6xl space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Billing</p>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Billing overview</h1>
              <p className="mt-2 max-w-2xl text-slate-600">
                Platform subscriptions are separate from marketplace transactions. Manage your premium
                Offer.ai features, entitlements and invoices here.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/billing/subscriptions/new"
                className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                New subscription
              </Link>
              <Link
                href="/billing/webhooks"
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Webhook events
              </Link>
            </div>
          </div>

          {/* Customer */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Billing customer</h2>
            {hasCustomer ? (
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs text-slate-700">
                  {overview.customer!.id.slice(0, 8)}
                </span>
                <span>
                  User: <span className="font-mono text-xs">{overview.customer!.userId.slice(0, 8)}</span>
                </span>
                <span>Stripe: {overview.customer!.stripeCustomerId ?? "—"}</span>
                <span>Created {overview.customer!.createdAt.toLocaleDateString()}</span>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800">No billing customer yet</p>
                <p className="mt-1 text-sm text-amber-700">
                  You have not set up billing. A customer record will be created when you start a
                  subscription.
                </p>
                <Link
                  href="/billing/subscriptions/new"
                  className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Start with a subscription
                </Link>
              </div>
            )}
          </div>

          {/* Current subscription */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Current subscription</h2>
              <Link href="/billing/subscriptions/new" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                Manage →
              </Link>
            </div>
            <div className="mt-6">
              {currentSubscription ? (
                <SubscriptionCard subscription={currentSubscription} />
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                  <p className="font-semibold text-slate-900">No subscription yet</p>
                  <p className="mt-2 text-sm text-slate-600">Choose a plan below to get started.</p>
                </div>
              )}
            </div>

            {overview.subscriptions.length > 1 ? (
              <div className="mt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">All subscriptions</h3>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {overview.subscriptions.map((sub) => (
                    <li key={sub.id}>
                      <SubscriptionCard subscription={sub} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {/* Entitlements */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Entitlements</h2>
              <span className="text-sm text-slate-500">{overview.entitlements.length} granted</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Features unlocked by your subscription. Marketplace purchases remain separate.
            </p>
            <div className="mt-6">
              <EntitlementList entitlements={overview.entitlements} />
            </div>
          </div>

          {/* Invoices */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Invoices</h2>
              <span className="text-sm text-slate-500">{overview.invoices.length} total</span>
            </div>
            {overview.invoices.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                <p className="font-semibold text-slate-900">No invoices</p>
                <p className="mt-2 text-sm text-slate-600">Invoices will appear here after checkout.</p>
              </div>
            ) : (
              <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {overview.invoices.map((invoice) => (
                  <li key={invoice.id}>
                    <InvoiceCard invoice={invoice} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Plan comparison */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Plan comparison</h2>
            <p className="mt-2 text-sm text-slate-600">
              Compare Free, Premium and Pro. Marketplace transactions are billed separately with a
              platform fee — never merged into a single payments boolean.
            </p>
            <div className="mt-6">
              <PlanComparison currentPlan={currentSubscription?.planCode ?? "free"} />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
