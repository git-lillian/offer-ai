import Link from "next/link";
import { Button } from "@offer-ai/ui";

const PLANS = [
  {
    code: "free" as const,
    name: "Free",
    price: "£0",
    period: "forever",
    features: ["basic_search"],
    cta: "Current",
  },
  {
    code: "premium" as const,
    name: "Premium",
    price: "£9",
    period: "/month",
    features: ["basic_search", "premium_articles", "ai_assistance"],
    cta: "Upgrade to Premium",
  },
  {
    code: "pro" as const,
    name: "Pro",
    price: "£29",
    period: "/month",
    features: ["basic_search", "premium_articles", "ai_assistance", "adviser_access", "priority_support"],
    cta: "Upgrade to Pro",
  },
];

const FEATURE_LABELS: Record<string, string> = {
  basic_search: "Basic search",
  premium_articles: "Premium articles",
  ai_assistance: "AI assistance",
  adviser_access: "Adviser access",
  priority_support: "Priority support",
};

export function PlanComparison({ currentPlan }: { currentPlan?: string | null }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {PLANS.map((plan) => {
        const isCurrent = currentPlan === plan.code;
        return (
          <div
            key={plan.code}
            className={`rounded-2xl border p-6 shadow-sm ${isCurrent ? "border-blue-300 bg-blue-50/50 ring-1 ring-blue-200" : "border-slate-200 bg-white"}`}
          >
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
              {isCurrent ? (
                <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">Current</span>
              ) : null}
            </div>
            <p className="mt-3">
              <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
              <span className="text-sm text-slate-500">{plan.period}</span>
            </p>

            <ul className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700">✓</span>
                  {FEATURE_LABELS[feature] ?? feature}
                </li>
              ))}
              {/* Show missing features as disabled for free/premium */}
              {plan.code !== "pro"
                ? ["adviser_access", "priority_support"]
                    .filter((f) => !plan.features.includes(f))
                    .map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-400">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400">·</span>
                        {FEATURE_LABELS[f] ?? f}
                      </li>
                    ))
                : null}
              {plan.code === "free"
                ? ["premium_articles", "ai_assistance"]
                    .filter((f) => !plan.features.includes(f))
                    .map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-400">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400">·</span>
                        {FEATURE_LABELS[f] ?? f}
                      </li>
                    ))
                : null}
            </ul>

            <div className="mt-8">
              {isCurrent ? (
                <Button variant="secondary" className="w-full" disabled>
                  Current plan
                </Button>
              ) : (
                <Link href="/billing/subscriptions/new">
                  <Button variant={plan.code === "pro" ? "primary" : "secondary"} className="w-full">
                    {plan.cta}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
