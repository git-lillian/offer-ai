import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getServerClient } from "./supabase/server";

/**
 * Server-side session guard. Redirects unauthenticated visitors to /login.
 * Use in protected pages/layouts before touching user data.
 */
export async function requireUser(): Promise<User> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Server-side session check without redirect — for pages that render
 * different content for guests vs. logged-in users.
 */
export async function getOptionalUser(): Promise<User | null> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireRole(role: "administrator" | "adviser"): Promise<User> {
  const user = await requireUser();
  const supabase = await getServerClient();

  const { data } = await supabase
    .from("identity_user_roles")
    .select("role_code")
    .eq("user_id", user.id);

  const roles = (data ?? []).map((row) => row.role_code);
  if (!roles.includes(role)) {
    redirect("/dashboard");
  }
  return user;
}
