/**
 * Seed runner — loads `supabase/seed.sql` (development data only) and
 * provisions the demo user through the Auth admin API so credentials are
 * always valid.
 *
 * Usage: pnpm db:seed
 */

import { readFileSync } from "node:fs";
import pg from "pg";
import { loadRootEnv } from "@offer-ai/config";
import { repoPath } from "./env";
import { createClient } from "@supabase/supabase-js";

const { Client } = pg;

const DEMO_EMAIL = "demo.student@offer-ai.local";
const DEMO_PASSWORD = "password123";
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

async function main(): Promise<void> {
  loadRootEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env.local first.");
  }

  // 1. Provision the demo auth user (idempotent).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: existing } = await service.auth.admin.getUserById(DEMO_USER_ID);
  if (existing?.user) {
    console.log("Demo user already exists; skipping auth provisioning.");
  } else {
    const { error } = await service.auth.admin.createUser({
      id: DEMO_USER_ID,
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Demo Student" },
    });
    if (error) throw error;
    console.log("Demo user created.");
  }

  // 2. Apply the SQL seed (catalogue, demo case) — the user rows are now
  // provisioned by the auth trigger, so the SQL no longer inserts them.
  const sql = readFileSync(repoPath("supabase", "seed.sql"), "utf8");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query("begin");
  try {
    await client.query(sql);
    await client.query("commit");
    console.log("Seed applied.");
  } catch (error) {
    await client.query("rollback");
    console.error("Seed failed:", error);
    process.exitCode = 1;
  }
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
