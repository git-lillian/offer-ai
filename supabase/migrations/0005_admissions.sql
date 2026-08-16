-- 0005_admissions.sql
-- Application cases, append-only events, tasks, case-document links.

create table if not exists public.application_cases (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (user_id) on delete cascade,
  institution_id uuid not null references public.catalog_institutions (id) on delete cascade,
  course_id uuid not null references public.catalog_courses (id) on delete cascade,
  course_intake_id uuid not null references public.catalog_course_intakes (id) on delete cascade,
  application_cycle_id uuid not null references public.catalog_application_cycles (id) on delete cascade,
  application_route text not null default 'institution_direct' check (application_route in (
    'ucs', 'institution_direct', 'agent_portal', 'other'
  )),
  current_status text not null default 'draft' check (current_status in (
    'draft', 'in_progress', 'submitted', 'under_review', 'offer_received',
    'rejected', 'accepted', 'enrolled', 'withdrawn', 'declined_offer'
  )),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists application_cases_student_idx
  on public.application_cases (student_id, created_at desc);

-- Append-only event/status history. Never mutated; current status is
-- stored on the case for efficient querying.
create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.application_cases (id) on delete cascade,
  event_type text not null check (event_type in (
    'created', 'status_changed', 'submitted', 'document_added',
    'note_added', 'decision', 'offer_condition_set', 'other'
  )),
  status text not null,
  actor_user_id uuid references auth.users (id) on delete set null,
  message text not null default '',
  metadata jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists application_events_case_idx
  on public.application_events (case_id, occurred_at asc);

-- First-class tasks powering the journey dashboard.
create table if not exists public.application_tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.application_cases (id) on delete cascade,
  title text not null,
  description text not null default '',
  source text not null check (source in (
    'system_rule', 'ai_recommendation', 'adviser', 'student', 'application_workflow'
  )),
  assignee_user_id uuid references auth.users (id) on delete set null,
  due_at timestamptz,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  completion_evidence text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists application_tasks_case_idx
  on public.application_tasks (case_id, status);

create table if not exists public.application_case_documents (
  case_id uuid not null references public.application_cases (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  purpose text not null default 'supporting',
  added_at timestamptz not null default now(),
  primary key (case_id, document_id)
);
