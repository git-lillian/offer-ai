"use client";

import { useActionState } from "react";
import { updatePreferencesAction, type NotificationActionState } from "@/app/notifications/actions";
import { Button } from "@offer-ai/ui";
import type { NotificationPreference } from "@offer-ai/notifications";

const initialState: NotificationActionState = {};

export function PreferenceForm({ preference }: { preference: NotificationPreference | null }) {
  const [state, formAction, isPending] = useActionState(updatePreferencesAction, initialState);

  const defaults = preference ?? {
    emailEnabled: true,
    pushEnabled: true,
    deadlineReminderDays: [7, 3, 1],
  } as unknown as NotificationPreference;

  const reminderDaysValue = defaults.deadlineReminderDays.join(", ");

  return (
    <form action={formAction} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Notification preferences</h2>
        <p className="mt-1 text-sm text-slate-600">Control channels and when deadline reminders fire. Changes are validated via zod and stored with provenance.</p>
      </div>

      {state.error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      {state.ok ? (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Preferences saved.
        </div>
      ) : null}

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          name="emailEnabled"
          defaultChecked={defaults.emailEnabled}
          value="true"
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
        />
        <span className="text-sm font-medium text-slate-700">Email notifications</span>
      </label>
      <p className="ml-7 -mt-4 text-xs text-slate-500">When disabled, email channel delivery is skipped (in_app still delivered).</p>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          name="pushEnabled"
          defaultChecked={defaults.pushEnabled}
          value="true"
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
        />
        <span className="text-sm font-medium text-slate-700">Push notifications</span>
      </label>

      <div>
        <label htmlFor="deadlineReminderDays" className="mb-2 block text-sm font-medium text-slate-700">
          Deadline reminder days
        </label>
        <input
          id="deadlineReminderDays"
          name="deadlineReminderDays"
          defaultValue={reminderDaysValue}
          placeholder="e.g. 7, 3, 1"
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Comma-separated integers 0–365, max 10, no duplicates. Sorted descending. Example: 30, 7, 3, 1. Next reminder is calculated as deadline minus each offset; the soonest future candidate is chosen.
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? "Saving…" : "Save preferences"}
        </Button>
        <span className="text-xs text-slate-500 self-center">Validated at boundary with zod · domain enforces sorting and deduping.</span>
      </div>
    </form>
  );
}
