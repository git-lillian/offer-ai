-- 0014_student_360_hardening.sql
-- Remove UK-centric assumptions and improve international extensibility.
--
-- 1. target_entry_year check widened (was a UK-current-year window).
-- 2. country_code defaults removed (a Chinese student's education record must
--    not silently default to GB).
-- 3. user_preferences defaults removed (locale/timezone/currency are per-user).
-- 4. Qualification systems become a lookup table (extensible without
--    migration), GPA scale is explicit, GPA bound decoupled from a 5-point
--    assumption.

-- ── 1) Entry year window ────────────────────────────────────────────────────
alter table public.student_profiles
  drop constraint student_profiles_target_entry_year_check;
alter table public.student_profiles
  add constraint student_profiles_target_entry_year_check
    check (target_entry_year between 2000 and 2100);

-- ── 2) Country defaults ─────────────────────────────────────────────────────
alter table public.organisations
  alter column country_code drop default,
  alter column country_code drop not null;

alter table public.student_education
  alter column country_code drop default,
  alter column country_code drop not null;

-- ── 3) User preferences: no implicit UK locale ──────────────────────────────
alter table public.user_preferences
  alter column locale drop default,
  alter column locale drop not null,
  alter column timezone drop default,
  alter column timezone drop not null,
  alter column currency_code drop default,
  alter column currency_code drop not null;

-- ── 4) International qualification extensibility ────────────────────────────
-- Lookup table: new national systems can be added without a migration.
create table if not exists public.qualification_systems (
  code text primary key,
  name text not null,
  description text,
  country_codes text[] not null default '{}',
  grading_scale text
);

insert into public.qualification_systems (code, name, description, country_codes, grading_scale) values
  ('a_level', 'A Levels', 'UK / international advanced level subject qualifications', '{GB}', 'A*-E'),
  ('as_level', 'AS Levels', 'UK advanced subsidiary level', '{GB}', 'A-E'),
  ('gcse', 'GCSE', 'UK General Certificate of Secondary Education', '{GB}', '9-1'),
  ('ib', 'International Baccalaureate Diploma', 'IB diploma programme', '{}', '7-1 per subject'),
  ('ib_certificate', 'IB Certificates', 'IB subject certificates', '{}', '7-1'),
  ('ap', 'Advanced Placement', 'US / international AP exams', '{US}', '5-1'),
  ('us_high_school', 'US High School Diploma', 'US high school transcript', '{US}', 'GPA 4.0'),
  ('gaokao', 'Gaokao', 'Chinese National College Entrance Examination', '{CN}', 'score'),
  ('chinese_gaokao', 'Gaokao (legacy)', 'Chinese National College Entrance Examination (legacy code)', '{CN}', 'score'),
  ('chinese_undergraduate', 'Chinese Undergraduate Degree', 'Chinese bachelors degree', '{CN}', 'GPA 4.0/5.0'),
  ('hong_kong_dse', 'Hong Kong DSE', 'Hong Kong Diploma of Secondary Education', '{HK}', '5**-1'),
  ('australian_atar', 'Australian ATAR', 'Australian Tertiary Admission Rank', '{AU}', '99.95-0'),
  ('canadian_high_school', 'Canadian High School Diploma', 'Provincial high school diplomas', '{CA}', 'percentage'),
  ('french_baccalaureat', 'French Baccalaureat', 'French national secondary qualification', '{FR}', '20-0'),
  ('german_abitur', 'German Abitur', 'German university-entrance qualification', '{DE}', '1.0-4.0'),
  ('indian_standard_xii', 'Indian Standard XII', 'Indian Class XII board examinations', '{IN}', 'percentage'),
  ('malaysian_stpm', 'Malaysian STPM', 'Sijil Tinggi Persekolahan Malaysia', '{MY}', 'A-F'),
  ('singapore_a_level', 'Singapore A Levels', 'Singapore Cambridge A Levels', '{SG}', 'A-U'),
  ('international_foundation', 'International Foundation', 'Foundation year for international applicants', '{}', 'varies'),
  ('uk_undergraduate', 'UK Undergraduate Degree', 'UK bachelors honours degree', '{GB}', 'First/2:1/2:2/3rd'),
  ('uk_postgraduate', 'UK Postgraduate Degree', 'UK masters / doctoral qualification', '{GB}', 'distinction/merit/pass'),
  ('other', 'Other', 'Any qualification not otherwise listed', '{}', 'varies')
on conflict (code) do nothing;

alter table public.student_qualifications
  drop constraint student_qualifications_qualification_system_check;
alter table public.student_qualifications
  add constraint student_qualifications_qualification_system_fk
    foreign key (qualification_system) references public.qualification_systems (code);

-- Explicit GPA scale (e.g. 4.0, 5.0, 10); overall_gpa no longer assumes a
-- 5-point scale.
alter table public.student_qualifications
  drop constraint student_qualifications_overall_gpa_check;
alter table public.student_qualifications
  add constraint student_qualifications_overall_gpa_nonnegative
    check (overall_gpa is null or overall_gpa >= 0);
alter table public.student_qualifications
  add column gpa_scale_max numeric check (gpa_scale_max > 0);