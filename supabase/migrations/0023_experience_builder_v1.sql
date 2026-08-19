-- 0023_experience_builder_v1.sql
-- Experience builder v1: opportunities catalogue + student opportunity links
-- with gap analysis support.
--
-- Opportunities are public catalogue data (like catalog_courses) — readable by
-- anon and authenticated. Student-opportunity links are private and owner-
-- scoped via RLS, mirroring student_experiences.
--
-- See docs/product/vision.md:18-21, domain-map.md:22.

-- ── 1) Opportunities catalogue (public read) ───────────────────────────────
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  provider_name text not null check (char_length(btrim(provider_name)) between 1 and 200),
  opportunity_type text not null check (opportunity_type in (
    'internship', 'volunteering', 'course', 'competition', 'research'
  )),
  location_country_code text check (location_country_code ~ '^[A-Z]{2}$'),
  is_remote boolean not null default false,
  duration_months integer check (duration_months is null or duration_months between 0 and 120),
  description text not null default '' check (char_length(description) <= 5000),
  url text check (url is null or char_length(url) between 1 and 2048),
  created_at timestamptz not null default now()
);

create index if not exists opportunities_type_idx
  on public.opportunities (opportunity_type);
create index if not exists opportunities_remote_idx
  on public.opportunities (is_remote);
create index if not exists opportunities_country_idx
  on public.opportunities (location_country_code);
create index if not exists opportunities_created_idx
  on public.opportunities (created_at desc);
create index if not exists opportunities_title_trgm_idx
  on public.opportunities using gin (title gin_trgm_ops);
create index if not exists opportunities_provider_idx
  on public.opportunities (provider_name);

alter table public.opportunities enable row level security;

drop policy if exists opportunities_read_all on public.opportunities;
create policy opportunities_read_all
  on public.opportunities for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies for anon/authenticated → service_role only.
-- The catalogue is curated via seed or worker; students cannot mutate it from
-- the browser. This mirrors catalog_* tables (public read, service writes).

-- ── 2) Student opportunities (owner-scoped) ───────────────────────────────
create table if not exists public.student_opportunities (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  status text not null default 'saved' check (status in ('saved', 'applied', 'completed')),
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, opportunity_id),
  constraint student_opportunities_applied_at_check check (
    (status = 'saved' and applied_at is null)
    or (status in ('applied', 'completed') and applied_at is not null)
    or (status in ('applied', 'completed') and applied_at is null)
  )
);

-- The CHECK above is intentionally permissive for 'applied'/'completed' without
-- applied_at so existing 'saved' → 'applied' transitions remain flexible;
-- application logic enforces applied_at when moving to applied/completed.
-- Keep a simple DB check for validity while domain validates strictly.
-- To avoid over-constraining, replace with a minimal check:
alter table public.student_opportunities drop constraint if exists student_opportunities_applied_at_check;
alter table public.student_opportunities
  add constraint student_opportunities_applied_at_check
    check (
      applied_at is null or applied_at <= now() + interval '1 day'
    );

create index if not exists student_opportunities_student_idx
  on public.student_opportunities (student_id, created_at desc);
create index if not exists student_opportunities_opportunity_idx
  on public.student_opportunities (opportunity_id);
create index if not exists student_opportunities_student_status_idx
  on public.student_opportunities (student_id, status);
create index if not exists student_opportunities_student_opportunity_idx
  on public.student_opportunities (student_id, opportunity_id);

alter table public.student_opportunities enable row level security;

drop policy if exists student_opportunities_select_own on public.student_opportunities;
create policy student_opportunities_select_own
  on public.student_opportunities for select
  to authenticated
  using (
    public.is_student_owner(student_id)
    or public.has_student_access(student_id)
  );

drop policy if exists student_opportunities_insert_own on public.student_opportunities;
create policy student_opportunities_insert_own
  on public.student_opportunities for insert
  to authenticated
  with check (public.is_student_owner(student_id));

drop policy if exists student_opportunities_update_own on public.student_opportunities;
create policy student_opportunities_update_own
  on public.student_opportunities for update
  to authenticated
  using (public.is_student_owner(student_id))
  with check (public.is_student_owner(student_id));

drop policy if exists student_opportunities_delete_own on public.student_opportunities;
create policy student_opportunities_delete_own
  on public.student_opportunities for delete
  to authenticated
  using (public.is_student_owner(student_id));

-- ── 3) Grants (self-healing for restored DBs) ────────────────────────────
grant usage on schema public to anon, authenticated, service_role;

grant select on public.opportunities to anon, authenticated, service_role;
grant all on public.opportunities to service_role;

grant select, insert, update, delete on public.student_opportunities to authenticated, service_role;
grant all on public.student_opportunities to service_role;
