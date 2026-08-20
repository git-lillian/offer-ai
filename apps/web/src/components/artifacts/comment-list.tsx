"use client";

import { useActionState } from "react";
import { Button, TextArea, Select } from "@offer-ai/ui";
import type { ArtifactComment } from "@offer-ai/domain";
import { addCommentAction } from "@/app/artifacts/actions";

export function CommentList({
  artifactId,
  comments,
  versions,
}: {
  artifactId: string;
  comments: ArtifactComment[];
  versions: { versionNumber: number }[];
}) {
  const [state, formAction, pending] = useActionState(addCommentAction, {});

  const versionOptions =
    versions.length > 0
      ? versions.map((v) => ({ value: String(v.versionNumber), label: `Version ${v.versionNumber}` }))
      : [{ value: "1", label: "Version 1" }];

  const defaultVersion = String(versions.length > 0 ? Math.max(...versions.map((v) => v.versionNumber)) : 1);

  return (
    <div className="space-y-6">
      {comments.length === 0 ? (
        <p className="text-sm text-slate-500">No comments yet. Leave the first feedback below.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  Version {comment.versionNumber} · {comment.authorUserId.slice(0, 8)}
                </p>
                <span className="text-xs text-slate-500">{comment.createdAt.toLocaleString()}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form
        action={formAction}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h3 className="text-sm font-bold text-slate-900">Add comment</h3>
        <p className="mt-1 text-sm text-slate-600">
          Feedback is tied to a specific version. Comments are immutable — edit by deleting and re-adding.
        </p>
        <div className="mt-4 space-y-4">
          <input type="hidden" name="artifactId" value={artifactId} />
          <Select
            id="versionNumber"
            label="Version"
            name="versionNumber"
            options={versionOptions}
            // default to latest
            defaultValue={defaultVersion}
          />
          <TextArea
            id="body"
            label="Comment"
            required
            name="body"
            rows={4}
            placeholder="Leave feedback on this version…"
            maxLength={5000}
          />

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
              Comment added.
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add comment"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
