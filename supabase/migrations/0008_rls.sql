-- 0008_rls.sql
-- Row Level Security: enable on every table holding student data and
-- define policies. The browser client (anon key) can never bypass these.

-- ── Helper: does the current user have an active grant to a student? ──────
-- SECURITY DEFINER: policies use this function; the function itself queries
-- access_grants as the definer, so grantees can prove access without
-- bypassing RLS on the resource tables.
create or replace function public.has_student_access(target_student_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.access_grants g
    where g.student_id = target_student_id
      and g.grantee_user_id = auth.uid()
      and g.status = 'active'
      and (g.expires_at is null or g.expires_at > now())
  );
$$;

-- ── Identity ───────────────────────────────────────────────────────────────
alter table public.identity_roles enable row level security;
-- Roles are public lookup data.
drop policy if exists identity_roles_read on public.identity_roles;
create policy identity_roles_read
  on public.identity_roles for select
  to anon, authenticated
  using (true);

alter table public.identity_user_roles enable row level security;
drop policy if exists identity_user_roles_select_own on public.identity_user_roles;
create policy identity_user_roles_select_own
  on public.identity_user_roles for select
  to authenticated
  using (user_id = auth.uid());

alter table public.user_preferences enable row level security;
drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own
  on public.user_preferences for select
  to authenticated
  using (user_id = auth.uid());
drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own
  on public.user_preferences for insert
  to authenticated
  with check (user_id = auth.uid());
drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own
  on public.user_preferences for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.organisations enable row level security;
-- Organisation metadata is public lookup data.
drop policy if exists organisations_read on public.organisations;
create policy organisations_read
  on public.organisations for select
  to anon, authenticated
  using (true);

alter table public.organisation_memberships enable row level security;
drop policy if exists organisation_memberships_select_own on public.organisation_memberships;
create policy organisation_memberships_select_own
  on public.organisation_memberships for select
  to authenticated
  using (user_id = auth.uid());

-- ── Student 360 ────────────────────────────────────────────────────────────
alter table public.student_profiles enable row level security;
drop policy if exists student_profiles_select_own on public.student_profiles;
create policy student_profiles_select_own
  on public.student_profiles for select
  to authenticated
  using (user_id = auth.uid() or public.has_student_access(user_id));
drop policy if exists student_profiles_insert_own on public.student_profiles;
create policy student_profiles_insert_own
  on public.student_profiles for insert
  to authenticated
  with check (user_id = auth.uid());
drop policy if exists student_profiles_update_own on public.student_profiles;
create policy student_profiles_update_own
  on public.student_profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.student_education enable row level security;
drop policy if exists student_education_select_own on public.student_education;
create policy student_education_select_own
  on public.student_education for select
  to authenticated
  using (student_id = auth.uid() or public.has_student_access(student_id));
drop policy if exists student_education_insert_own on public.student_education;
create policy student_education_insert_own
  on public.student_education for insert
  to authenticated
  with check (student_id = auth.uid());
drop policy if exists student_education_update_own on public.student_education;
create policy student_education_update_own
  on public.student_education for update
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

alter table public.student_qualifications enable row level security;
drop policy if exists student_qualifications_select_own on public.student_qualifications;
create policy student_qualifications_select_own
  on public.student_qualifications for select
  to authenticated
  using (student_id = auth.uid() or public.has_student_access(student_id));
drop policy if exists student_qualifications_insert_own on public.student_qualifications;
create policy student_qualifications_insert_own
  on public.student_qualifications for insert
  to authenticated
  with check (student_id = auth.uid());
drop policy if exists student_qualifications_update_own on public.student_qualifications;
create policy student_qualifications_update_own
  on public.student_qualifications for update
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

alter table public.student_experiences enable row level security;
drop policy if exists student_experiences_select_own on public.student_experiences;
create policy student_experiences_select_own
  on public.student_experiences for select
  to authenticated
  using (student_id = auth.uid() or public.has_student_access(student_id));
drop policy if exists student_experiences_insert_own on public.student_experiences;
create policy student_experiences_insert_own
  on public.student_experiences for insert
  to authenticated
  with check (student_id = auth.uid());
drop policy if exists student_experiences_update_own on public.student_experiences;
create policy student_experiences_update_own
  on public.student_experiences for update
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

