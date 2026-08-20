import Link from "next/link";
import type { BillingInvoice } from "@offer-ai/billing";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  open: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  void: "bg-red-50 text-red-700 border-red-200",
};

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function InvoiceCard({ invoice }: { invoice: BillingInvoice }) {
  return (
    <Link
      href={`/billing/invoices/${invoice.id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-900">{formatAmount(invoice.amountDue, invoice.currencyCode)}</h3>
          <p className="mt-1 text-sm text-slate-600">
            Invoice · {invoice.id.slice(0, 8)} · {invoice.currencyCode}
          </p>
          {invoice.stripeInvoiceId ? (
            <p className="mt-1 text-xs text-slate-500">Stripe: {invoice.stripeInvoiceId}</p>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[invoice.status] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}
        >
          {invoice.status}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Created {invoice.createdAt.toLocaleDateString()}</span>
        <span className="font-semibold text-blue-600">View →</span>
      </div>
    </Link>
  );
}
