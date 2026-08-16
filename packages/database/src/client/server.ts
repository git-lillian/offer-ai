import { createServerClient } from "@supabase/ssr";
import type { cookies } from "next/headers";
import type { Database } from "../types";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * Server Supabase client bound to the request's session cookies.
 * RLS is enforced as the authenticated user. Server components and route
 * handlers only — never import this into client components.
 */
export function createServerSupabaseClient(cookieStore: CookieStore) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore when middleware
          // is refreshing sessions.
        }
      },
    },
  });
}

export type ServerSupabaseClient = ReturnType<typeof createServerSupabaseClient>;
