import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { CreateProviderForm } from "@/components/marketplace/create-provider-form";
import { ProviderProfileRepository } from "@offer-ai/database";
import Link from "next/link";

export const metadata = {
  title: "Become a provider | Offer.ai",
};

export default async function NewProviderPage() {
  const user = await requireUser();
  const supabase = await getServerClient();
  const repo = new ProviderProfileRepository(supabase);
  const existing = await repo.findByUserId(user.id);

  if (existing) {
    redirect(`/marketplace/providers/${existing.id}`);
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-2xl space-y-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Marketplace</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">Become a provider</h1>
            <p className="mt-2 text-slate-600">
              Create a provider profile to offer services. You remain a student — provider access does not
              grant automatic access to student data. Fulfilment uses explicit access grants.
            </p>
            <div className="mt-4 flex gap-3 text-sm">
              <Link href="/marketplace" className="font-medium text-slate-600 hover:text-slate-900">
                ← Back to marketplace
              </Link>
              <span className="text-slate-300">·</span>
              <Link href="/marketplace/bookings" className="font-medium text-blue-600 hover:text-blue-700">
                My bookings
              </Link>
            </div>
          </div>

          <CreateProviderForm />

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-600">
            <p className="font-semibold text-slate-900">What happens next?</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Your profile starts as pending. Verification is handled by Offer.ai.</li>
              <li>Once ready, create service listings (price, currency, turnaround, scope).</li>
              <li>Students discover and book your services; you manage bookings and orders.</li>
              <li>Payouts and commission are separate from subscriptions (billing).</li>
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
