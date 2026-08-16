-- 0011_student_identity.sql
-- Student becomes an independent domain entity with its own UUID primary
-- key, decoupled from auth.users.
--
-- Before: student_profiles.user_id (== auth.users.id) was the PK and every
--         child table FK'd to it. A student could only exist if an auth
--         account already existed.
-- After:  student_profiles.id is the canonical student id. user_id is the
--         nullable link to the claimed auth account. This supports
--         guardian-created students, adviser-created prospects and student
--         account claiming/linking.
--
-- All child tables are repointed from student_profiles(user_id) to
-- student_profiles(id) and backfilled from the old link.

-- ── 0) Drop child FKs first (they reference the user_id PK) ─────────────────
-- Also drop the 0008 RLS policies that reference student_id columns; 0012
-- recreates the full policy set against the new schema.
drop policy if exists student_profiles_select_own on public.student_profiles;
drop policy if exists student_profiles_insert_own on public.student_profiles;
drop policy if exists student_profiles_update_own on public.student_profiles;
drop policy if exists student_education_select_own on public.student_education;
drop policy if exists student_education_insert_own on public.student_education;
drop policy if exists student_education_update_own on public.student_education;
drop policy if exists student_qualifications_select_own on public.student_qualifications;
drop policy if exists student_qualifications_insert_own on public.student_qualifications;
drop policy if exists student_qualifications_update_own on public.student_qualifications;
drop policy if exists student_experiences_select_own on public.student_experiences;
drop policy if exists student_experiences_insert_own on public.student_experiences;
drop policy if exists student_experiences_update_own on public.student_experiences;
drop policy if exists student_goals_select_own on public.student_goals;
drop policy if exists student_goals_insert_own on public.student_goals;
drop policy if exists student_goals_update_own on public.student_goals;
drop policy if exists evidence_items_select_own on public.evidence_items;
drop policy if exists evidence_items_insert_own on public.evidence_items;
drop policy if exists evidence_items_update_own on public.evidence_items;
drop policy if exists documents_select_own on public.documents;
drop policy if exists documents_insert_own on public.documents;
drop policy if exists application_cases_select_own on public.application_cases;
drop policy if exists application_cases_insert_own on public.application_cases;
drop policy if exists application_cases_update_own on public.application_cases;
drop policy if exists application_events_select_own on public.application_events;
drop policy if exists application_events_insert_own on public.application_events;
drop policy if exists application_tasks_select_own on public.application_tasks;
drop policy if exists application_tasks_insert_own on public.application_tasks;
drop policy if exists application_tasks_update_own on public.application_tasks;
drop policy if exists application_case_documents_select_own on public.application_case_documents;
drop policy if exists artifacts_select_own on public.artifacts;
drop policy if exists artifacts_insert_own on public.artifacts;
drop policy if exists artifact_versions_select_own on public.artifact_versions;
drop policy if exists artifact_versions_insert_own on public.artifact_versions;
drop policy if exists access_grants_select_participant on public.access_grants;
drop policy if exists access_grants_insert_student on public.access_grants;

alter table public.student_education drop constraint student_education_student_id_fkey;
alter table public.student_qualifications drop constraint student_qualifications_student_id_fkey;
alter table public.student_experiences drop constraint student_experiences_student_id_fkey;
alter table public.student_goals drop constraint student_goals_pkey;
alter table public.student_goals drop constraint student_goals_student_id_fkey;
alter table public.evidence_items drop constraint evidence_items_student_id_fkey;
alter table public.documents drop constraint documents_student_id_fkey;
alter table public.application_cases drop constraint application_cases_student_id_fkey;
alter table public.artifacts drop constraint artifacts_student_id_fkey;
alter table public.access_grants drop constraint access_grants_student_id_fkey;
alter table public.ai_runs drop constraint ai_runs_student_id_fkey;

-- ── 1) student_profiles identity columns ────────────────────────────────────
-- Add the new primary key column first (existing rows get a random id).
alter table public.student_profiles
  add column id uuid not null default gen_random_uuid();

alter table public.student_profiles
  drop constraint student_profiles_pkey;

alter table public.student_profiles
  add constraint student_profiles_pkey primary key (id);

-- One auth account may link to at most one student profile.
alter table public.student_profiles
  add constraint student_profiles_user_id_key unique (user_id);

-- Account lifecycle: unclaimed (created by guardian/adviser, no auth link
-- yet) -> claimed (auth account linked) -> closed.
alter table public.student_profiles
  alter column user_id drop not null,
  add column account_status text not null default 'unclaimed'
    check (account_status in ('unclaimed', 'claimed', 'closed')),
  add column claimed_at timestamptz,
  add column created_by_user_id uuid references auth.users (id) on delete set null;

-- Email may be unknown for adviser-created prospects.
alter table public.student_profiles
  alter column email drop not null;

-- ── 2) Repoint every child table to student_profiles(id) ────────────────────
-- Each child table: add a new column FK'd to student_profiles(id), backfill
-- from the old user_id link, then swap the column in place and recreate the
-- lookup index.

-- student_education
alter table public.student_education
  add column student_profile_id uuid references public.student_profiles (id) on delete cascade;
update public.student_education se
   set student_profile_id = sp.id
  from public.student_profiles sp
 where sp.user_id = se.student_id;
alter table public.student_education alter column student_profile_id set not null;
alter table public.student_education drop column student_id;
alter table public.student_education rename column student_profile_id to student_id;
drop index if exists public.student_education_student_idx;
create index student_education_student_idx on public.student_education (student_id);

