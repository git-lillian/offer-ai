-- Development seed data. No real personal data.
--
-- Run with: pnpm db:seed
-- The demo auth user is provisioned by the seed runner through the Auth
-- admin API; this SQL only seeds the catalogue and a demo case.

-- ── Demo profile (auth user provisioned by the runner) ─────────────────────
insert into public.student_profiles (user_id, full_name, email)
values (
  '00000000-0000-0000-0000-000000000001',
  'Demo Student',
  'demo.student@offer-ai.local'
)
on conflict (user_id) do nothing;

insert into public.identity_user_roles (user_id, role_code)
values ('00000000-0000-0000-0000-000000000001', 'student')
on conflict do nothing;

insert into public.user_preferences (user_id)
values ('00000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- ── Catalogue ──────────────────────────────────────────────────────────────
insert into public.catalog_institutions (id, name, country_code, city, website_url)
values
  ('10000000-0000-0000-0000-000000000001', 'University of Edinburgh', 'GB', 'Edinburgh', 'https://www.ed.ac.uk'),
  ('10000000-0000-0000-0000-000000000002', 'University of Manchester', 'GB', 'Manchester', 'https://www.manchester.ac.uk'),
  ('10000000-0000-0000-0000-000000000003', 'University of Birmingham', 'GB', 'Birmingham', 'https://www.birmingham.ac.uk')
on conflict (id) do nothing;

insert into public.catalog_subjects (id, code, name)
values
  ('11000000-0000-0000-0000-000000000001', 'comp-sci', 'Computer Science'),
  ('11000000-0000-0000-0000-000000000002', 'data-sci', 'Data Science'),
  ('11000000-0000-0000-0000-000000000003', 'finance', 'Finance')
on conflict (id) do nothing;

insert into public.catalog_courses (id, institution_id, subject_id, title, level, duration_months, tuition_fee, currency_code)
values
  ('12000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'MSc Data Science', 'postgraduate_taught', 12, 33400, 'GBP'),
  ('12000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'MSc Advanced Computer Science', 'postgraduate_taught', 12, 33500, 'GBP'),
  ('12000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000003', 'MSc Financial Management', 'postgraduate_taught', 12, 30340, 'GBP')
on conflict (id) do nothing;

insert into public.catalog_application_cycles (id, code, starts_year, ends_year, status)
values
  ('13000000-0000-0000-0000-000000000001', '2026/27', 2026, 2027, 'open'),
  ('13000000-0000-0000-0000-000000000002', '2027/28', 2027, 2028, 'upcoming')
on conflict (id) do nothing;

insert into public.catalog_course_intakes (id, course_id, application_cycle_id, intake_month, intake_year, closed)
values
  ('14000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 9, 2026, false),
  ('14000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000001', 9, 2026, false),
  ('14000000-0000-0000-0000-000000000003', '12000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000001', 9, 2026, false)
on conflict (id) do nothing;

insert into public.catalog_sources (id, name, url, source_owner, extractor_version, fetch_policy, enabled)
values
  ('15000000-0000-0000-0000-000000000001', 'Edinburgh course page', 'https://www.ed.ac.uk/studying/postgraduate/degrees/index.php?r=site/view&id=951', 'University of Edinburgh', 'manual', 'monthly', true),
  ('15000000-0000-0000-0000-000000000002', 'Manchester course page', 'https://www.manchester.ac.uk/study/postgraduate-taught/courses/', 'University of Manchester', 'manual', 'monthly', true),
  ('15000000-0000-0000-0000-000000000003', 'Birmingham course page', 'https://www.birmingham.ac.uk/study/postgraduate/taught/courses', 'University of Birmingham', 'manual', 'monthly', true)
on conflict (id) do nothing;

insert into public.catalog_course_requirements (id, course_id, kind, structured, source_text, source_id, effective_from)
values
  (
    '16000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    'academic',
    '{"degreeClass":"2:1","degreeField":"mathematics, statistics, physics, computer science, engineering","gradesLevel":"uk_undergraduate"}',
    'A UK 2:1 honours degree or its international equivalent in mathematics, statistics, physics, computer science or engineering.',
    '15000000-0000-0000-0000-000000000001',
    now()
  ),
  (
    '16000000-0000-0000-0000-000000000002',
    '12000000-0000-0000-0000-000000000001',
    'language',
    '{"test":"IELTS","minimumBand":6.5,"overallRequired":true,"componentMinimum":6.0}',
    'IELTS 6.5 with at least 6.0 in each component (or equivalent).',
    '15000000-0000-0000-0000-000000000001',
    now()
  ),
  (
    '16000000-0000-0000-0000-000000000003',
    '12000000-0000-0000-0000-000000000002',
    'academic',
    '{"degreeClass":"2:1","degreeField":"computer science or related","gradesLevel":"uk_undergraduate"}',
    'A UK 2:1 honours degree in computer science or a related discipline.',
    '15000000-0000-0000-0000-000000000002',
    now()
  ),
  (
    '16000000-0000-0000-0000-000000000004',
    '12000000-0000-0000-0000-000000000003',
    'academic',
    '{"degreeClass":"2:1","degreeField":"business, finance, economics or related","gradesLevel":"uk_undergraduate"}',
    'A UK 2:1 honours degree in business, finance, economics or a related discipline.',
    '15000000-0000-0000-0000-000000000003',
    now()
  )
on conflict (id) do nothing;

-- ── Demo application case ──────────────────────────────────────────────────
insert into public.application_cases (id, student_id, institution_id, course_id, course_intake_id, application_cycle_id, current_status)
values (
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000001',
  '14000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000001',
  'draft'
)
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
