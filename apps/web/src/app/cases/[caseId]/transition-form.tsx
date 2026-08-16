"use client";

import { useActionState } from "react";
import { Button, Select } from "@offer-ai/ui";
import { transitionStatusAction } from "./actions";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "in_progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "offer_received", label: "Offer received" },
  { value: "accepted", label: "Accepted" },
  { value: "enrolled", label: "Enrolled" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "declined_offer", label: "Declined offer" },
];

export function TransitionStatusForm({
  caseId,
  currentStatus,
}: {
  caseId: string;
  currentStatus: string;
}) {
  const [state, formAction, pending] = useActionState(transitionStatusAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <input type="hidden" name="caseId" value={caseId} />
      <div className="flex-1">
        <Select
          id="toStatus"
          label="New status"
          name="toStatus"
          options={STATUS_OPTIONS}
          placeholder="Select a new status"
        />
      </div>
      <Button type="submit" disabled={pending || !currentStatus}>
        {pending ? "Updating…" : "Update status"}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
