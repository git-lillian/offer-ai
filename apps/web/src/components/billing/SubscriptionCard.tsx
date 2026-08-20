import Link from "next/link";
import type { BillingSubscription } from "@offer-ai/billing";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  past_due: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
  incomplete: "bg-blue-50 text-blue-700 border-blue-200",
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  premium: "Premium",
  pro: "Pro",
};

export function SubscriptionCard({ subscription }: { subscription: BillingSubscription }) {
  const isActive = subscription.status === "active";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">{PLAN_LABELS[subscription.planCode] ?? subscription.planCode}</h3>
          <p className="mt-1 text-sm text-slate-600">Subscription · {subscription.id.slice(0, 8)}</p>
          {subscription.stripeSubscriptionId ? (
            <p className="mt-1 text-xs text-slate-500">Stripe: {subscription.stripeSubscriptionId}</p>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[subscription.status] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}
        >
          {subscription.status.replace(/_/g, " ")}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="font-medium text-slate-500">Plan</dt>
          <dd className="mt-1 font-semibold text-slate-900">{subscription.planCode}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Period end</dt>
          <dd className="mt-1 text-slate-900">
            {subscription.currentPeriodEnd ? subscription.currentPeriodEnd.toLocaleDateString() : "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-slate-500">Created {subscription.createdAt.toLocaleDateString()}</span>
        {isActive ? (
          <span className="text-xs font-semibold text-emerald-600">Active</span>
        ) : (
          <Link href="/billing/subscriptions/new" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
            New subscription →
          </Link>
        )}
      </div>
    </div>
  );
}
