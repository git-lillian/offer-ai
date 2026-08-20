"use client";

import { useState, useTransition } from "react";
import { ExplanationCard } from "./explanation-card";

type CourseOption = {
  id: string;
  title: string;
  subtitle: string;
};

type Provenance = {
  provider: string;
  model: string;
  promptVersion: string;
  latencyMs: number | null;
  inputHash?: string | null;
  correlationId: string | null;
};

type ExplainResult = {
  explanation: string;
  provenance: Provenance;
};

export function ExplainForm({
  courses,
  initialCourseId,
}: {
  courses: CourseOption[];
  initialCourseId?: string;
}) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    initialCourseId ?? courses[0]?.id ?? "",
  );
  const [manualCourseId, setManualCourseId] = useState<string>("");
  const [useStructured, setUseStructured] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExplainResult | null>(null);

  const hasOptions = courses.length > 0;
  const effectiveCourseId = manualCourseId.trim() || selectedCourseId;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const courseId = effectiveCourseId.trim();
    if (!courseId) {
      setError("Select a course or paste a course UUID.");
      return;
    }

    // Lightweight UUID check before hitting the API (server still validates with zod).
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(courseId)) {
      setError("Course id must be a valid UUID.");
      return;
    }

    const endpoint = useStructured
      ? "/api/adviser/explain-structured"
      : "/api/adviser/explain";

    startTransition(async () => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId }),
        });
        const json = (await res.json()) as ExplainResult & { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Unable to generate explanation.");
          return;
        }
        if (!json.explanation || !json.provenance) {
          setError("Invalid response from adviser.");
          return;
        }
        setResult({ explanation: json.explanation, provenance: json.provenance });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Request explanation
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Select a saved course or recommendation. The deterministic eligibility engine decides;
          the LLM explains with provenance (prompt version, model, ledger).
        </p>

        <div className="mt-4 grid gap-4">
          {hasOptions ? (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Course
              </span>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} — {c.subtitle}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">
                {courses.length} course{courses.length === 1 ? "" : "s"} available from your saved
                list and recommendations.
              </span>
            </label>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No saved courses or recommendations yet. Paste a course UUID below or{" "}
              <a href="/recommendations" className="font-semibold underline">
                generate recommendations
              </a>{" "}
              first.
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Or paste a course UUID
            </span>
            <input
              value={manualCourseId}
              onChange={(e) => setManualCourseId(e.target.value)}
              placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Manual UUID overrides the dropdown when filled.
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useStructured}
              onChange={(e) => setUseStructured(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-slate-700">Use structured output</span>
            <span className="text-slate-500">(calls /explain-structured, zod-validated JSON)</span>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending
              ? "Explaining…"
              : useStructured
                ? "Explain eligibility (structured)"
                : "Explain eligibility"}
          </button>
          <span className="text-xs text-slate-500">
            POST /api/adviser/{useStructured ? "explain-structured" : "explain"} with {"{"} courseId
            {"}"} — student is derived from your session.
          </span>
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}
      </form>

      {result ? <ExplanationCard explanation={result.explanation} provenance={result.provenance} /> : null}

      {!result && !error ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-semibold text-slate-700">No explanation yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Select a course and request an explanation. The response will appear here with full
            provenance (provider, model, prompt version, latency, ledger input hash).
          </p>
        </div>
      ) : null}
    </div>
  );
}
