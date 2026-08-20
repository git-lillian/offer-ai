import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { createBillingService } from "@/lib/services/billing";
import { isBillingError } from "@offer-ai/billing";

export const metadata = {
  title: "Invoice | Offer.ai",
};

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const user = await requireUser();
  const service = await createBillingService();

  let invoice;
  try {
    invoice = await service.getInvoiceByIdForUser(user.id, invoiceId);
  } catch (error) {
    if (isBillingError(error) && error.statusCode === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-3xl space-y-8">
          <div>
            <Link href="/billing" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              ← Back to billing
            </Link>
            <p className="mt-4 text-sm font-semibold uppercase tracking-widest text-blue-600">Billing</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">Invoice {invoice.id.slice(0, 8)}</h1>
            <p className="mt-2 text-slate-600">Invoice details and billing record.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Amount due</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {formatAmount(invoice.amountDue, invoice.currencyCode)}
                </p>
                <p className="mt-2 text-sm text-slate-600">Currency: {invoice.currencyCode}</p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  invoice.status === "paid"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : invoice.status === "open"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : invoice.status === "void"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                {invoice.status}
              </span>
            </div>

            <dl className="mt-8 grid gap-6 sm:grid-cols-2 text-sm">
              <div>
                <dt className="font-medium text-slate-500">Invoice ID</dt>
                <dd className="mt-1 font-mono text-xs text-slate-900">{invoice.id}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Customer ID</dt>
                <dd className="mt-1 font-mono text-xs text-slate-900">{invoice.customerId.slice(0, 8)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Stripe invoice ID</dt>
                <dd className="mt-1 font-mono text-xs text-slate-900">{invoice.stripeInvoiceId ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Created</dt>
                <dd className="mt-1 text-slate-900">{invoice.createdAt.toLocaleString()}</dd>
              </div>
            </dl>

            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">About invoices</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Invoices are separate from marketplace orders. An invoice represents a SaaS subscription
                charge; marketplace commissions live in <span className="font-mono text-xs">packages/domain</span>.
                Never merged into a single payments flag.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
