import Link from "next/link";

export function Pagination({
  page,
  pageSize,
  total,
  href,
}: {
  page: number;
  pageSize: number;
  total: number;
  /** Base path; the page param is appended as a query string. */
  href: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pageHref = (target: number) => {
    const url = new URL(href, "http://localhost");
    url.searchParams.set("page", String(target));
    return `${url.pathname}${url.search}`;
  };

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex items-center justify-center gap-2"
    >
      <Link
        href={pageHref(Math.max(1, page - 1))}
        aria-disabled={page <= 1}
        className={`rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold ${
          page <= 1
            ? "pointer-events-none text-slate-300"
            : "text-slate-700 hover:border-blue-300 hover:text-blue-700"
        }`}
      >
        ← Previous
      </Link>
      <span className="px-3 text-sm text-slate-600">
        Page {page} of {totalPages} · {total} results
      </span>
      <Link
        href={pageHref(Math.min(totalPages, page + 1))}
        aria-disabled={page >= totalPages}
        className={`rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold ${
          page >= totalPages
            ? "pointer-events-none text-slate-300"
            : "text-slate-700 hover:border-blue-300 hover:text-blue-700"
        }`}
      >
        Next →
      </Link>
    </nav>
  );
}