-- student_qualifications
alter table public.student_qualifications
  add column student_profile_id uuid references public.student_profiles (id) on delete cascade;
update public.student_qualifications sq
   set student_profile_id = sp.id
  from public.student_profiles sp
 where sp.user_id = sq.student_id;
alter table public.student_qualifications alter column student_profile_id set not null;
alter table public.student_qualifications drop column student_id;
alter table public.student_qualifications rename column student_profile_id to student_id;
drop index if exists public.student_qualifications_student_idx;
create index student_qualifications_student_idx on public.student_qualifications (student_id);

-- student_experiences
alter table public.student_experiences
  add column student_profile_id uuid references public.student_profiles (id) on delete cascade;
update public.student_experiences sx
   set student_profile_id = sp.id
  from public.student_profiles sp
 where sp.user_id = sx.student_id;
alter table public.student_experiences alter column student_profile_id set not null;
alter table public.student_experiences drop column student_id;
alter table public.student_experiences rename column student_profile_id to student_id;
drop index if exists public.student_experiences_student_idx;
create index student_experiences_student_idx on public.student_experiences (student_id);

-- student_goals (PK column is the FK to student_profiles)
alter table public.student_goals
  add column student_profile_id uuid references public.student_profiles (id) on delete cascade;
update public.student_goals sg
   set student_profile_id = sp.id
  from public.student_profiles sp
 where sp.user_id = sg.student_id;
alter table public.student_goals alter column student_profile_id set not null;
alter table public.student_goals drop column student_id;
alter table public.student_goals rename column student_profile_id to student_id;
alter table public.student_goals add constraint student_goals_pkey primary key (student_id);

-- evidence_items
alter table public.evidence_items
  add column student_profile_id uuid references public.student_profiles (id) on delete cascade;
update public.evidence_items ei
   set student_profile_id = sp.id
  from public.student_profiles sp
 where sp.user_id = ei.student_id;
alter table public.evidence_items alter column student_profile_id set not null;
alter table public.evidence_items drop column student_id;
alter table public.evidence_items rename column student_profile_id to student_id;
drop index if exists public.evidence_items_student_idx;
create index evidence_items_student_idx on public.evidence_items (student_id);

-- documents
alter table public.documents
  add column student_profile_id uuid references public.student_profiles (id) on delete cascade;
update public.documents d
   set student_profile_id = sp.id
  from public.student_profiles sp
 where sp.user_id = d.student_id;
alter table public.documents alter column student_profile_id set not null;
alter table public.documents drop column student_id;
alter table public.documents rename column student_profile_id to student_id;
drop index if exists public.documents_student_idx;
create index documents_student_idx on public.documents (student_id);

-- application_cases
alter table public.application_cases
  add column student_profile_id uuid references public.student_profiles (id) on delete cascade;
update public.application_cases ac
   set student_profile_id = sp.id
  from public.student_profiles sp
 where sp.user_id = ac.student_id;
alter table public.application_cases alter column student_profile_id set not null;
alter table public.application_cases drop column student_id;
alter table public.application_cases rename column student_profile_id to student_id;
drop index if exists public.application_cases_student_idx;
create index application_cases_student_idx on public.application_cases (student_id, created_at desc);

-- artifacts
alter table public.artifacts
  add column student_profile_id uuid references public.student_profiles (id) on delete cascade;
update public.artifacts a
   set student_profile_id = sp.id
  from public.student_profiles sp
 where sp.user_id = a.student_id;
alter table public.artifacts alter column student_profile_id set not null;
alter table public.artifacts drop column student_id;
alter table public.artifacts rename column student_profile_id to student_id;
drop index if exists public.artifacts_student_idx;
create index artifacts_student_idx on public.artifacts (student_id);

-- access_grants
alter table public.access_grants
  add column student_profile_id uuid references public.student_profiles (id) on delete cascade;
update public.access_grants ag
   set student_profile_id = sp.id
  from public.student_profiles sp
 where sp.user_id = ag.student_id;
alter table public.access_grants alter column student_profile_id set not null;
alter table public.access_grants drop column student_id;
alter table public.access_grants rename column student_profile_id to student_id;
drop index if exists public.access_grants_student_idx;
create index access_grants_student_idx on public.access_grants (student_id, status);

-- ai_runs (nullable FK — kept on delete set null)
alter table public.ai_runs
  add column student_profile_id uuid references public.student_profiles (id) on delete set null;
update public.ai_runs ar
   set student_profile_id = sp.id
  from public.student_profiles sp
 where sp.user_id = ar.student_id;
alter table public.ai_runs drop column student_id;
alter table public.ai_runs rename column student_profile_id to student_id;
drop index if exists public.ai_runs_student_idx;
create index ai_runs_student_idx on public.ai_runs (student_id, created_at desc);

-- ── 3) Signup hook: self-registration claims the profile ────────────────────
-- A new account claims a matching unclaimed prospect (adviser/guardian
-- created with the student's real email) before falling back to creating a
-- fresh claimed profile. This makes the adviser → student handoff seamless.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.student_profiles
     set user_id = new.id, account_status = 'claimed', claimed_at = now()
   where email = new.email
     and user_id is null
     and account_status = 'unclaimed';

  insert into public.student_profiles (user_id, full_name, email, account_status, claimed_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Student'),
    new.email,
    'claimed',
    now()
  )
  on conflict (user_id) do nothing;

  insert into public.identity_user_roles (user_id, role_code)
  values (new.id, 'student')
  on conflict do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict do nothing;

  return new;
end;
$$;