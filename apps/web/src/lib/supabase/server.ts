import "server-only";
import { cookies } from "next/headers";
import {
  createServerSupabaseClient,
  createServiceSupabaseClient,
} from "@offer-ai/database";

/**
 * Server Supabase client bound to the request session (RLS enforced as the
 * logged-in user). Server components and route handlers only.
 */
export async function getServerClient() {
  const cookieStore = await cookies();
  return createServerSupabaseClient(cookieStore);
}

/**
 * Service-role client — bypasses RLS. Server/worker only; used for
 * administrative paths and background work. Never in client bundles.
 */
export function getServiceClient() {
  return createServiceSupabaseClient();
}
