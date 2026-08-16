import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types";

/**
 * Service-role Supabase client — bypasses RLS.
 *
 * SERVER / WORKER ONLY. Never import this into client components, never
 * expose the service-role key to the browser. Administrative mutations and
 * background jobs go through this client.
 */
export function createServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export type ServiceSupabaseClient = ReturnType<typeof createServiceSupabaseClient>;
