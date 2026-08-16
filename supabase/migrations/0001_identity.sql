-- 0001_identity.sql
-- Identity: roles, user roles, preferences, organisations, memberships.

-- Roles are a lookup table (not a database enum) so they can evolve.
create table if not exists public.identity_roles (
  code text primary key,
  name text not null,
  description text
);

insert into public.identity_roles (code, name, description) values
  ('student', 'Student', 'Applicant using the platform'),
  ('guardian', 'Guardian', 'Parent or guardian with granted access'),
  ('adviser', 'Adviser', 'Human adviser or reviewer'),
  ('reviewer', 'Reviewer', 'Document reviewer'),
  ('mentor', 'Mentor', 'Mentor'),
  ('agency_staff', 'Agency staff', 'Staff of an education agency'),
  ('opportunity_provider', 'Opportunity provider', 'Internship/volunteering provider'),
  ('platform_staff', 'Platform staff', 'Offer.ai employee'),
  ('administrator', 'Administrator', 'Platform administrator')
on conflict (code) do nothing;

-- Users may hold multiple roles.
create table if not exists public.identity_user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role_code text not null references public.identity_roles (code),
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_code)
);

create index if not exists identity_user_roles_user_idx
  on public.identity_user_roles (user_id);

-- User preferences: locale, timezone, currency.
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  locale text not null default 'en-GB',
  timezone text not null default 'Europe/London',
  currency_code text not null default 'GBP',
  updated_at timestamptz not null default now(),
  constraint user_preferences_locale_len check (char_length(locale) between 2 and 20),
  constraint user_preferences_timezone_len check (char_length(timezone) between 1 and 64),
  constraint user_preferences_currency_format check (currency_code ~ '^[A-Z]{3}$')
);

-- Organisations: agencies, solo providers, schools, opportunity providers.
create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in (
    'agency', 'solo_provider', 'school', 'university_partner', 'opportunity_provider'
  )),
  country_code text not null default 'GB' check (country_code ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organisations_name_len check (char_length(btrim(name)) between 1 and 200)
);

create table if not exists public.organisation_memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_in_organisation text not null default 'staff',
  joined_at timestamptz not null default now(),
  unique (organisation_id, user_id)
);

create index if not exists organisation_memberships_org_idx
  on public.organisation_memberships (organisation_id);
create index if not exists organisation_memberships_user_idx
  on public.organisation_memberships (user_id);
