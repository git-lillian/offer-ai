"use client";

import { useActionState } from "react";
import { createWatchAction, type NotificationActionState } from "@/app/notifications/actions";
import { Button } from "@offer-ai/ui";

const initialState: NotificationActionState = {};

export function CreateWatchForm() {
  const [state, formAction, isPending] = useActionState(createWatchAction, initialState);

  return (
    <form action={formAction} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div>
        <h2 className="font-bold text-slate-900">Create deadline watch</h2>
        <p className="mt-1 text-sm text-slate-600">
          Watch a course intake to receive deadline reminders. next_reminder_at is calculated from the catalogue&apos;s application_deadline and your preferences. Provenance lives in the catalogue, not hard-coded.
        </p>
      </div>

      {state.error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      {state.ok ? (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Watch created.
        </div>
      ) : null}

      <div>
        <label htmlFor="courseIntakeId" className="mb-2 block text-sm font-medium text-slate-700">
          Course intake ID (UUID)
        </label>
        <input
          id="courseIntakeId"
          name="courseIntakeId"
          placeholder="e.g. 33333333-3333-4333-8333-333333333333"
          required
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
        <p className="mt-2 text-xs text-slate-500">Find an intake from the catalogue — deadline lives there with source provenance. Try copying from /universities detail pages.</p>
      </div>

      <div>
        <label htmlFor="watchType" className="mb-2 block text-sm font-medium text-slate-700">
          Watch type
        </label>
        <select
          id="watchType"
          name="watchType"
          defaultValue="deadline"
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        >
          <option value="deadline">deadline</option>
          <option value="availability">availability</option>
        </select>
      </div>

      <Button type="submit" variant="primary" size="md" disabled={isPending}>
        {isPending ? "Creating…" : "Create watch"}
      </Button>
      <p className="text-xs text-slate-500">Validated with createDeadlineWatchInput · student derived from session · next_reminder_at = deadline - preferences.</p>
    </form>
  );
}
