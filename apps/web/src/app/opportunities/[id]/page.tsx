import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";
import { OpportunityRepository, StudentProfileRepository, StudentOpportunityRepository } from "@offer-ai/database";
import { Navbar } from "@/components/navbar";
import { SaveOpportunityButton } from "@/components/experience/save-button";
import { getOptionalUser } from "@/lib/auth";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerClient();
  const repo = new OpportunityRepository(supabase);
  const opp = await repo.findById(id);
  if (!opp) return { title: "Opportunity not found | Offer.ai" };
  return { title: `${opp.title} | Offer.ai` };
}

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getServerClient();
  const repo = new OpportunityRepository(supabase);
  const opportunity = await repo.findById(id);
  if (!opportunity) notFound();

  const user = await getOptionalUser();
  let isSaved = false;
  if (user) {
    try {
      const profileRepo = new StudentProfileRepository(supabase);
      const profile = await profileRepo.findByUserId(user.id);
      if (profile) {
        const savedRepo = new StudentOpportunityRepository(supabase);
        isSaved = await savedRepo.isSaved(profile.id, opportunity.id);
      }
    } catch {
      isSaved = false;
    }
  }

  const typeLabel: Record<string, string> = {
    internship: "Internship",
    volunteering: "Volunteering",
    course: "Course",
    competition: "Competition",
    research: "Research",
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-4xl space-y-8">
          <Link href="/opportunities" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
            ← Back to opportunities
          </Link>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {typeLabel[opportunity.opportunityType] ?? opportunity.opportunityType}
                  </span>
                  {opportunity.isRemote ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Remote
                    </span>
                  ) : null}
                  {opportunity.locationCountryCode ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                      {opportunity.locationCountryCode}
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-4 text-3xl font-bold text-slate-900">{opportunity.title}</h1>
                <p className="mt-2 text-sm text-slate-600">
                  Provider: <span className="font-semibold text-slate-900">{opportunity.providerName}</span>
                  {opportunity.durationMonths !== null ? ` · ${opportunity.durationMonths} months` : ""}
                  {` · Created ${opportunity.createdAt.toISOString().slice(0, 10)}`}
                </p>
              </div>
              {user ? (
                <SaveOpportunityButton opportunityId={opportunity.id} isSaved={isSaved} />
              ) : (
                <Link
                  href="/login"
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Log in to save
                </Link>
              )}
            </div>

            <div className="mt-8 border-t border-slate-100 pt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Description</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {opportunity.description || "No description provided for this opportunity."}
              </p>
            </div>

            {opportunity.url ? (
              <div className="mt-8">
                <a
                  href={opportunity.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Apply / Visit provider ↗
                </a>
                <p className="mt-2 text-xs text-slate-500">External link: {opportunity.url}</p>
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-100 pt-6 text-sm">
              <Link
                href={`/opportunities?opportunityType=${encodeURIComponent(opportunity.opportunityType)}`}
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                More {opportunity.opportunityType} opportunities →
              </Link>
              <span className="text-slate-300">·</span>
              <Link href="/experiences" className="font-medium text-slate-600 hover:text-slate-900">
                Gap analysis
              </Link>
            </div>
          </div>

          {!user ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <p className="text-sm font-semibold text-amber-800">Want to save this?</p>
              <p className="mt-1 text-sm text-amber-700">
                Create an account to save opportunities and get personalised gap analysis.
              </p>
              <div className="mt-4 flex gap-3">
                <Link
                  href="/register"
                  className="rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Get started
                </Link>
                <Link
                  href="/login"
                  className="rounded-lg border border-amber-300 bg-white px-5 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Log in
                </Link>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}
