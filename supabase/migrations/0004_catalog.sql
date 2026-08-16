-- 0004_catalog.sql
-- Admissions catalogue: subjects, institutions, courses, intakes, cycles,
-- effective-dated requirements, sources and snapshots.

create table if not exists public.catalog_subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  parent_subject_id uuid references public.catalog_subjects (id) on delete set null
);

create table if not exists public.catalog_institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code text not null default 'GB' check (country_code ~ '^[A-Z]{2}$'),
  city text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_courses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.catalog_institutions (id) on delete cascade,
  subject_id uuid references public.catalog_subjects (id) on delete set null,
  title text not null,
  level text not null check (level in (
    'foundation', 'undergraduate', 'postgraduate_taught', 'postgraduate_research', 'phd'
  )),
  duration_months integer check (duration_months > 0),
  tuition_fee integer check (tuition_fee >= 0),
  currency_code text check (currency_code ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_courses_institution_idx
  on public.catalog_courses (institution_id);

create table if not exists public.catalog_application_cycles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- e.g. '2026/27'
  starts_year integer not null check (starts_year between 2000 and 2100),
  ends_year integer not null check (ends_year between 2000 and 2100),
  status text not null default 'upcoming' check (status in ('open', 'closed', 'upcoming')),
  constraint catalog_cycles_year_order check (ends_year > starts_year)
);

create table if not exists public.catalog_course_intakes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.catalog_courses (id) on delete cascade,
  application_cycle_id uuid not null references public.catalog_application_cycles (id) on delete cascade,
  intake_month integer not null check (intake_month between 1 and 12),
  intake_year integer not null check (intake_year between 2000 and 2100),
  application_deadline timestamptz,
  closed boolean not null default false
);

create index if not exists catalog_intakes_course_idx
  on public.catalog_course_intakes (course_id);
create index if not exists catalog_intakes_cycle_idx
  on public.catalog_course_intakes (application_cycle_id);

-- Sources: provenance of every catalogue fact (official URL, owner,
-- extractor version). LLM output alone is never a trusted requirement.
create table if not exists public.catalog_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  source_owner text,
  extractor_version text,
  fetch_policy text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Structured requirements with effective dating: a student's application
-- is evaluated against the requirements effective for their cycle, never
-- against whatever is current at query time.
create table if not exists public.catalog_course_requirements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.catalog_courses (id) on delete cascade,
  kind text not null check (kind in ('academic', 'language', 'application')),
  structured jsonb,
  source_text text not null default '',
  source_id uuid references public.catalog_sources (id) on delete set null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  observed_at timestamptz not null default now(),
  published_at timestamptz not null default now(),
  superseded_by_id uuid references public.catalog_course_requirements (id) on delete set null
);

create index if not exists catalog_requirements_course_idx
  on public.catalog_course_requirements (course_id, effective_from desc);


-- Immutable raw snapshots with content hash. Internal table: no client
-- policies, service role only.
create table if not exists public.catalog_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.catalog_sources (id) on delete cascade,
  fetched_at timestamptz not null default now(),
  content_hash text not null,
  raw_content text not null,
  status text not null default 'stored' check (status in ('stored', 'extracted', 'failed'))
);

create index if not exists catalog_snapshots_source_idx
  on public.catalog_source_snapshots (source_id, fetched_at desc);
