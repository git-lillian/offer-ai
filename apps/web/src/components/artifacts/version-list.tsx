"use client";

import { useActionState } from "react";
import { Button, TextArea, Select } from "@offer-ai/ui";
import type { ArtifactVersion } from "@offer-ai/domain";
import {
  createVersionAction,
  approveVersionAction,
  rejectVersionAction,
} from "@/app/artifacts/actions";

const STATE_STYLES: Record<ArtifactVersion["approvalState"], string> = {
  draft: "bg-slate-100 text-slate-700",
  in_review: "bg-amber-50 text-amber-700",
  approved: "bg-green-50 text-green-700",
  submitted: "bg-blue-50 text-blue-700",
};

function ApproveRejectButtons({
  artifactId,
  version,
}: {
  artifactId: string;
  version: ArtifactVersion;
}) {
  const [approveState, approveAction, approvePending] = useActionState(approveVersionAction, {});
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectVersionAction, {});

  const canApprove = version.approvalState === "draft" || version.approvalState === "in_review";
  const canReject = version.approvalState === "in_review" || version.approvalState === "approved";

  if (!canApprove && !canReject) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-3">
      {canApprove ? (
        <form action={approveAction}>
          <input type="hidden" name="artifactId" value={artifactId} />
          <input type="hidden" name="versionId" value={version.id} />
          <Button type="submit" size="sm" disabled={approvePending}>
            {approvePending ? "Approving…" : "Approve"}
          </Button>
          {approveState.error ? (
            <p role="alert" className="mt-2 text-xs text-red-700">
              {approveState.error}
            </p>
          ) : null}
        </form>
      ) : null}
      {canReject ? (
        <form action={rejectAction}>
          <input type="hidden" name="artifactId" value={artifactId} />
          <input type="hidden" name="versionId" value={version.id} />
          <Button type="submit" size="sm" variant="secondary" disabled={rejectPending}>
            {rejectPending ? "Rejecting…" : "Send back to draft"}
          </Button>
          {rejectState.error ? (
            <p role="alert" className="mt-2 text-xs text-red-700">
              {rejectState.error}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

export function VersionList({
  artifactId,
  versions,
}: {
  artifactId: string;
  versions: ArtifactVersion[];
}) {
  const [state, formAction, pending] = useActionState(createVersionAction, {});

  if (versions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-sm font-semibold text-slate-900">No versions yet</p>
          <p className="mt-1 text-sm text-slate-600">
            Create the first version to start drafting this artifact.
          </p>
        </div>
        <CreateVersionForm
          artifactId={artifactId}
          state={state}
          formAction={formAction}
          pending={pending}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-4">
        {versions
          .slice()
          .sort((a, b) => b.versionNumber - a.versionNumber)
          .map((version) => (
            <li key={version.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">Version {version.versionNumber}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {version.origin} · {version.createdAt.toLocaleString()} · by {version.creatorUserId.slice(0, 8)}
                    {version.promptVersion ? ` · prompt ${version.promptVersion}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${STATE_STYLES[version.approvalState]}`}
                >
                  {version.approvalState.replace(/_/g, " ")}
                </span>
              </div>
              <div className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-800">
                {version.content}
              </div>
              {version.evidenceUsed.length > 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  Evidence used: {version.evidenceUsed.join(", ")}
                </p>
              ) : null}
              <ApproveRejectButtons artifactId={artifactId} version={version} />
            </li>
          ))}
      </ul>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Create new version</h3>
        <p className="mt-1 text-sm text-slate-600">
          Versions are immutable — a previous version is never overwritten.
        </p>
        <div className="mt-4">
          <CreateVersionForm
            artifactId={artifactId}
            state={state}
            formAction={formAction}
            pending={pending}
          />
        </div>
      </div>
    </div>
  );
}

function CreateVersionForm({
  artifactId,
  state,
  formAction,
  pending,
}: {
  artifactId: string;
  state: { error?: string; ok?: boolean };
  formAction: (payload: FormData) => void;
  pending: boolean;
}) {
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="artifactId" value={artifactId} />
      <TextArea
        id="content"
        label="Content"
        required
        name="content"
        rows={8}
        placeholder="Write the full content for this version…"
        maxLength={100_000}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          id="origin"
          label="Origin"
          name="origin"
          options={[
            { value: "human", label: "Human" },
            { value: "ai", label: "AI" },
            { value: "hybrid", label: "Hybrid" },
          ]}
        />
        <div>
          <label htmlFor="promptVersion" className="mb-2 block text-sm font-medium text-slate-700">
            Prompt version (optional)
          </label>
          <input
            id="promptVersion"
            name="promptVersion"
            placeholder="e.g. v1"
            maxLength={100}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>
      <div>
        <label htmlFor="evidenceUsed" className="mb-2 block text-sm font-medium text-slate-700">
          Evidence used (optional, JSON array or comma separated)
        </label>
        <input
          id="evidenceUsed"
          name="evidenceUsed"
          placeholder='["evidence-id-1", "evidence-id-2"]'
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Evidence IDs referenced in this version, if any.
        </p>
      </div>

      {state.error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
        >
          {state.error}
        </div>
      ) : null}
      {state.ok ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Version created.
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Add version"}
        </Button>
      </div>
    </form>
  );
}