alter table public.student_goals enable row level security;
drop policy if exists student_goals_select_own on public.student_goals;
create policy student_goals_select_own
  on public.student_goals for select
  to authenticated
  using (student_id = auth.uid() or public.has_student_access(student_id));
drop policy if exists student_goals_insert_own on public.student_goals;
create policy student_goals_insert_own
  on public.student_goals for insert
  to authenticated
  with check (student_id = auth.uid());
drop policy if exists student_goals_update_own on public.student_goals;
create policy student_goals_update_own
  on public.student_goals for update
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- ── Evidence & documents ───────────────────────────────────────────────────
alter table public.evidence_items enable row level security;
drop policy if exists evidence_items_select_own on public.evidence_items;
create policy evidence_items_select_own
  on public.evidence_items for select
  to authenticated
  using (student_id = auth.uid() or public.has_student_access(student_id));
drop policy if exists evidence_items_insert_own on public.evidence_items;
create policy evidence_items_insert_own
  on public.evidence_items for insert
  to authenticated
  with check (student_id = auth.uid());
drop policy if exists evidence_items_update_own on public.evidence_items;
create policy evidence_items_update_own
  on public.evidence_items for update
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

alter table public.documents enable row level security;
drop policy if exists documents_select_own on public.documents;
create policy documents_select_own
  on public.documents for select
  to authenticated
  using (student_id = auth.uid() or public.has_student_access(student_id));
drop policy if exists documents_insert_own on public.documents;
create policy documents_insert_own
  on public.documents for insert
  to authenticated
  with check (owner_user_id = auth.uid() and student_id = auth.uid());

-- ── Catalogue (public read; writes are service-role only) ──────────────────
alter table public.catalog_subjects enable row level security;
drop policy if exists catalog_subjects_read on public.catalog_subjects;
create policy catalog_subjects_read
  on public.catalog_subjects for select
  to anon, authenticated
  using (true);

alter table public.catalog_institutions enable row level security;
drop policy if exists catalog_institutions_read on public.catalog_institutions;
create policy catalog_institutions_read
  on public.catalog_institutions for select
  to anon, authenticated
  using (true);

alter table public.catalog_courses enable row level security;
drop policy if exists catalog_courses_read on public.catalog_courses;
create policy catalog_courses_read
  on public.catalog_courses for select
  to anon, authenticated
  using (true);

alter table public.catalog_application_cycles enable row level security;
drop policy if exists catalog_cycles_read on public.catalog_application_cycles;
create policy catalog_cycles_read
  on public.catalog_application_cycles for select
  to anon, authenticated
  using (true);

alter table public.catalog_course_intakes enable row level security;
drop policy if exists catalog_intakes_read on public.catalog_course_intakes;
create policy catalog_intakes_read
  on public.catalog_course_intakes for select
  to anon, authenticated
  using (true);

alter table public.catalog_course_requirements enable row level security;
drop policy if exists catalog_requirements_read on public.catalog_course_requirements;
create policy catalog_requirements_read
  on public.catalog_course_requirements for select
  to anon, authenticated
  using (true);

alter table public.catalog_sources enable row level security;
drop policy if exists catalog_sources_read on public.catalog_sources;
create policy catalog_sources_read
  on public.catalog_sources for select
  to anon, authenticated
  using (true);

-- Internal: no client policies.
alter table public.catalog_source_snapshots enable row level security;

-- ── Admissions ─────────────────────────────────────────────────────────────
alter table public.application_cases enable row level security;
drop policy if exists application_cases_select_own on public.application_cases;
create policy application_cases_select_own
  on public.application_cases for select
  to authenticated
  using (student_id = auth.uid() or public.has_student_access(student_id));
drop policy if exists application_cases_insert_own on public.application_cases;
create policy application_cases_insert_own
  on public.application_cases for insert
  to authenticated
  with check (student_id = auth.uid());
drop policy if exists application_cases_update_own on public.application_cases;
create policy application_cases_update_own
  on public.application_cases for update
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

alter table public.application_events enable row level security;
drop policy if exists application_events_select_own on public.application_events;
create policy application_events_select_own
  on public.application_events for select
  to authenticated
  using (
    exists (
      select 1 from public.application_cases c
      where c.id = case_id
        and (c.student_id = auth.uid() or public.has_student_access(c.student_id))
    )
  );
