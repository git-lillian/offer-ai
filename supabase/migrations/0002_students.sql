-- 0002_students.sql
-- Student 360: canonical student profile, education, qualifications,
-- experiences, goals.

-- The canonical student profile. `user_id` equals auth.users.id.
create table if not exists public.student_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  current_country_code text check (current_country_code ~ '^[A-Z]{2}$'),
  nationality_country_code text check (nationality_country_code ~ '^[A-Z]{2}$'),
  current_education_level text,
  intended_study_level text check (intended_study_level in (
    'foundation', 'undergraduate', 'postgraduate_taught', 'postgraduate_research', 'phd'
  )),
  target_subject_areas text[] not null default '{}',
  target_entry_year integer check (target_entry_year between 2025 and 2035),
  target_country_codes text[] not null default '{}',
  budget_min integer check (budget_min >= 0),
  budget_max integer check (budget_max >= 0),
  budget_currency_code text check (budget_currency_code ~ '^[A-Z]{3}$'),
  english_proficiency_status text check (english_proficiency_status in (
    'not_taken', 'planned', 'taken', 'exempt'
  )),
  onboarding_completed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint student_profiles_name_len check (char_length(btrim(full_name)) between 2 and 120),
  constraint student_profiles_budget_order check (
    budget_min is null or budget_max is null or budget_min <= budget_max
  )
);

-- Academic history: schools and universities attended.
create table if not exists public.student_education (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (user_id) on delete cascade,
  institution_name text not null,
  country_code text not null default 'GB' check (country_code ~ '^[A-Z]{2}$'),
  started_year integer not null check (started_year between 1970 and 2100),
  ended_year integer check (ended_year between 1970 and 2100),
  degree_title text,
  created_at timestamptz not null default now()
);

create index if not exists student_education_student_idx
  on public.student_education (student_id);

-- Qualifications: structured, comparable (not free text).
create table if not exists public.student_qualifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (user_id) on delete cascade,
  qualification_system text not null check (qualification_system in (
    'a_level', 'ib', 'ap', 'gcse', 'chinese_gaokao', 'chinese_undergraduate',
    'uk_undergraduate', 'other'
  )),
  title text not null,
  institution_name text,
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  grade text,
  predicted_grade text,
  overall_gpa numeric(3,2) check (overall_gpa between 0 and 5),
  completed_year integer check (completed_year between 1970 and 2100),
  created_at timestamptz not null default now()
);

create index if not exists student_qualifications_student_idx
  on public.student_qualifications (student_id);

-- Experiences: employment, internships, volunteering, projects, awards...
create table if not exists public.student_experiences (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (user_id) on delete cascade,
  experience_type text not null check (experience_type in (
    'employment', 'internship', 'volunteering', 'project', 'leadership',
    'award', 'competition', 'research', 'extracurricular', 'certification', 'other'
  )),
  title text not null,
  organisation_name text,
  started_at timestamptz,
  ended_at timestamptz,
  description text not null default '',
  created_at timestamptz not null default now(),
  constraint student_experiences_date_order check (
    started_at is null or ended_at is null or ended_at >= started_at
  )
);

create index if not exists student_experiences_student_idx
  on public.student_experiences (student_id);

-- Goals: study and career goals (kept relational, not JSONB).
create table if not exists public.student_goals (
  student_id uuid primary key references public.student_profiles (user_id) on delete cascade,
  study_goals text not null default '',
  career_goals text not null default '',
  updated_at timestamptz not null default now()
);
