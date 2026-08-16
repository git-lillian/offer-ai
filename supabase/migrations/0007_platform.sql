-- 0007_platform.sql
-- Access grants, consents, audit logs, AI run ledger, background jobs.

-- Access grants: explicit, scoped, expiring, revocable.
create table if not exists public.access_grants (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (user_id) on delete cascade,
  grantee_user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null check (scope in ('profile', 'case', 'document', 'service')),
  scope_id uuid,
  granted_by_user_id uuid not null references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  revoked_by_user_id uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);

create index if not exists access_grants_student_idx
  on public.access_grants (student_id, status);
create index if not exists access_grants_grantee_idx
  on public.access_grants (grantee_user_id, status);

-- Consent: a domain concept, not merely a checkbox.
create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_type text not null check (consent_type in (
    'adviser_access', 'guardian_access', 'marketplace_data_sharing',
    'communication_preferences', 'marketing_optional', 'research_analytics'
  )),
  policy_version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  source text not null default 'web'
);

create index if not exists consents_user_idx
  on public.consents (user_id);

-- Append-only audit log. Internal table: no client policies.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null check (action in (
    'adviser_access_granted', 'adviser_access_revoked',
    'application_status_changed', 'adviser_assigned',
    'recommendation_overridden', 'application_submitted_externally',
    'payment_status_changed', 'administrator_action', 'document_viewed'
  )),
  resource_type text not null,
  resource_id text not null,
  correlation_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_resource_idx
  on public.audit_logs (resource_type, resource_id);
create index if not exists audit_logs_created_idx
  on public.audit_logs (created_at desc);

-- AI run ledger: every execution recorded for auditability and cost.
-- Internal table: no client policies.
create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  input_hash text,
  student_id uuid references public.student_profiles (user_id) on delete set null,
  application_case_id uuid references public.application_cases (id) on delete set null,
  artifact_id uuid references public.artifacts (id) on delete set null,
  latency_ms integer,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(12,6),
  status text not null check (status in ('succeeded', 'failed')),
  error_class text,
  correlation_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists ai_runs_student_idx
  on public.ai_runs (student_id, created_at desc);
create index if not exists ai_runs_correlation_idx
  on public.ai_runs (correlation_id);

-- Durable background job queue. Internal table: no client policies.
create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in (
    'queued', 'running', 'completed', 'failed', 'cancelled'
  )),
  idempotency_key text unique,
  correlation_id uuid,
  attempts integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts between 1 and 20),
  last_error text,
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists background_jobs_poll_idx
  on public.background_jobs (status, available_at);
