import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "../types";

/**
 * Minimal cookie-store contract required by the server Supabase client.
 *
 * Defined structurally so `packages/database` never imports Next.js (the
 * worker and web apps both consume this package). The Next.js
 * `cookies()` store satisfies it structurally.
 */
export interface RequestCookieStore {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options?: CookieOptions): void;
}

/**
 * Server Supabase client bound to the request's session cookies.
 * RLS is enforced as the authenticated user. Server components and route
 * handlers only — never import this into client components.
 */
export function createServerSupabaseClient(cookieStore: RequestCookieStore) {
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