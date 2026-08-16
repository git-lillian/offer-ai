import Link from "next/link";

/**
 * Source provenance display — the user-facing, non-technical rendering of
 * where a decision-critical fact came from. The full provenance chain
 * (snapshot hash, extractor version, observed timestamps) stays in the
 * database.
 */
export function Provenance({
  sourceName,
  sourceUrl,
  lastVerifiedAt,
  sourceOwner,
}: {
  sourceName: string;
  sourceUrl: string | null;
  lastVerifiedAt: Date | null;
  sourceOwner: string | null;
}) {
  const label = sourceName || sourceOwner || "Official source";
  return (
    <p className="text-xs text-slate-500">
      Source:{" "}
      {sourceUrl ? (
        <Link
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-600 underline decoration-blue-200 hover:text-blue-700"
        >
          {label}
        </Link>
      ) : (
        <span className="font-medium text-slate-600">{label}</span>
      )}
      {lastVerifiedAt ? (
        <>
          {" · "}Last checked:{" "}
          {lastVerifiedAt.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </>
      ) : null}
    </p>
  );
}

/** Banner used when a fact could not be traced to a verified source. */
export function FixtureNotice() {
  return (
    <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
      Development fixture — this data is sample content for local testing and
      has not been verified against the official source.
    </p>
  );
}
