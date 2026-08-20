import Link from "next/link";
import type { Artifact } from "@offer-ai/domain";

const TYPE_LABELS: Record<Artifact["artifactType"], string> = {
  cv: "CV",
  personal_statement: "Personal statement",
  statement_of_purpose: "Statement of purpose",
  supplementary_answer: "Supplementary answer",
  reference_draft: "Reference draft",
  portfolio_text: "Portfolio text",
  application_note: "Application note",
};

const STATE_STYLES: Record<Artifact["approvalState"], string> = {
  draft: "bg-slate-100 text-slate-700",
  in_review: "bg-amber-50 text-amber-700",
  approved: "bg-green-50 text-green-700",
  submitted: "bg-blue-50 text-blue-700",
};

export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  return (
    <Link
      href={`/artifacts/${artifact.id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate font-bold text-slate-900">{artifact.title}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {TYPE_LABELS[artifact.artifactType] ?? artifact.artifactType.replace(/_/g, " ")}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATE_STYLES[artifact.approvalState]}`}
        >
          {artifact.approvalState.replace(/_/g, " ")}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Created {artifact.createdAt.toLocaleDateString()}</span>
        <span className="font-medium text-blue-600">View →</span>
      </div>
    </Link>
  );
}
