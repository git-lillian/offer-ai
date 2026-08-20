import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { ArtifactCard } from "@/components/artifacts/artifact-card";
import { ArtifactApplicationService } from "@/lib/services/artifact";

export const metadata = {
  title: "Document Studio | Offer.ai",
};

export default async function ArtifactsPage() {
  const user = await requireUser();
  const supabase = await getServerClient();
  const service = new ArtifactApplicationService(supabase);

  let artifacts: Awaited<ReturnType<typeof service.listForUser>> = [];
  let error: string | null = null;

  try {
    artifacts = await service.listForUser(user.id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load artifacts.";
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-6xl space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
                Document Studio
              </p>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Your documents</h1>
              <p className="mt-2 max-w-2xl text-slate-600">
                Versioned artifacts for CVs, personal statements, SOPs and supplementary answers.
                Every version is immutable — collaborators leave feedback per version and approval
                moves through draft → in review → approved → submitted.
              </p>
            </div>
            <Link
              href="/artifacts/new"
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              New document
            </Link>
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          ) : null}

          {artifacts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <p className="font-semibold text-slate-900">No documents yet</p>
              <p className="mt-2 text-sm text-slate-600">
                Create your first artifact — a CV, personal statement or SOP — and start versioning.
              </p>
              <Link
                href="/artifacts/new"
                className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Create your first document
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-600">
                {artifacts.length} document{artifacts.length === 1 ? "" : "s"}
              </p>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {artifacts.map((artifact) => (
                  <li key={artifact.id}>
                    <ArtifactCard artifact={artifact} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Dashboard
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
