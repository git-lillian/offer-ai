"use client";

import { useState, useTransition } from "react";
import { Button } from "@offer-ai/ui";
import { saveOpportunityAction, unsaveOpportunityAction } from "@/app/opportunities/actions";

export function SaveOpportunityButton({
  opportunityId,
  isSaved = false,
}: {
  opportunityId: string;
  isSaved?: boolean;
}) {
  const [saved, setSaved] = useState(isSaved);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      if (saved) {
        const result = await unsaveOpportunityAction({ opportunityId });
        if (result.error) {
          setError(result.error);
        } else {
          setSaved(false);
        }
      } else {
        const result = await saveOpportunityAction({ opportunityId });
        if (result.error) {
          setError(result.error);
        } else {
          setSaved(true);
        }
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={saved ? "secondary" : "primary"}
        size="sm"
        onClick={handleToggle}
        disabled={pending}
        aria-label={saved ? "Unsave opportunity" : "Save opportunity"}
      >
        {pending ? "..." : saved ? "Saved ✓" : "Save"}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
