import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Request proxy (formerly middleware): refreshes the Supabase session and
 * protects private routes.
 *
 * Private areas: /dashboard, /onboarding, /cases, /recommendations, /saved, /artifacts, /experiences, /billing.
 * Guests are redirected to /login; the onboarding page additionally redirects
 * to /dashboard once complete (checked in the page itself).
 * Opportunities (/opportunities) is public like the catalogue.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;
    const isPrivate =
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/onboarding") ||
      pathname.startsWith("/cases") ||
      pathname.startsWith("/recommendations") ||
      pathname.startsWith("/saved") ||
      pathname.startsWith("/artifacts") ||
      pathname.startsWith("/adviser") ||
      pathname.startsWith("/experiences") ||
      pathname.startsWith("/billing") ||
      pathname.startsWith("/notifications");

    if (isPrivate && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    // Guests visiting login/register when already signed in go to dashboard.
    if (user && (pathname === "/login" || pathname === "/register")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding",
    "/onboarding/:path*",
    "/cases/:path*",
    "/recommendations/:path*",
    "/recommendations",
    "/saved/:path*",
    "/saved",
    "/artifacts/:path*",
    "/artifacts",
    "/adviser/:path*",
    "/adviser",
    "/experiences/:path*",
    "/experiences",
    "/billing/:path*",
    "/billing",
    "/notifications/:path*",
    "/notifications",
    "/login",
    "/register",
  ],
};
