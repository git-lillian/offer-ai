type Provenance = {
  provider: string;
  model: string;
  promptVersion: string;
  latencyMs: number | null;
  inputHash?: string | null;
  correlationId: string | null;
};

export function ExplanationCard({
  explanation,
  provenance,
}: {
  explanation: string;
  provenance: Provenance;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          AI explanation
        </h3>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          Rules decided · LLM explained
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
          {explanation}
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Provenance
        </h4>
        <dl className="mt-2 grid gap-2 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-slate-600">Provider</dt>
            <dd className="font-mono text-slate-900">{provenance.provider}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-slate-600">Model</dt>
            <dd className="font-mono text-slate-900">{provenance.model}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-slate-600">Prompt version</dt>
            <dd className="font-mono text-slate-900">{provenance.promptVersion}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-slate-600">Latency</dt>
            <dd className="font-mono text-slate-900">
              {provenance.latencyMs !== null ? `${provenance.latencyMs} ms` : "—"}
            </dd>
          </div>
          {provenance.inputHash ? (
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-slate-600">Input hash</dt>
              <dd className="font-mono text-slate-900">{provenance.inputHash}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-slate-600">Correlation ID</dt>
            <dd className="font-mono text-slate-900">
              {provenance.correlationId ?? "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Eligibility was decided deterministically by the admissions engine; the LLM only
          explains the result. The ledger entry in <code className="font-mono">ai_runs</code>{" "}
          records provider, model and prompt version for auditability.
        </p>
      </div>
    </div>
  );
}
