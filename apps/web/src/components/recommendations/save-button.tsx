"use client";

import { useState, useTransition } from "react";
import { saveCourseAction, unsaveCourseAction } from "@/app/saved/actions";

export function SaveCourseButton({
  courseId,
  isSaved = false,
}: {
  courseId: string;
  isSaved?: boolean;
}) {
  const [saved, setSaved] = useState(isSaved);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      if (saved) {
        const result = await unsaveCourseAction({ courseId });
        if (result.error) {
          setError(result.error);
        } else {
          setSaved(false);
        }
      } else {
        const result = await saveCourseAction({ courseId });
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
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
          saved
            ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
        aria-label={saved ? "Unsave course" : "Save course"}
      >
        {pending ? "..." : saved ? "Saved ✓" : "Save"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
