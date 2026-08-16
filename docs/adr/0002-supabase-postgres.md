# ADR 0002 — Supabase Postgres as the Source of Truth

- Status: accepted
- Date: 2026-08-15

## Context

Student data, catalogue data, artifacts and audit records must live in one
authoritative store with strong access control. The prototype already used a
Supabase project (auth + Postgres) but without migrations in Git and with a
direct `review_orders` insert from the browser.

## Decision

- **Supabase Postgres is the canonical data store.** All schema changes are
  versioned SQL migrations in `supabase/migrations/`, applied in order and
  recorded in `public.schema_migrations`. No schema is ever created manually.
- **Single `public` schema with domain-prefixed tables** (`student_profiles`,
  `catalog_courses`, `admissions_cases`, …) rather than multiple Postgres
  schemas.
- **RLS is enabled on every client-reachable table**; internal tables
  (`audit_logs`, `ai_runs`, `background_jobs`, `catalog_source_snapshots`)
  have no client policies and are service-role only.
- Supabase Storage for student documents (private bucket, owner-scoped
  policies, expiring signed URLs).

## Why one `public` schema (and not per-domain schemas)

- PostgREST (the Supabase REST layer the browser client talks to) exposes
  schemas explicitly; non-`public` schemas need gateway/PostgREST
  configuration and complicate client-accessible RLS enforcement.
- Schema separation would add operational complexity without changing the
  security story, because access control is enforced by RLS policies, not by
  schema ownership.
- Domain separation is expressed by table naming and module boundaries in
  the application; if a domain is later extracted into a service, its tables
  can move to a dedicated schema at that point.

## Consequences

- Every change to the database goes through a reviewed migration; the schema
  is fully reproducible from Git (`pnpm db:migrate`).
- RLS tests in `supabase/tests/` must pass before merge.
- Service-role credentials are server/worker only and never appear in
  client bundles.
- UUID primary keys, CHECK constraints, no database enums, JSONB only where
  genuinely flexible.

## Alternatives considered

- A separate ORM-owned database (Prisma/Drizzle): rejected — Supabase already
  provides auth + storage + PostgREST; raw SQL migrations keep full control
  and zero ORM lock-in (an ORM merely for fashion is excluded).
- Multiple Postgres schemas from day one: deferred until a domain extraction
  actually needs it (see above).
