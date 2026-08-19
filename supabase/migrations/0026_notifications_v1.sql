-- 0026_notifications_v1.sql
-- Notifications & deadline engine v1: delivery abstraction for deadline monitoring,
-- course updates, marketplace messages, billing events and system alerts.
--
-- Three tables:
--   notifications              — per-user inbox (delivery jobs write via service_role,
--                              browser reads own)
--   notification_preferences   — per-user opt-in + deadline reminder offsets
--   deadline_watches           — student watches on a course intake's deadline / availability
--
-- Channel/type/status are text + CHECK (not Postgres enums) per project convention.
-- RLS: notifications readable only by owner (user_id = auth.uid()),
--      notification_preferences owner only,
--      deadline_watches student owner via is_student_owner.
-- Service_role bypasses RLS and has full access (no client inserts for notifications).

-- ── 1) Notifications ─────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('email', 'push', 'in_app')),
  notification_type text not null check (notification_type in ('deadline', 'application', 'marketplace', 'billing', 'system')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  body text not null check (char_length(body) between 1 and 5000),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_sent_at_check check (
    (status = 'sent' and sent_at is not null)
    or (status != 'sent' and sent_at is null)
  )
);

create index if not exists notifications_user_idx
  on public.notifications (user_id);
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_status_idx
  on public.notifications (user_id, status);
create index if not exists notifications_status_idx
  on public.notifications (status);
create index if not exists notifications_channel_idx
  on public.notifications (channel);
create index if not exists notifications_type_idx
  on public.notifications (notification_type);
create index if not exists notifications_scheduled_idx
  on public.notifications (scheduled_at)
  where status = 'pending';
create index if not exists notifications_created_idx
  on public.notifications (created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

-- No insert/update/delete policies for authenticated — service_role only.
-- Notifications are created by the server/worker (provider abstraction) and
-- the browser never writes them directly.

-- ── 2) Notification preferences ──────────────────────────────────────────────
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  deadline_reminder_days integer[] not null default '{7,3,1}',
  created_at timestamptz not null default now()
);

create index if not exists notification_preferences_created_idx
  on public.notification_preferences (created_at desc);

alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own
  on public.notification_preferences for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own
  on public.notification_preferences for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own
  on public.notification_preferences for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notification_preferences_delete_own on public.notification_preferences;
create policy notification_preferences_delete_own
  on public.notification_preferences for delete
  to authenticated
  using (user_id = auth.uid());

-- ── 3) Deadline watches ──────────────────────────────────────────────────────
create table if not exists public.deadline_watches (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  course_intake_id uuid not null references public.catalog_course_intakes (id) on delete cascade,
  watch_type text not null check (watch_type in ('deadline', 'availability')),
  next_reminder_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, course_intake_id, watch_type)
);

create index if not exists deadline_watches_student_idx
  on public.deadline_watches (student_id);
create index if not exists deadline_watches_course_intake_idx
  on public.deadline_watches (course_intake_id);
create index if not exists deadline_watches_student_created_idx
  on public.deadline_watches (student_id, created_at desc);
create index if not exists deadline_watches_next_reminder_idx
  on public.deadline_watches (next_reminder_at)
  where next_reminder_at is not null;
create index if not exists deadline_watches_type_idx
  on public.deadline_watches (watch_type);
create index if not exists deadline_watches_student_type_idx
  on public.deadline_watches (student_id, watch_type);

alter table public.deadline_watches enable row level security;

drop policy if exists deadline_watches_select_own on public.deadline_watches;
create policy deadline_watches_select_own
  on public.deadline_watches for select
  to authenticated
  using (public.is_student_owner(student_id));

drop policy if exists deadline_watches_insert_own on public.deadline_watches;
create policy deadline_watches_insert_own
  on public.deadline_watches for insert
  to authenticated
  with check (public.is_student_owner(student_id));

drop policy if exists deadline_watches_update_own on public.deadline_watches;
create policy deadline_watches_update_own
  on public.deadline_watches for update
  to authenticated
  using (public.is_student_owner(student_id))
  with check (public.is_student_owner(student_id));

drop policy if exists deadline_watches_delete_own on public.deadline_watches;
create policy deadline_watches_delete_own
  on public.deadline_watches for delete
  to authenticated
  using (public.is_student_owner(student_id));

-- ── 4) Grants (self-healing for restored DBs) ───────────────────────────────
grant usage on schema public to authenticated, service_role;

grant select on public.notifications to authenticated, service_role;
grant all on public.notifications to service_role;

grant select, insert, update, delete on public.notification_preferences to authenticated, service_role;
grant all on public.notification_preferences to service_role;

grant select, insert, update, delete on public.deadline_watches to authenticated, service_role;
grant all on public.deadline_watches to service_role;
