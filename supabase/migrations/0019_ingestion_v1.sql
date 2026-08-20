-- 0019_ingestion_v1.sql
-- Real UK ingestion v1: source↔course mapping + ingestion run ledger.
-- Keeps the pipeline idempotent, provenanced and diff-based.
-- See docs/architecture/ingestion.md.

-- ── 1) Explicit source → course mapping ────────────────────────────────────
-- v1 never creates courses from scraped content. A source must be linked to
-- its course(s) by a human before ingestion will publish for it. Seed data
-- below links the 3 official sources to their curated courses; fixture
-- sources stay unlinked (publisher skips them).
create table if not exists public.catalog_source_courses (
  source_id uuid not null references public.catalog_sources (id) on delete cascade,
  course_id uuid not null references public.catalog_courses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (source_id, course_id)
);

create index if not exists catalog_source_courses_source_idx
  on public.catalog_source_courses (source_id);
create index if not exists catalog_source_courses_course_idx
  on public.catalog_source_courses (course_id);

-- ── 2) Ingestion run ledger (service-role only, no client policies) ───────
-- One row per `catalog.ingest` execution. `status` mirrors background_jobs
-- but keeps ingestion-specific metadata (hashes, counts) queryable without
-- parsing job payloads. RLS is enabled with no anon/authenticated policies
-- so the browser can never read or write runs.

create table if not exists public.catalog_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.catalog_sources (id) on delete cascade,
  snapshot_id uuid references public.catalog_source_snapshots (id) on delete set null,
  status text not null check (status in ('started','completed','skipped_unchanged','failed')),
  content_hash text,
  extracted_count integer not null default 0 check (extracted_count >= 0),
  published_count integer not null default 0 check (published_count >= 0),
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists catalog_ingestion_runs_source_idx
  on public.catalog_ingestion_runs (source_id, started_at desc);

alter table public.catalog_ingestion_runs enable row level security;
-- No policy for anon/authenticated → service-role only (purposely).

-- ── 3) Seed the v1 source↔course links ────────────────────────────────────
-- Official sources are linked to their curated courses via seed.sql after
-- catalog_sources and catalog_courses are populated. The mapping is
-- intentionally not inserted here to keep the migration independent of seed
-- order (FKs would fail on a fresh DB before seed). See supabase/seed.sql.

-- ── 4) Re-apply schema grants (self-healing for restored DBs) ────────────
-- Mirrors 0017_standard_schema_grants: ensure anon/authenticated can read
-- the new mapping table (public catalogue data) but still cannot write it.
grant usage on schema public to anon, authenticated, service_role;
grant select on public.catalog_source_courses to anon, authenticated, service_role;
grant all on public.catalog_source_courses to service_role;
grant all on public.catalog_ingestion_runs to service_role;
