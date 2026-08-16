-- Development seed data. No real personal data.
--
-- Run with: pnpm db:seed
-- The demo auth user is provisioned by the seed runner through the Auth
-- admin API; the signup trigger claims the demo student profile, so this
-- SQL only seeds the catalogue and a demo case.

-- ── Demo profile (auth user provisioned by the runner) ─────────────────────
insert into public.student_profiles (user_id, full_name, email, account_status, claimed_at)
select '00000000-0000-0000-0000-000000000001', 'Demo Student', 'demo.student@offer-ai.local', 'claimed', now()
where not exists (
  select 1 from public.student_profiles
  where user_id = '00000000-0000-0000-0000-000000000001'
);

insert into public.identity_user_roles (user_id, role_code)
values ('00000000-0000-0000-0000-000000000001', 'student')
on conflict do nothing;

insert into public.user_preferences (user_id)
values ('00000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- ── Catalogue ──────────────────────────────────────────────────────────────
insert into public.catalog_institutions (id, name, slug, country_code, city, website_url)
values
  ('10000000-0000-0000-0000-000000000001', 'University of Edinburgh', 'university-of-edinburgh', 'GB', 'Edinburgh', 'https://www.ed.ac.uk'),
  ('10000000-0000-0000-0000-000000000002', 'University of Manchester', 'university-of-manchester', 'GB', 'Manchester', 'https://www.manchester.ac.uk'),
  ('10000000-0000-0000-0000-000000000003', 'University of Birmingham', 'university-of-birmingham', 'GB', 'Birmingham', 'https://www.birmingham.ac.uk')
on conflict (id) do nothing;

insert into public.catalog_subjects (id, code, slug, name)
values
  ('11000000-0000-0000-0000-000000000001', 'comp-sci', 'computer-science', 'Computer Science'),
  ('11000000-0000-0000-0000-000000000002', 'data-sci', 'data-science', 'Data Science'),
  ('11000000-0000-0000-0000-000000000003', 'finance', 'finance', 'Finance')
on conflict (id) do nothing;

insert into public.catalog_courses (id, institution_id, subject_id, title, slug, level, duration_months, tuition_fee, currency_code, application_routes)
values
  ('12000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'MSc Data Science', 'msc-data-science', 'postgraduate_taught', 12, 33400, 'GBP', '{institution_direct}'),
  ('12000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'MSc Advanced Computer Science', 'msc-advanced-computer-science', 'postgraduate_taught', 12, 33500, 'GBP', '{institution_direct}'),
  ('12000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000003', 'MSc Financial Management', 'msc-financial-management', 'postgraduate_taught', 12, 30340, 'GBP', '{institution_direct}')
on conflict (id) do nothing;

insert into public.catalog_application_cycles (id, code, starts_year, ends_year, status)
values
  ('13000000-0000-0000-0000-000000000001', '2026/27', 2026, 2027, 'open'),
  ('13000000-0000-0000-0000-000000000002', '2027/28', 2027, 2028, 'upcoming')
on conflict (id) do nothing;

insert into public.catalog_sources (id, name, url, source_owner, extractor_version, fetch_policy, enabled, last_verified_at)
values
  ('15000000-0000-0000-0000-000000000001', 'Edinburgh course page', 'https://www.ed.ac.uk/studying/postgraduate/degrees/index.php?r=site/view&id=951', 'University of Edinburgh', 'manual', 'monthly', true, now()),
  ('15000000-0000-0000-0000-000000000002', 'Manchester course page', 'https://www.manchester.ac.uk/study/postgraduate-taught/courses/', 'University of Manchester', 'manual', 'monthly', true, now()),
  ('15000000-0000-0000-0000-000000000003', 'Birmingham course page', 'https://www.birmingham.ac.uk/study/postgraduate/taught/courses', 'University of Birmingham', 'manual', 'monthly', true, now())
on conflict (id) do nothing;

-- Intakes carry the cycle-scoped fee and (where known) deadline provenance.
insert into public.catalog_course_intakes (id, course_id, application_cycle_id, intake_month, intake_year, closed, tuition_fee, fee_currency_code, fee_source_id, fee_observed_at)
values
  ('14000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 9, 2026, false, 33400, 'GBP', '15000000-0000-0000-0000-000000000001', now()),
  ('14000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000001', 9, 2026, false, 33500, 'GBP', '15000000-0000-0000-0000-000000000002', now()),
  ('14000000-0000-0000-0000-000000000003', '12000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000001', 9, 2026, false, 30340, 'GBP', '15000000-0000-0000-0000-000000000003', now())
on conflict (id) do nothing;

-- Requirements are development fixtures. They are manually curated from the
-- linked official sources and marked human_verified for local use; ingestion
-- in production never writes verified facts directly.
insert into public.catalog_course_requirements (id, course_id, kind, structured, source_text, source_id, effective_from, verification_status)
values
  (
    '16000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    'academic',
    '{"degreeClass":"2:1","degreeField":"mathematics, statistics, physics, computer science, engineering","gradesLevel":"uk_undergraduate"}',
    'A UK 2:1 honours degree or its international equivalent in mathematics, statistics, physics, computer science or engineering.',
    '15000000-0000-0000-0000-000000000001',
    now(),
    'human_verified'
  ),
  (
    '16000000-0000-0000-0000-000000000002',
    '12000000-0000-0000-0000-000000000001',
    'language',
    '{"test":"IELTS","minimumBand":6.5,"overallRequired":true,"componentMinimum":6.0}',
    'IELTS 6.5 with at least 6.0 in each component (or equivalent).',
    '15000000-0000-0000-0000-000000000001',
    now(),
    'human_verified'
  ),
  (
    '16000000-0000-0000-0000-000000000003',
    '12000000-0000-0000-0000-000000000002',
    'academic',
    '{"degreeClass":"2:1","degreeField":"computer science or related","gradesLevel":"uk_undergraduate"}',
    'A UK 2:1 honours degree in computer science or a related discipline.',
    '15000000-0000-0000-0000-000000000002',
    now(),
    'human_verified'
  ),
  (
    '16000000-0000-0000-0000-000000000004',
    '12000000-0000-0000-0000-000000000003',
    'academic',
    '{"degreeClass":"2:1","degreeField":"business, finance, economics or related","gradesLevel":"uk_undergraduate"}',
    'A UK 2:1 honours degree in business, finance, economics or a related discipline.',
    '15000000-0000-0000-0000-000000000003',
    now(),
    'human_verified'
  )
on conflict (id) do nothing;

-- ── Demo application case (student profile resolved from the auth link) ─────
insert into public.application_cases (id, student_id, institution_id, course_id, course_intake_id, application_cycle_id, current_status, application_route)
select
  '20000000-0000-0000-0000-000000000001',
  sp.id,
  '10000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000001',
  '14000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000001',
  'draft',
  'institution_direct'
from public.student_profiles sp
where sp.user_id = '00000000-0000-0000-0000-000000000001'
on conflict (id) do nothing;

insert into public.application_events (case_id, event_type, status, actor_user_id, message)
select
  '20000000-0000-0000-0000-000000000001',
  'created',
  'draft',
  '00000000-0000-0000-0000-000000000001',
  'Application case created from seed data.'
where not exists (
  select 1 from public.application_events
  where case_id = '20000000-0000-0000-0000-000000000001'
    and event_type = 'created'
);

insert into public.application_tasks (case_id, title, description, source, priority, status, due_at)
values (
  '20000000-0000-0000-0000-000000000001',
  'Upload academic transcript',
  'Upload your latest academic transcript to verify your qualifications.',
  'system_rule',
  'high',
  'pending',
  now() + interval '14 days'
)
on conflict (id) do nothing;
-- ═══════════════════════════════════════════════════════════════════════════
-- Milestone 2 catalogue expansion
--
-- Additional universities/courses are DEVELOPMENT FIXTURES: the courses,
-- requirements and fees are fabricated sample content for exercising search,
-- filters, pagination and provenance display. They are never labelled as
-- verified facts — requirements carry no source (shown as fixtures in the
-- UI) and verification_status stays `unverified`.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.catalog_institutions (id, name, slug, country_code, city, website_url)
values
  ('31000000-0000-0000-0000-000000000001', 'University of Glasgow', 'university-of-glasgow', 'GB', 'Glasgow', 'https://www.gla.ac.uk'),
  ('31000000-0000-0000-0000-000000000002', 'University of Leeds', 'university-of-leeds', 'GB', 'Leeds', 'https://www.leeds.ac.uk')
on conflict (id) do nothing;

insert into public.catalog_subjects (id, code, slug, name)
values
  ('31000000-0000-0000-0000-000000000003', 'law', 'law', 'Law'),
  ('31000000-0000-0000-0000-000000000004', 'engineering', 'engineering', 'Engineering'),
  ('31000000-0000-0000-0000-000000000005', 'business', 'business', 'Business')
on conflict (id) do nothing;

-- Courses: existing curated set plus undergraduate/postgraduate fixtures.
insert into public.catalog_courses (id, institution_id, subject_id, title, slug, level, duration_months, tuition_fee, currency_code, application_routes, international_applicants_supported)
values
  -- Curated set (official sources below)
  ('32000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'BSc Computer Science', 'bsc-computer-science', 'undergraduate', 48, 28950, 'GBP', '{ucas,institution_direct}', true),
  ('32000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000005', 'BSc Economics', 'bsc-economics', 'undergraduate', 36, 26040, 'GBP', '{ucas,institution_direct}', true),
  -- Development fixtures (no official source; unverified)
  ('32000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000005', 'MSc Business Analytics', 'msc-business-analytics', 'postgraduate_taught', 12, 31500, 'GBP', '{institution_direct}', true),
  ('32000000-0000-0000-0000-000000000004', '31000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000003', 'LLB Law', 'llb-law', 'undergraduate', 48, 22500, 'GBP', '{ucas}', true),
  ('32000000-0000-0000-0000-000000000005', '31000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000003', 'MSc Law', 'msc-law', 'postgraduate_taught', 12, 26000, 'GBP', '{institution_direct}', true),
  ('32000000-0000-0000-0000-000000000006', '31000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000004', 'BEng Mechanical Engineering', 'beng-mechanical-engineering', 'undergraduate', 48, 27000, 'GBP', '{ucas,institution_direct}', true),
  ('32000000-0000-0000-0000-000000000007', '31000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', 'MSc Data Science and AI', 'msc-data-science-and-ai', 'postgraduate_taught', 12, 29500, 'GBP', '{institution_direct}', true)
on conflict (id) do nothing;

insert into public.catalog_application_cycles (id, code, starts_year, ends_year, status)
values
  ('33000000-0000-0000-0000-000000000001', '2028/29', 2028, 2029, 'upcoming')
on conflict (id) do nothing;

insert into public.catalog_sources (id, name, url, source_owner, extractor_version, fetch_policy, enabled, last_verified_at)
values
  ('35000000-0000-0000-0000-000000000001', 'Edinburgh undergraduate prospectus', 'https://www.ed.ac.uk/studying/undergraduate', 'University of Edinburgh', 'manual', 'monthly', true, now()),
  ('35000000-0000-0000-0000-000000000002', 'Birmingham undergraduate prospectus', 'https://www.birmingham.ac.uk/study/undergraduate', 'University of Birmingham', 'manual', 'monthly', true, now())
on conflict (id) do nothing;

-- Intakes for the new courses (fixture courses keep deadlines/provenance null;
-- the curated additions carry deadline provenance from their official source).
insert into public.catalog_course_intakes (id, course_id, application_cycle_id, intake_month, intake_year, closed, tuition_fee, fee_currency_code, fee_source_id, fee_observed_at, application_deadline, application_deadline_source_id, application_deadline_observed_at)
values
  -- Curated additions
  ('34000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 9, 2026, false, 28950, 'GBP', '35000000-0000-0000-0000-000000000001', now(), '2026-01-29 23:59:59+00', '35000000-0000-0000-0000-000000000001', now()),
  ('34000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000001', 9, 2026, false, 26040, 'GBP', '35000000-0000-0000-0000-000000000002', now(), '2026-01-29 23:59:59+00', '35000000-0000-0000-0000-000000000002', now()),
  -- Development fixtures
  ('34000000-0000-0000-0000-000000000003', '32000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000001', 9, 2026, false, 31500, 'GBP', null, now(), null, null, null),
  ('34000000-0000-0000-0000-000000000004', '32000000-0000-0000-0000-000000000004', '13000000-0000-0000-0000-000000000001', 9, 2026, false, 22500, 'GBP', null, now(), null, null, null),
  ('34000000-0000-0000-0000-000000000005', '32000000-0000-0000-0000-000000000005', '13000000-0000-0000-0000-000000000001', 9, 2026, false, 26000, 'GBP', null, now(), null, null, null),
  ('34000000-0000-0000-0000-000000000006', '32000000-0000-0000-0000-000000000006', '13000000-0000-0000-0000-000000000001', 9, 2026, false, 27000, 'GBP', null, now(), null, null, null),
  ('34000000-0000-0000-0000-000000000007', '32000000-0000-0000-0000-000000000007', '13000000-0000-0000-0000-000000000001', 9, 2026, false, 29500, 'GBP', null, now(), null, null, null),
  -- 2027/28 intakes for fixture courses (so the entry-year filter has data)
  ('34000000-0000-0000-0000-000000000008', '32000000-0000-0000-0000-000000000007', '13000000-0000-0000-0000-000000000002', 9, 2027, false, 30500, 'GBP', null, now(), null, null, null),
  ('34000000-0000-0000-0000-000000000009', '32000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000002', 9, 2027, false, 32500, 'GBP', null, now(), null, null, null)
on conflict (id) do nothing;

-- Requirements for the curated undergraduate additions (verified, official).
insert into public.catalog_course_requirements (id, course_id, kind, structured, source_text, source_id, effective_from, verification_status)
values
  (
    '36000000-0000-0000-0000-000000000001',
    '32000000-0000-0000-0000-000000000001',
    'academic',
    '{"aLevels":"AAA","aLevelSubjects":"mathematics","gradesLevel":"a_level"}',
    'AAA at A Level including Mathematics. International equivalents accepted.',
    '35000000-0000-0000-0000-000000000001',
    now(),
    'human_verified'
  ),
  (
    '36000000-0000-0000-0000-000000000002',
    '32000000-0000-0000-0000-000000000001',
    'language',
    '{"test":"IELTS","minimumBand":6.5,"componentMinimum":5.5}',
    'IELTS 6.5 overall with at least 5.5 in each component (or equivalent).',
    '35000000-0000-0000-0000-000000000001',
    now(),
    'human_verified'
  ),
  (
    '36000000-0000-0000-0000-000000000003',
    '32000000-0000-0000-0000-000000000002',
    'academic',
    '{"aLevels":"AAB","aLevelSubjects":"mathematics, economics","gradesLevel":"a_level"}',
    'AAB at A Level including Mathematics and Economics (or equivalent).',
    '35000000-0000-0000-0000-000000000002',
    now(),
    'human_verified'
  ),
  -- Fixture requirements (no source → shown as development fixtures in the UI)
  (
    '36000000-0000-0000-0000-000000000004',
    '32000000-0000-0000-0000-000000000004',
    'academic',
    '{"aLevels":"ABB","gradesLevel":"a_level"}',
    'ABB at A Level (development fixture — not verified against the official source).',
    null,
    now(),
    'unverified'
  ),
  (
    '36000000-0000-0000-0000-000000000005',
    '32000000-0000-0000-0000-000000000007',
    'academic',
    '{"degreeClass":"2:1","degreeField":"computer science, mathematics, engineering","gradesLevel":"uk_undergraduate"}',
    'A UK 2:1 honours degree in a quantitative discipline (development fixture).',
    null,
    now(),
    'unverified'
  )
on conflict (id) do nothing;
