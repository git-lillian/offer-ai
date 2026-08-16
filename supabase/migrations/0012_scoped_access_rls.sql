-- 0012_scoped_access_rls.sql
-- Fix access-grant/RLS semantics.
--
-- Before: any active grant (any scope) gave the grantee full read access to
--         every student table (profile, cases, documents, artifacts...).
--         A document grant exposed the whole Student 360; a case grant
--         exposed every application.
-- After:  each resource table checks the specific scope it belongs to:
--         profile  -> Student 360 profile data + cases (account management)
--         case     -> exactly the granted application case
--         document -> exactly the granted document
--         artifact -> exactly the granted artifact
--         service  -> marketplace service container (grants materialised as
--                     concrete profile/case/document/artifact grants)

-- ── 1) Access scope lookup: add `artifact` ──────────────────────────────────
alter table public.access_grants
  drop constraint access_grants_scope_check;
alter table public.access_grants
  add constraint access_grants_scope_check
    check (scope in ('profile', 'case', 'document', 'artifact', 'service'));

-- ── 2) Helper functions ─────────────────────────────────────────────────────

-- Is the current user the linked owner of this student profile?
create or replace function public.is_student_owner(p_student_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.student_profiles sp
    where sp.id = p_student_id
      and sp.user_id = auth.uid()
  );
$$;

-- Does the current user hold an active grant of `p_scope` for this student,
-- scoped to a specific resource id when one is provided? When p_scope_id is
-- null (profile scope) any matching grant applies.
create or replace function public.has_scoped_grant(
  p_student_id uuid,
  p_scope text,
  p_scope_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.access_grants g
    where g.student_id = p_student_id
      and g.grantee_user_id = auth.uid()
      and g.status = 'active'
      and (g.expires_at is null or g.expires_at > now())
      and g.scope = p_scope
      and (p_scope_id is null or g.scope_id = p_scope_id)
  );
$$;

-- Profile-level access: an active profile-scope grant.
drop function if exists public.has_student_access(uuid);
create or replace function public.has_student_access(p_student_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.has_scoped_grant(p_student_id, 'profile', null);
$$;

-- Does the current user hold a role? Used inside policies for controlled
-- client operations (prospect creation by advisers/guardians).
create or replace function public.has_role(p_role text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.identity_user_roles r
    where r.user_id = auth.uid()
      and r.role_code = p_role
  );
$$;

-- ── 3) Identity & organisations ─────────────────────────────────────────────
drop policy if exists identity_roles_read on public.identity_roles;
create policy identity_roles_read
  on public.identity_roles for select
  to anon, authenticated
  using (true);

drop policy if exists identity_user_roles_select_own on public.identity_user_roles;
create policy identity_user_roles_select_own
  on public.identity_user_roles for select
  to authenticated
  using (user_id = auth.uid());

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

drop policy if exists organisations_read on public.organisations;
create policy organisations_read
  on public.organisations for select
  to anon, authenticated
  using (true);

drop policy if exists organisation_memberships_select_own on public.organisation_memberships;
create policy organisation_memberships_select_own
  on public.organisation_memberships for select
  to authenticated
  using (user_id = auth.uid());

-- ── 4) Student 360 ──────────────────────────────────────────────────────────
-- Student profiles: owner, or explicit profile-scope grantee. Insert covers
-- self-creation and role-based prospect/guardian creation. Updates require
-- owner / profile grant / creator-of-unclaimed-prospect; claiming is handled
-- by the dedicated RPC so a creator can never silently become the owner.
alter table public.student_profiles enable row level security;
drop policy if exists student_profiles_select_own on public.student_profiles;
create policy student_profiles_select_own
  on public.student_profiles for select
  to authenticated
  using (user_id = auth.uid() or public.has_student_access(id));
drop policy if exists student_profiles_insert_own on public.student_profiles;
create policy student_profiles_insert_own
  on public.student_profiles for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or (
      user_id is null
      and created_by_user_id = auth.uid()
      and (public.has_role('guardian') or public.has_role('adviser'))
    )
  );
drop policy if exists student_profiles_update_own on public.student_profiles;
create policy student_profiles_update_own
  on public.student_profiles for update
  to authenticated
  using (
    user_id = auth.uid()
    or public.has_student_access(id)
    or (created_by_user_id = auth.uid() and user_id is null)
  )
  with check (
    user_id = auth.uid()
    or public.has_student_access(id)
    or (created_by_user_id = auth.uid() and user_id is null)
  );

-- Education / qualifications / experiences / goals: owner or profile grantee.
-- Only the owner may write.
alter table public.student_education enable row level security;
drop policy if exists student_education_select_own on public.student_education;
create policy student_education_select_own
  on public.student_education for select
  to authenticated
  using (public.is_student_owner(student_id) or public.has_student_access(student_id));
