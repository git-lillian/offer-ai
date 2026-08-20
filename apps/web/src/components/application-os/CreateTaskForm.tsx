"use client";

import { useActionState, useState, useEffect } from "react";
import { Button, Select, TextInput, TextArea } from "@offer-ai/ui";
import { createTaskAction, type OsActionState } from "@/app/cases/[caseId]/os/actions";

const SOURCE_OPTIONS = [
  { value: "student", label: "You" },
  { value: "adviser", label: "Adviser" },
  { value: "system_rule", label: "System rule" },
  { value: "application_workflow", label: "Workflow" },
  { value: "ai_recommendation", label: "AI recommendation" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function CreateTaskForm({ caseId }: { caseId: string }) {
  const [state, formAction, pending] = useActionState(createTaskAction, {} as OsActionState);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
    }
  }, [state.ok]);

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        + New task
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <input type="hidden" name="caseId" value={caseId} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">Create task</h3>
          <p className="text-sm text-slate-600">Add a checklist item to the OS. Tasks are framework-free and validated with zod.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
        >
          Close
        </button>
      </div>

      <TextInput
        id="title"
        label="Title *"
        name="title"
        required
        maxLength={200}
        placeholder="e.g. Secure academic reference"
      />

      <TextArea id="description" label="Description" name="description" rows={3} maxLength={2000} placeholder="Optional detail — 2000 chars max" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select id="source" label="Source *" name="source" options={SOURCE_OPTIONS} defaultValue="student" />
        <Select id="priority" label="Priority" name="priority" options={PRIORITY_OPTIONS} defaultValue="medium" />
      </div>

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
          <p className="mt-1 text-xs text-slate-500">Derived from catalogue deadline when possible; otherwise set manually.</p>
        </div>
        <TextInput id="assigneeUserId" label="Assignee user ID (optional)" name="assigneeUserId" placeholder="UUID or blank" />
      </div>

      {state.error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      {state.ok ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Task created</div>
      ) : null}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Creating…" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
