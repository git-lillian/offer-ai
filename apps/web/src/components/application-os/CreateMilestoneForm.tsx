"use client";

import { useActionState, useState, useEffect } from "react";
import { Button, Select, TextInput } from "@offer-ai/ui";
import { createMilestoneAction, type OsActionState } from "@/app/cases/[caseId]/os/actions";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function CreateMilestoneForm({ caseId, nextOrder }: { caseId: string; nextOrder: number }) {
  const [state, formAction, pending] = useActionState(createMilestoneAction, {} as OsActionState);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.ok) setOpen(false);
  }, [state.ok]);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        + New milestone
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="sortOrder" value={String(nextOrder)} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">Create milestone</h3>
          <p className="text-sm text-slate-600">Timeline checkpoints — ordered by sortOrder, grouped progress for the OS.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
        >
          Close
        </button>
      </div>

      <TextInput id="title" label="Title *" name="title" required maxLength={200} placeholder="e.g. Prepare documents" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="dueAt" className="mb-2 block text-sm font-medium text-slate-700">
            Due date
          </label>
          <input
            id="dueAt"
            name="dueAt"
            type="date"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <Select id="status" label="Status" name="status" options={STATUS_OPTIONS} defaultValue="pending" />
      </div>

      <TextInput id="sortOrder_display" label="Order" name="_sortOrder_display" defaultValue={String(nextOrder)} disabled hint="Auto-incremented; edit after creation to reorder." />

      {state.error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Creating…" : "Create milestone"}
        </Button>
      </div>
    </form>
  );
}