drop policy if exists student_education_insert_own on public.student_education;
create policy student_education_insert_own
  on public.student_education for insert
  to authenticated
  with check (public.is_student_owner(student_id));
drop policy if exists student_education_update_own on public.student_education;
create policy student_education_update_own
  on public.student_education for update
  to authenticated
  using (public.is_student_owner(student_id))
  with check (public.is_student_owner(student_id));

alter table public.student_qualifications enable row level security;
drop policy if exists student_qualifications_select_own on public.student_qualifications;
create policy student_qualifications_select_own
  on public.student_qualifications for select
  to authenticated
  using (public.is_student_owner(student_id) or public.has_student_access(student_id));
drop policy if exists student_qualifications_insert_own on public.student_qualifications;
create policy student_qualifications_insert_own
  on public.student_qualifications for insert
  to authenticated
  with check (public.is_student_owner(student_id));
drop policy if exists student_qualifications_update_own on public.student_qualifications;
create policy student_qualifications_update_own
  on public.student_qualifications for update
  to authenticated
  using (public.is_student_owner(student_id))
  with check (public.is_student_owner(student_id));

alter table public.student_experiences enable row level security;
drop policy if exists student_experiences_select_own on public.student_experiences;
create policy student_experiences_select_own
  on public.student_experiences for select
  to authenticated
  using (public.is_student_owner(student_id) or public.has_student_access(student_id));
drop policy if exists student_experiences_insert_own on public.student_experiences;
create policy student_experiences_insert_own
  on public.student_experiences for insert
  to authenticated
  with check (public.is_student_owner(student_id));
drop policy if exists student_experiences_update_own on public.student_experiences;
create policy student_experiences_update_own
  on public.student_experiences for update
  to authenticated
  using (public.is_student_owner(student_id))
  with check (public.is_student_owner(student_id));

alter table public.student_goals enable row level security;
drop policy if exists student_goals_select_own on public.student_goals;
create policy student_goals_select_own
  on public.student_goals for select
  to authenticated
  using (public.is_student_owner(student_id) or public.has_student_access(student_id));
drop policy if exists student_goals_insert_own on public.student_goals;
create policy student_goals_insert_own
  on public.student_goals for insert
  to authenticated
  with check (public.is_student_owner(student_id));
drop policy if exists student_goals_update_own on public.student_goals;
create policy student_goals_update_own
  on public.student_goals for update
  to authenticated
  using (public.is_student_owner(student_id))
  with check (public.is_student_owner(student_id));

-- ── 5) Evidence & documents ─────────────────────────────────────────────────
alter table public.evidence_items enable row level security;
drop policy if exists evidence_items_select_own on public.evidence_items;
create policy evidence_items_select_own
  on public.evidence_items for select
  to authenticated
  using (public.is_student_owner(student_id) or public.has_student_access(student_id));
drop policy if exists evidence_items_insert_own on public.evidence_items;
create policy evidence_items_insert_own
  on public.evidence_items for insert
  to authenticated
  with check (public.is_student_owner(student_id));
drop policy if exists evidence_items_update_own on public.evidence_items;
create policy evidence_items_update_own
  on public.evidence_items for update
  to authenticated
  using (public.is_student_owner(student_id))
  with check (public.is_student_owner(student_id));

-- Documents are protected by the owner path; a document-scope grant exposes
-- exactly that document — never the rest of the Student 360.
alter table public.documents enable row level security;
drop policy if exists documents_select_own on public.documents;
create policy documents_select_own
  on public.documents for select
  to authenticated
  using (
    public.is_student_owner(student_id)
    or public.has_scoped_grant(student_id, 'document', id)
  );
drop policy if exists documents_insert_own on public.documents;
create policy documents_insert_own
  on public.documents for insert
  to authenticated
  with check (
    public.is_student_owner(student_id)
    and owner_user_id = auth.uid()
  );
drop policy if exists documents_update_own on public.documents;
create policy documents_update_own
  on public.documents for update
  to authenticated
  using (public.is_student_owner(student_id))
  with check (public.is_student_owner(student_id));

-- ── 6) Catalogue (public read; writes are service-role only) ────────────────
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

-- ── 7) Admissions ───────────────────────────────────────────────────────────
-- Cases are created and transitioned through atomic RPCs, so the client has
-- no direct insert/update policies here. Reads: owner, profile grantee, or a
-- case-scope grantee of THIS case.
alter table public.application_cases enable row level security;
drop policy if exists application_cases_select_own on public.application_cases;
create policy application_cases_select_own
  on public.application_cases for select
  to authenticated
  using (
    public.is_student_owner(student_id)
    or public.has_student_access(student_id)
    or public.has_scoped_grant(student_id, 'case', id)
  );