drop policy if exists application_events_insert_own on public.application_events;
create policy application_events_insert_own
  on public.application_events for insert
  to authenticated
  with check (
    exists (
      select 1 from public.application_cases c
      where c.id = case_id and c.student_id = auth.uid()
    )
  );

alter table public.application_tasks enable row level security;
drop policy if exists application_tasks_select_own on public.application_tasks;
create policy application_tasks_select_own
  on public.application_tasks for select
  to authenticated
  using (
    exists (
      select 1 from public.application_cases c
      where c.id = case_id
        and (c.student_id = auth.uid() or public.has_student_access(c.student_id))
    )
  );
drop policy if exists application_tasks_insert_own on public.application_tasks;
create policy application_tasks_insert_own
  on public.application_tasks for insert
  to authenticated
  with check (
    exists (
      select 1 from public.application_cases c
      where c.id = case_id and c.student_id = auth.uid()
    )
  );
drop policy if exists application_tasks_update_own on public.application_tasks;
create policy application_tasks_update_own
  on public.application_tasks for update
  to authenticated
  using (
    exists (
      select 1 from public.application_cases c
      where c.id = case_id
        and (c.student_id = auth.uid() or public.has_student_access(c.student_id))
    )
  );

alter table public.application_case_documents enable row level security;
drop policy if exists application_case_documents_select_own on public.application_case_documents;
create policy application_case_documents_select_own
  on public.application_case_documents for select
  to authenticated
  using (
    exists (
      select 1 from public.application_cases c
      where c.id = case_id
        and (c.student_id = auth.uid() or public.has_student_access(c.student_id))
    )
  );

-- ── Artifacts ──────────────────────────────────────────────────────────────
alter table public.artifacts enable row level security;
drop policy if exists artifacts_select_own on public.artifacts;
create policy artifacts_select_own
  on public.artifacts for select
  to authenticated
  using (student_id = auth.uid() or public.has_student_access(student_id));
drop policy if exists artifacts_insert_own on public.artifacts;
create policy artifacts_insert_own
  on public.artifacts for insert
  to authenticated
  with check (student_id = auth.uid());

alter table public.artifact_versions enable row level security;
drop policy if exists artifact_versions_select_own on public.artifact_versions;
create policy artifact_versions_select_own
  on public.artifact_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.artifacts a
      where a.id = artifact_id
        and (a.student_id = auth.uid() or public.has_student_access(a.student_id))
    )
  );
drop policy if exists artifact_versions_insert_own on public.artifact_versions;
create policy artifact_versions_insert_own
  on public.artifact_versions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.artifacts a
      where a.id = artifact_id and a.student_id = auth.uid()
    )
  );

-- ── Access grants & consents ───────────────────────────────────────────────
alter table public.access_grants enable row level security;
drop policy if exists access_grants_select_participant on public.access_grants;
create policy access_grants_select_participant
  on public.access_grants for select
  to authenticated
  using (student_id = auth.uid() or grantee_user_id = auth.uid());
drop policy if exists access_grants_insert_student on public.access_grants;
create policy access_grants_insert_student
  on public.access_grants for insert
  to authenticated
  with check (student_id = auth.uid() and granted_by_user_id = auth.uid());

alter table public.consents enable row level security;
drop policy if exists consents_select_own on public.consents;
create policy consents_select_own
  on public.consents for select
  to authenticated
  using (user_id = auth.uid());
drop policy if exists consents_insert_own on public.consents;
create policy consents_insert_own
  on public.consents for insert
  to authenticated
  with check (user_id = auth.uid());

-- ── Internal tables: enabled with NO policies → service role only ──────────
alter table public.audit_logs enable row level security;
alter table public.ai_runs enable row level security;
alter table public.background_jobs enable row level security;

-- ── Private storage bucket foundation ──────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-documents',
  'student-documents',
  false,
  20971520,
  array['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

-- Object owner (uploading student) can read/write their own objects.
drop policy if exists student_documents_read_own on storage.objects;
create policy student_documents_read_own
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'student-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists student_documents_insert_own on storage.objects;
create policy student_documents_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'student-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- The documents table (metadata) is protected by its own RLS; objects are
-- only accessible via the authenticated owner path above. Signed expiring
-- URLs are generated server-side (never permanent public URLs).
