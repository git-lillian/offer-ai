import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../types";

/**
 * Browser Supabase client (RLS-enforced, uses the user's session).
 * Safe to import in client components.
 */
export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}

export type BrowserSupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;
