import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";
import { logoutAction } from "@/app/(auth)/actions";
import { getServerClient } from "@/lib/supabase/server";

export async function Navbar() {
  const user = await getOptionalUser();
  let pendingCount = 0;
  if (user) {
    try {
      const supabase = await getServerClient();
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "pending");
      pendingCount = count ?? 0;
    } catch {
      pendingCount = 0;
    }
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold text-slate-900">
          Offer.ai
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href="/universities"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Universities
          </Link>
          <Link
            href="/opportunities"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Opportunities
          </Link>
          <Link
            href="/marketplace"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Marketplace
          </Link>
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Dashboard
              </Link>
              <Link
                href="/experiences"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Experiences
              </Link>
              <Link
                href="/artifacts"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Artifacts
              </Link>
              <Link
                href="/recommendations"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Recommendations
              </Link>
              <Link
                href="/saved"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Saved
              </Link>
              <Link
                href="/adviser"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Adviser
              </Link>
              <Link
                href="/billing"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Billing
              </Link>
              <Link
                href="/notifications"
                className="relative text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Notifications
                {pendingCount > 0 ? (
                  <span className="absolute -right-3 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                    {pendingCount > 99 ? "99+" : String(pendingCount)}
                  </span>
                ) : null}
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
