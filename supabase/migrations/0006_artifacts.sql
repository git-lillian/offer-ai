-- 0006_artifacts.sql
-- Generic versioned application artifacts (CV, personal statement, SOP,
-- supplementary answers, reference drafts...).

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (user_id) on delete cascade,
  case_id uuid references public.application_cases (id) on delete set null,
  artifact_type text not null check (artifact_type in (
    'cv', 'personal_statement', 'statement_of_purpose', 'supplementary_answer',
    'reference_draft', 'portfolio_text', 'application_note'
  )),
  title text not null,
  latest_version_id uuid,
  approval_state text not null default 'draft' check (approval_state in (
    'draft', 'in_review', 'approved', 'submitted'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artifacts_student_idx
  on public.artifacts (student_id);

-- Versions are immutable: never overwrite a previous submitted/reviewed
-- version.
create table if not exists public.artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts (id) on delete cascade,
  version_number integer not null,
  content text not null,
  creator_user_id uuid not null references auth.users (id) on delete cascade,
  origin text not null check (origin in ('human', 'ai', 'hybrid')),
  prompt_version text,
  model_run_id uuid,
  evidence_used text[] not null default '{}',
  approval_state text not null default 'draft' check (approval_state in (
    'draft', 'in_review', 'approved', 'submitted'
  )),
  created_at timestamptz not null default now(),
  unique (artifact_id, version_number)
);

create index if not exists artifact_versions_artifact_idx
  on public.artifact_versions (artifact_id, version_number desc);

-- Set latest_version_id when a new version is created.
create or replace function public.touch_artifact_latest_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.artifacts
     set latest_version_id = new.id,
         updated_at = now()
   where id = new.artifact_id;
  return new;
end;
$$;

create trigger artifact_versions_after_insert
  after insert on public.artifact_versions
  for each row execute function public.touch_artifact_latest_version();
