-- 0020_recommendation_v1.sql
-- Recommendation engine v1: saved courses + reproducible recommendation runs.
-- See docs/architecture/country-adapters.md and Milestone 4 requirements.

-- ── 1) Saved courses (student private, RLS-owner) ───────────────────────────
create table if not exists public.student_saved_courses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  course_id uuid not null references public.catalog_courses (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create index if not exists student_saved_courses_student_idx
  on public.student_saved_courses (student_id, created_at desc);
create index if not exists student_saved_courses_course_idx
  on public.student_saved_courses (course_id);

alter table public.student_saved_courses enable row level security;

drop policy if exists student_saved_courses_select_own on public.student_saved_courses;
create policy student_saved_courses_select_own
  on public.student_saved_courses for select
  to authenticated
  using (public.is_student_owner(student_id));

drop policy if exists student_saved_courses_insert_own on public.student_saved_courses;
create policy student_saved_courses_insert_own
  on public.student_saved_courses for insert
  to authenticated
  with check (public.is_student_owner(student_id));

drop policy if exists student_saved_courses_delete_own on public.student_saved_courses;
create policy student_saved_courses_delete_own
  on public.student_saved_courses for delete
  to authenticated
  using (public.is_student_owner(student_id));

-- ── 2) Recommendation runs (reproducibility ledger) ──────────────────────────
-- One row per engine evaluation. Written by the service role (or application
-- service that enqueues a job); students may read their own rows for audit,
-- the browser never writes them directly.
create table if not exists public.recommendation_runs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  course_id uuid not null references public.catalog_courses (id) on delete cascade,
  eligibility text not null check (eligibility in ('eligible','ineligible','uncertain')),
  strategy_band text not null check (strategy_band in ('aspirational','target','safer')),
  score integer not null check (score between 0 and 100),
  confidence numeric(3,2) not null check (confidence >= 0 and confidence <= 1),
  reasons jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  profile_version text not null,
  catalogue_version text not null,
  rule_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists recommendation_runs_student_idx
  on public.recommendation_runs (student_id, created_at desc);
create index if not exists recommendation_runs_course_idx
  on public.recommendation_runs (course_id);
create index if not exists recommendation_runs_student_course_idx
  on public.recommendation_runs (student_id, course_id);

alter table public.recommendation_runs enable row level security;

drop policy if exists recommendation_runs_select_own on public.recommendation_runs;
create policy recommendation_runs_select_own
  on public.recommendation_runs for select
  to authenticated
  using (public.is_student_owner(student_id));

-- No insert/update/delete policies for anon/authenticated → service_role only.

-- ── 3) Grants (self-healing for restored DBs) ───────────────────────────────
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, delete on public.student_saved_courses to authenticated, service_role;
grant all on public.student_saved_courses to service_role;

grant select on public.recommendation_runs to authenticated, service_role;
grant all on public.recommendation_runs to service_role;
