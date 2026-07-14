import Link from "next/link";

export default function Navbar() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold text-slate-900">
          Offer.ai
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href="/how-it-works"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            How it works
          </Link>

          <Link
            href="/pricing"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Pricing
          </Link>

          <Link
            href="/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Log in
          </Link>

          <Link
            href="/register"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}