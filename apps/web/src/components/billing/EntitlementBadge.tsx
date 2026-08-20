import type { BillingEntitlement } from "@offer-ai/billing";

function isExpired(entitlement: BillingEntitlement, now: Date = new Date()): boolean {
  return entitlement.expiresAt !== null && entitlement.expiresAt.getTime() <= now.getTime();
}

export function EntitlementBadge({ entitlement }: { entitlement: BillingEntitlement }) {
  const expired = isExpired(entitlement);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
        expired
          ? "bg-slate-100 text-slate-500 border-slate-200"
          : "bg-blue-50 text-blue-700 border-blue-200"
      }`}
      title={expired ? `Expired ${entitlement.expiresAt?.toLocaleDateString()}` : `Granted ${entitlement.grantedAt.toLocaleDateString()}`}
    >
      <span className={`h-2 w-2 rounded-full ${expired ? "bg-slate-400" : "bg-blue-600"}`} />
      {entitlement.featureCode}
      {entitlement.expiresAt ? (
        <span className="font-normal text-slate-500">· {expired ? "expired" : "until"} {entitlement.expiresAt.toLocaleDateString()}</span>
      ) : null}
    </span>
  );
}

export function EntitlementList({ entitlements }: { entitlements: BillingEntitlement[] }) {
  if (entitlements.length === 0) {
    return <p className="text-sm text-slate-500">No entitlements yet. Upgrade your plan to unlock features.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {entitlements.map((entitlement) => (
        <EntitlementBadge key={entitlement.id} entitlement={entitlement} />
      ))}
    </div>
  );
}
