"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateRecommendationsRequestSchema } from "@offer-ai/contracts";

export function RecommendationGenerateForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    const raw = String(formData.get("courseIds") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // If empty, just refresh the server-generated sample
    if (raw.length === 0) {
      router.refresh();
      setSuccess("Refreshed recommendations for catalogue sample.");
      return;
    }

    const parsed = generateRecommendationsRequestSchema.safeParse({ courseIds: raw });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid course ids.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/recommendations/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseIds: parsed.data.courseIds }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Failed to generate.");
          return;
        }
        setSuccess(`Generated ${json.recommendations?.length ?? 0} recommendations.`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <label className="min-w-80 flex-1">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          Course IDs (comma separated UUIDs, optional)
        </span>
        <input
          name="courseIds"
          placeholder="Leave empty for catalogue sample, or paste 1–20 course UUIDs"
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Generating…" : "Generate"}
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
      {success ? <p className="w-full text-sm text-emerald-700">{success}</p> : null}
    </form>
  );
}
