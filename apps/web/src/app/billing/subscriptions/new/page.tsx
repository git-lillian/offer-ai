import { requireUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { createBillingService } from "@/lib/services/billing";
import { CreateSubscriptionForm } from "./create-subscription-form";

export const metadata = {
  title: "New subscription | Offer.ai",
};

export default async function NewSubscriptionPage() {
  const user = await requireUser();
  const service = await createBillingService();
  const customer = await service.getCustomerForUser(user.id);

  // Ensure we have a customer id to display; form will auto-create if missing
  const customerId = customer?.id ?? "";

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-2xl space-y-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Billing</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">Create subscription</h1>
            <p className="mt-2 text-slate-600">
              Choose a plan for premium Offer.ai features. This is independent from marketplace
              service purchases.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {customer ? (
              <p className="mb-4 text-sm text-slate-600">
                Billing customer: <span className="font-mono text-xs">{customer.id.slice(0, 8)}</span>
              </p>
            ) : (
              <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                No billing customer yet — one will be created automatically when you subscribe.
              </p>
            )}

            <CreateSubscriptionForm customerId={customerId} />
          </div>
        </section>
      </main>
    </>
  );
}
