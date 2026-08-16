"use client";

import { createBrowserSupabaseClient } from "@offer-ai/database";

/**
 * Browser Supabase client — RLS enforced with the user's session.
 */
export function createClient() {
  return createBrowserSupabaseClient();
}
