"use client";

import { useActionState, useState } from "react";
import { Button } from "@offer-ai/ui";
import { completeTaskAction, updateTaskStatusAction, type OsActionState } from "@/app/cases/[caseId]/os/actions";
import type { ApplicationTask } from "@offer-ai/domain";

const STATUS_STYLES: Record<ApplicationTask["status"], string> = {
  pending: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-50 text-amber-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-slate-100 text-slate-500 line-through",
};

const PRIORITY_STYLES: Record<ApplicationTask["priority"], string> = {
  low: "bg-slate-50 text-slate-600 border-slate-200",
  medium: "bg-blue-50 text-blue-700 border-blue-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  urgent: "bg-red-50 text-red-700 border-red-200",
};

const SOURCE_LABELS: Record<ApplicationTask["source"], string> = {
  system_rule: "System",
  ai_recommendation: "AI",
  adviser: "Adviser",
  student: "You",
  application_workflow: "Workflow",
};

export function TaskCard({ task, caseId }: { task: ApplicationTask; caseId: string }) {
  const [showComplete, setShowComplete] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [completeState, completeAction, pendingComplete] = useActionState(completeTaskAction, {} as OsActionState);
  const [updateState, updateAction, pendingUpdate] = useActionState(updateTaskStatusAction, {} as OsActionState);

  const isCompleted = task.status === "completed";
  const isCancelled = task.status === "cancelled";
  const canComplete = !isCompleted && !isCancelled;
  const dueText = task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "No due date";
  const isOverdue = task.dueAt ? new Date(task.dueAt) < new Date() && !isCompleted && !isCancelled : false;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-900">{task.title}</h3>
          {task.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{task.description}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2.5 py-1 font-semibold ${STATUS_STYLES[task.status]}`}>
              {task.status.replace(/_/g, " ")}
            </span>
            <span className={`rounded-full border px-2.5 py-1 font-medium ${PRIORITY_STYLES[task.priority]}`}>
              {task.priority}
            </span>
            <span className="rounded-full bg-slate-50 px-2.5 py-1 font-medium text-slate-600">
              {SOURCE_LABELS[task.source] ?? task.source}
            </span>
            <span className={`rounded-full px-2.5 py-1 font-medium ${isOverdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
              {dueText}
              {isOverdue ? " · overdue" : ""}
            </span>
          </div>
          {task.completionEvidence ? (
            <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">
              <span className="font-semibold">Evidence:</span> {task.completionEvidence}
            </div>
          ) : null}
          {task.completedAt ? (
            <p className="mt-2 text-xs text-slate-500">Completed {new Date(task.completedAt).toLocaleString()}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {canComplete ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowComplete((v) => !v)}
              className="whitespace-nowrap"
            >
              {showComplete ? "Cancel" : "Complete"}
            </Button>
          ) : null}
          {!isCompleted ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowActions((v) => !v)}
              className="whitespace-nowrap"
            >
              {showActions ? "Hide" : "Actions"}
            </Button>
          ) : null}
        </div>
      </div>

      {showComplete && canComplete ? (
        <form action={completeAction} className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="taskId" value={task.id} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Completion evidence *</span>
            <textarea
              name="completionEvidence"
              required
              maxLength={2000}
              rows={2}
              placeholder="Describe how you completed this — e.g. transcript uploaded, reference requested…"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          {completeState.error ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {completeState.error}
            </p>
          ) : null}
          {completeState.ok ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Task completed</p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={pendingComplete}>
              {pendingComplete ? "Completing…" : "Confirm complete"}
            </Button>
          </div>
        </form>
      ) : null}

      {showActions ? (
        <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick actions</p>
          <div className="flex flex-wrap gap-2">
            {task.status === "pending" ? (
              <form action={updateAction}>
                <input type="hidden" name="caseId" value={caseId} />
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="status" value="in_progress" />
                <Button type="submit" variant="secondary" size="sm" disabled={pendingUpdate}>
                  Start → in progress
                </Button>
              </form>
            ) : null}
            {task.status === "in_progress" ? (
              <form action={updateAction}>
                <input type="hidden" name="caseId" value={caseId} />
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="status" value="pending" />
                <Button type="submit" variant="secondary" size="sm" disabled={pendingUpdate}>
                  Reopen → pending
                </Button>
              </form>
            ) : null}
            {!isCancelled && !isCompleted ? (
              <form action={updateAction}>
                <input type="hidden" name="caseId" value={caseId} />
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="status" value="cancelled" />
                <Button type="submit" variant="danger" size="sm" disabled={pendingUpdate}>
                  Cancel task
                </Button>
              </form>
            ) : null}
          </div>
          {updateState.error ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {updateState.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
