/**
 * Migration runner — applies `supabase/migrations/*.sql` in filename order,
 * transactionally, recording applied files in `public.schema_migrations`.
 *
 * Usage: pnpm db:migrate   (reads DATABASE_URL from env)
 *        pnpm db:reset     (drops public schema first — dev only)
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { repoPath } from "./env";
import { loadRootEnv } from "@offer-ai/config";

const { Client } = pg;

const MIGRATIONS_DIR = repoPath("supabase", "migrations");

async function main(): Promise<void> {
  loadRootEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env.local first.");
  }

  const reset = process.argv.includes("--reset");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  if (reset) {
    console.log("Resetting public schema (dev only)...");
    await client.query("drop schema if exists public cascade; create schema public;");
  }

  await client.query(`
    create table if not exists public.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const applied = new Set(
    (await client.query<{ name: string }>("select name from public.schema_migrations")).rows.map(
      (row) => row.name,
    ),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[skip] ${file}`);
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    console.log(`[apply] ${file}`);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into public.schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      console.error(`Migration ${file} failed:`, error);
      process.exitCode = 1;
      break;
    }
  }

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
