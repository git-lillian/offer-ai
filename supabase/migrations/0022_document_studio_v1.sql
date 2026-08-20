-- 0022_document_studio_v1.sql
-- Document studio v1: artifact-based CV / personal statement / SOP studio.
--
-- Foundation already has tables artifacts, artifact_versions with latest_version_id
-- and approval_state (draft → in_review → approved → submitted). This migration
-- hardens the artifact aggregates for studio use and adds artifact feedback
-- (artifact_comments) so advisers and students can collaborate on drafts.
--
-- See docs/product/domain-map.md:19 and packages/domain/src/artifact.ts.

-- ── 1) Harden artifacts (idempotent) ─────────────────────────────────────
alter table public.artifacts enable row level security;
alter table public.artifact_versions enable row level security;

-- Core lookup indexes for the studio listing: filter by student, by case,
-- and by approval state. The foundation already created artifacts_student_idx
-- and artifact_versions_artifact_idx; create the missing ones idempotently.
create index if not exists artifacts_student_idx
  on public.artifacts (student_id);

create index if not exists artifacts_case_idx
  on public.artifacts (case_id);

create index if not exists artifacts_approval_state_idx
  on public.artifacts (approval_state);

create index if not exists artifacts_student_created_idx
  on public.artifacts (student_id, created_at desc);

create index if not exists artifacts_student_type_idx
  on public.artifacts (student_id, artifact_type);

create index if not exists artifact_versions_artifact_idx
  on public.artifact_versions (artifact_id, version_number desc);

create index if not exists artifact_versions_creator_idx
  on public.artifact_versions (creator_user_id);

create index if not exists artifact_versions_approval_state_idx
  on public.artifact_versions (approval_state);

-- Named CHECK constraints for clarity (idempotent). Foundation already has
-- inline CHECKs; these named constraints make error messages greppable and
-- mirror the hardening style of 0021_application_os_v1.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'artifacts_artifact_type_check_named') then
    alter table public.artifacts
      add constraint artifacts_artifact_type_check_named
        check (artifact_type in (
          'cv', 'personal_statement', 'statement_of_purpose', 'supplementary_answer',
          'reference_draft', 'portfolio_text', 'application_note'
        ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'artifacts_approval_state_check_named') then
    alter table public.artifacts
      add constraint artifacts_approval_state_check_named
        check (approval_state in ('draft', 'in_review', 'approved', 'submitted'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'artifact_versions_origin_check_named') then
    alter table public.artifact_versions
      add constraint artifact_versions_origin_check_named
        check (origin in ('human', 'ai', 'hybrid'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'artifact_versions_approval_state_check_named') then
    alter table public.artifact_versions
      add constraint artifact_versions_approval_state_check_named
        check (approval_state in ('draft', 'in_review', 'approved', 'submitted'));
  end if;
end $$;

-- ── 2) Artifact comments — per-version feedback thread ───────────────────
-- Minimal but plausible: one row per feedback comment, anchored to an artifact
-- and a version_number. Version numbers are immutable; comments are append-only
-- (no update policy for anon/authenticated beyond author delete).
create table if not exists public.artifact_comments (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts (id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  author_user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists artifact_comments_artifact_idx
  on public.artifact_comments (artifact_id, version_number);

create index if not exists artifact_comments_artifact_created_idx
  on public.artifact_comments (artifact_id, created_at desc);

create index if not exists artifact_comments_author_idx
  on public.artifact_comments (author_user_id);

alter table public.artifact_comments enable row level security;

-- Select: owner of the parent artifact or a holder of an artifact-scope grant
-- for that artifact (mirrors artifacts_select_own / artifact_versions_select_own).
drop policy if exists artifact_comments_select_own on public.artifact_comments;
create policy artifact_comments_select_own
  on public.artifact_comments for select
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

-- Insert: only the student owner may leave feedback in v1 (keeps the policy
-- surface small); the author must be the current user.
drop policy if exists artifact_comments_insert_own on public.artifact_comments;
create policy artifact_comments_insert_own
  on public.artifact_comments for insert
  to authenticated
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from public.artifacts a
      where a.id = artifact_id
        and public.is_student_owner(a.student_id)
    )
  );

-- Delete: author may remove their own comment, or the student owner may
-- moderate. No update policy — comments are immutable; edit = delete + insert.
drop policy if exists artifact_comments_delete_own on public.artifact_comments;
create policy artifact_comments_delete_own
  on public.artifact_comments for delete
  to authenticated
  using (
    author_user_id = auth.uid()
    or exists (
      select 1 from public.artifacts a
      where a.id = artifact_id
        and public.is_student_owner(a.student_id)
    )
  );

-- ── 3) Grants (self-healing for restored DBs) ────────────────────────────
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on public.artifacts to authenticated, service_role;
grant all on public.artifacts to service_role;
grant select, insert, delete on public.artifact_versions to authenticated, service_role;
grant all on public.artifact_versions to service_role;

grant select, insert, delete on public.artifact_comments to authenticated, service_role;
grant all on public.artifact_comments to service_role;
