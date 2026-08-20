import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { VersionList } from "@/components/artifacts/version-list";
import { CommentList } from "@/components/artifacts/comment-list";
import { ArtifactApplicationService } from "@/lib/services/artifact";

export const metadata = {
  title: "Artifact | Offer.ai",
};

const TYPE_LABELS: Record<string, string> = {
  cv: "CV",
  personal_statement: "Personal statement",
  statement_of_purpose: "Statement of purpose",
  supplementary_answer: "Supplementary answer",
  reference_draft: "Reference draft",
  portfolio_text: "Portfolio text",
  application_note: "Application note",
};

const STATE_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  in_review: "bg-amber-50 text-amber-700",
  approved: "bg-green-50 text-green-700",
  submitted: "bg-blue-50 text-blue-700",
};

export default async function ArtifactDetailPage({
  params,
}: {
  params: Promise<{ artifactId: string }>;
}) {
  const { artifactId } = await params;
  const user = await requireUser();
  const supabase = await getServerClient();
  const service = new ArtifactApplicationService(supabase);

  let data: Awaited<ReturnType<typeof service.getByIdForUser>> | null = null;
  try {
    data = await service.getByIdForUser(user.id, artifactId);
  } catch {
    notFound();
  }

  if (!data) {
    notFound();
  }

  const { artifact, versions, comments } = data;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-4xl space-y-8">
          <div>
            <Link
              href="/artifacts"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              ← Back to Document Studio
            </Link>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
                  {TYPE_LABELS[artifact.artifactType] ?? artifact.artifactType.replace(/_/g, " ")}
                </p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">{artifact.title}</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Created {artifact.createdAt.toLocaleString()} · Updated{" "}
                  {artifact.updatedAt.toLocaleString()}
                  {artifact.caseId ? ` · Linked case ${artifact.caseId.slice(0, 8)}` : ""}
                </p>
              </div>
              <span className={`rounded-full px-4 py-2 text-sm font-semibold ${STATE_STYLES[artifact.approvalState]}`}>
                {artifact.approvalState.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Versions</h2>
            <p className="mt-1 text-sm text-slate-600">
              Immutable history. Approve to move a version to approved, or send it back to draft for
              further edits. Submitted versions are final.
            </p>
            <div className="mt-6">
              <VersionList artifactId={artifact.id} versions={versions} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Comments</h2>
            <p className="mt-1 text-sm text-slate-600">
              Per-version feedback from you and collaborators. Comments are tied to a version number.
            </p>
            <div className="mt-6">
              <CommentList artifactId={artifact.id} comments={comments} versions={versions} />
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              href="/artifacts"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← All documents
            </Link>
            <Link
              href="/artifacts/new"
              className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              New document
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
