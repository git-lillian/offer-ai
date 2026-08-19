-- 0021_application_os_v1.sql
-- Application OS v1: harden task management and introduce milestones.
--
-- application_tasks already exists (0005) with due_at, priority, status CHECK,
-- assignee and RLS via 0012. This migration ensures those guarantees are
-- idempotently hardened and adds the OS milestone aggregate.

-- ── 1) Harden application_tasks (idempotent) ───────────────────────────────
alter table public.application_tasks enable row level security;

create index if not exists application_tasks_case_due_idx
  on public.application_tasks (case_id, due_at);
create index if not exists application_tasks_assignee_idx
  on public.application_tasks (assignee_user_id);
create index if not exists application_tasks_priority_status_idx
  on public.application_tasks (priority, status);
create index if not exists application_tasks_status_idx
  on public.application_tasks (status);

-- Named CHECK constraints for clarity; created idempotently (pg_constraint).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'application_tasks_priority_check_named') then
    alter table public.application_tasks
      add constraint application_tasks_priority_check_named
        check (priority in ('low', 'medium', 'high', 'urgent'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'application_tasks_status_check_named') then
    alter table public.application_tasks
      add constraint application_tasks_status_check_named
        check (status in ('pending', 'in_progress', 'completed', 'cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'application_tasks_source_check_named') then
    alter table public.application_tasks
      add constraint application_tasks_source_check_named
        check (source in ('system_rule', 'ai_recommendation', 'adviser', 'student', 'application_workflow'));
  end if;
end $$;

-- application_case_documents is already RLS-hardened (0012); ensure policy exists.
alter table public.application_case_documents enable row level security;

-- ── 2) Milestones — first-class OS timeline checkpoints ─────────────────────
-- Tasks are the checklist (already first-class); milestones are the
-- higher-level OS stages that group progress (e.g. "Ready to submit").
create table if not exists public.application_milestones (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.application_cases (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  due_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists application_milestones_case_idx
  on public.application_milestones (case_id, sort_order);
create index if not exists application_milestones_case_due_idx
  on public.application_milestones (case_id, due_at);
create index if not exists application_milestones_status_idx
  on public.application_milestones (status);

alter table public.application_milestones enable row level security;

-- Select: owner, profile grant, or scoped case grant of the parent case.
drop policy if exists application_milestones_select_own on public.application_milestones;
create policy application_milestones_select_own
  on public.application_milestones for select
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

drop policy if exists application_milestones_insert_own on public.application_milestones;
create policy application_milestones_insert_own
  on public.application_milestones for insert
  to authenticated
  with check (
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

drop policy if exists application_milestones_update_own on public.application_milestones;
create policy application_milestones_update_own
  on public.application_milestones for update
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
  )
  with check (
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

drop policy if exists application_milestones_delete_own on public.application_milestones;
create policy application_milestones_delete_own
  on public.application_milestones for delete
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

-- ── 3) Grants (self-healing for restored DBs) ─────────────────────────────
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on public.application_milestones to authenticated, service_role;
grant all on public.application_milestones to service_role;

-- Re-grant tasks/documents for idempotency.
grant select, insert, update, delete on public.application_tasks to authenticated, service_role;
grant all on public.application_tasks to service_role;
grant select, insert, delete on public.application_case_documents to authenticated, service_role;
grant all on public.application_case_documents to service_role;
