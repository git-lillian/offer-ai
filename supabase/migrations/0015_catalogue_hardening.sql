-- 0015_catalogue_hardening.sql
-- Strengthen the admissions catalogue: slugs for browsing, extensible
-- external identifiers, cycle-scoped fees, deadline provenance, requirement
-- verification status, source freshness, and per-course application routes.

-- ── 1) Slugs (stable URL keys for catalogue browsing) ───────────────────────
alter table public.catalog_institutions add column slug text;
update public.catalog_institutions
   set slug = btrim(lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')), '-')
 where slug is null or btrim(slug) = '';
alter table public.catalog_institutions alter column slug set not null;
create unique index catalog_institutions_slug_idx on public.catalog_institutions (slug);

alter table public.catalog_subjects add column slug text;
update public.catalog_subjects
   set slug = btrim(lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')), '-')
 where slug is null or btrim(slug) = '';
alter table public.catalog_subjects alter column slug set not null;
create unique index catalog_subjects_slug_idx on public.catalog_subjects (slug);

alter table public.catalog_courses add column slug text;
update public.catalog_courses
   set slug = btrim(lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g')), '-')
 where slug is null or btrim(slug) = '';
alter table public.catalog_courses alter column slug set not null;
create unique index catalog_courses_slug_idx on public.catalog_courses (institution_id, slug);

-- ── 2) External identifiers (UCAS apply codes, UKPRN, HESA, …) ──────────────
-- Polymorphic on entity so every catalogue fact can carry official source
-- identifiers without a schema change per identifier scheme.
create table if not exists public.catalog_entity_identifiers (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('institution', 'course', 'subject')),
  entity_id uuid not null,
  identifier_type text not null,
  identifier_value text not null,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, identifier_type)
);

create index catalog_entity_identifiers_entity_idx
  on public.catalog_entity_identifiers (entity_type, entity_id);
create index catalog_entity_identifiers_type_idx
  on public.catalog_entity_identifiers (identifier_type, identifier_value);

-- ── 3) Cycle-scoped fees + deadline provenance on intakes ───────────────────
-- Fees and deadlines are properties of a specific intake/cycle, not of the
-- course as a whole. Every decision-critical value retains its source.
alter table public.catalog_course_intakes
  add column tuition_fee integer check (tuition_fee >= 0),
  add column fee_currency_code text check (fee_currency_code ~ '^[A-Z]{3}$'),
  add column fee_source_id uuid references public.catalog_sources (id) on delete set null,
  add column fee_observed_at timestamptz,
  add column application_deadline_source_id uuid references public.catalog_sources (id) on delete set null,
  add column application_deadline_observed_at timestamptz;

-- ── 4) Requirement verification status ──────────────────────────────────────
-- Requirements go through the provenance pipeline
-- (unverified -> machine_extracted -> machine_validated -> human_verified);
-- AI-extracted requirements can never reach human_verified without review.
alter table public.catalog_course_requirements
  add column verification_status text not null default 'unverified'
    check (verification_status in (
      'unverified', 'machine_extracted', 'machine_validated',
      'human_verified', 'superseded', 'rejected'
    ));

-- ── 5) Source freshness ─────────────────────────────────────────────────────
alter table public.catalog_sources
  add column last_verified_at timestamptz;

-- ── 6) Application routes per course ────────────────────────────────────────
alter table public.catalog_courses
  add column application_routes text[] not null default '{}'
    check (application_routes <@ array['ucas', 'institution_direct', 'agent_portal', 'other']::text[]);