-- Events: read through the case; append-only via controlled RPCs.
alter table public.application_events enable row level security;
drop policy if exists application_events_select_own on public.application_events;
create policy application_events_select_own
  on public.application_events for select
  to authenticated
  using (
    exists (
      select 1 from public.application_cases c
      where c.id = case_id
        and (
          public.is_student_owner(c.student_id)
          or public.has_student_access(c.student_id)
          or public.has_scoped_grant(c.student_id, 'case', c.id)
        )
    )
  );

-- Tasks: readable through the case; owner may manage.
alter table public.application_tasks enable row level security;
drop policy if exists application_tasks_select_own on public.application_tasks;
create policy application_tasks_select_own
  on public.application_tasks for select
  to authenticated
  using (
    exists (
      select 1 from public.application_cases c
      where c.id = case_id
        and (
          public.is_student_owner(c.student_id)
          or public.has_student_access(c.student_id)
          or public.has_scoped_grant(c.student_id, 'case', c.id)
        )
    )
  );
drop policy if exists application_tasks_insert_own on public.application_tasks;
create policy application_tasks_insert_own
  on public.application_tasks for insert
  to authenticated
  with check (
    exists (
      select 1 from public.application_cases c
      where c.id = case_id and public.is_student_owner(c.student_id)
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
        and (
          public.is_student_owner(c.student_id)
          or public.has_student_access(c.student_id)
          or public.has_scoped_grant(c.student_id, 'case', c.id)
        )
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
        and (
          public.is_student_owner(c.student_id)
          or public.has_student_access(c.student_id)
          or public.has_scoped_grant(c.student_id, 'case', c.id)
        )
    )
  );

-- ── 8) Artifacts ────────────────────────────────────────────────────────────
-- An artifact-scope grant exposes exactly that artifact (and its versions).
alter table public.artifacts enable row level security;
drop policy if exists artifacts_select_own on public.artifacts;
create policy artifacts_select_own
  on public.artifacts for select
  to authenticated
  using (
    public.is_student_owner(student_id)
    or public.has_scoped_grant(student_id, 'artifact', id)
  );
drop policy if exists artifacts_insert_own on public.artifacts;
create policy artifacts_insert_own
  on public.artifacts for insert
  to authenticated
  with check (public.is_student_owner(student_id));
drop policy if exists artifacts_update_own on public.artifacts;
create policy artifacts_update_own
  on public.artifacts for update
  to authenticated
  using (public.is_student_owner(student_id))
  with check (public.is_student_owner(student_id));

alter table public.artifact_versions enable row level security;
drop policy if exists artifact_versions_select_own on public.artifact_versions;
create policy artifact_versions_select_own
  on public.artifact_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.artifacts a
      where a.id = artifact_id
        and (
          public.is_student_owner(a.student_id)
          or public.has_scoped_grant(a.student_id, 'artifact', a.id)
        )
    )
  );
drop policy if exists artifact_versions_insert_own on public.artifact_versions;
create policy artifact_versions_insert_own
  on public.artifact_versions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.artifacts a
      where a.id = artifact_id and public.is_student_owner(a.student_id)
    )
  );

-- ── 9) Access grants & consents ─────────────────────────────────────────────
-- Grants: the student owner, or the creator of an unclaimed prospect, can
-- grant access. The grantee and the student can view grants; revocation is
-- open to owner and grantee.
alter table public.access_grants enable row level security;
drop policy if exists access_grants_select_participant on public.access_grants;
create policy access_grants_select_participant
  on public.access_grants for select
  to authenticated
  using (
    public.is_student_owner(student_id)
    or grantee_user_id = auth.uid()
  );
drop policy if exists access_grants_insert_student on public.access_grants;
create policy access_grants_insert_student
  on public.access_grants for insert
  to authenticated
  with check (
    (public.is_student_owner(student_id) and granted_by_user_id = auth.uid())
    or exists (
      select 1 from public.student_profiles sp
      where sp.id = student_id and sp.created_by_user_id = auth.uid()
    )
  );
drop policy if exists access_grants_update_participant on public.access_grants;
create policy access_grants_update_participant
  on public.access_grants for update
  to authenticated
  using (public.is_student_owner(student_id) or grantee_user_id = auth.uid())
  with check (public.is_student_owner(student_id) or grantee_user_id = auth.uid());

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

-- ── 10) Internal tables: enabled with NO policies → service role only ───────
alter table public.audit_logs enable row level security;
alter table public.ai_runs enable row level security;
alter table public.background_jobs enable row level security;

-- ── 11) Private storage bucket policies (unchanged semantics) ───────────────
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