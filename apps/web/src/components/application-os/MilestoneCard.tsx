"use client";

import { useActionState, useState } from "react";
import { Button } from "@offer-ai/ui";
import { updateMilestoneAction, type OsActionState } from "@/app/cases/[caseId]/os/actions";
import type { ApplicationMilestone } from "@offer-ai/domain";

const MILESTONE_STYLES: Record<ApplicationMilestone["status"], string> = {
  pending: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-slate-100 text-slate-500",
};

export function MilestoneCard({ milestone, caseId }: { milestone: ApplicationMilestone; caseId: string }) {
  const [showActions, setShowActions] = useState(false);
  const [state, formAction, pending] = useActionState(updateMilestoneAction, {} as OsActionState);

  const dueText = milestone.dueAt ? new Date(milestone.dueAt).toLocaleDateString() : "No due date";
  const isOverdue =
    milestone.dueAt ? new Date(milestone.dueAt) < new Date() && milestone.status !== "completed" && milestone.status !== "cancelled" : false;

  return (
    <div className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
        {milestone.sortOrder + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-900">{milestone.title}</h3>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${MILESTONE_STYLES[milestone.status]}`}>
            {milestone.status.replace(/_/g, " ")}
          </span>
        </div>
        <p className={`mt-1 text-xs ${isOverdue ? "font-medium text-red-600" : "text-slate-500"}`}>
          {dueText}
          {isOverdue ? " · overdue" : ""} · order {milestone.sortOrder}
        </p>

        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={() => setShowActions((v) => !v)}>
            {showActions ? "Hide" : "Update status"}
          </Button>
        </div>

        {showActions ? (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap gap-2">
              {milestone.status === "pending" ? (
                <form action={formAction}>
                  <input type="hidden" name="caseId" value={caseId} />
                  <input type="hidden" name="milestoneId" value={milestone.id} />
                  <input type="hidden" name="status" value="in_progress" />
                  <Button type="submit" variant="secondary" size="sm" disabled={pending}>
                    Start
                  </Button>
                </form>
              ) : null}
              {milestone.status !== "completed" && milestone.status !== "cancelled" ? (
                <form action={formAction}>
                  <input type="hidden" name="caseId" value={caseId} />
                  <input type="hidden" name="milestoneId" value={milestone.id} />
                  <input type="hidden" name="status" value="completed" />
                  <Button type="submit" variant="primary" size="sm" disabled={pending}>
                    Mark completed
                  </Button>
                </form>
              ) : null}
              {milestone.status === "in_progress" ? (
                <form action={formAction}>
                  <input type="hidden" name="caseId" value={caseId} />
                  <input type="hidden" name="milestoneId" value={milestone.id} />
                  <input type="hidden" name="status" value="pending" />
                  <Button type="submit" variant="secondary" size="sm" disabled={pending}>
                    Back to pending
                  </Button>
                </form>
              ) : null}
              {milestone.status !== "cancelled" && milestone.status !== "completed" ? (
                <form action={formAction}>
                  <input type="hidden" name="caseId" value={caseId} />
                  <input type="hidden" name="milestoneId" value={milestone.id} />
                  <input type="hidden" name="status" value="cancelled" />
                  <Button type="submit" variant="danger" size="sm" disabled={pending}>
                    Cancel
                  </Button>
                </form>
              ) : null}
            </div>
            {state.error ? (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {state.error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
