-- 0025_billing_v1.sql
-- Billing v1: platform subscriptions vs marketplace transactions (separate concepts).
-- Platform subscriptions are SaaS billing (premium Offer.ai features) and remain
-- independent from marketplace service-order payments and commissions.
-- Never merged into a single `payments` boolean — see docs/architecture/marketplace.md.
--
-- This migration adds billing domain tables, indexes, RLS and self-healing grants.
-- Stripe integration comes after domain is stable; model names and API keys never
-- appear in application code (packages/billing is Stripe-agnostic, Stripe IDs stored
-- as opaque text).
--
-- Tables:
--   billing_customers        — one per auth user, maps to Stripe customer
--   billing_subscriptions    — platform subscription per customer
--   billing_entitlements     — feature grants derived from subscriptions or admin grants
--   billing_invoices         — invoice ledger per customer
--   billing_webhook_events   — idempotency ledger for Stripe webhooks
--
-- RLS: billing tables readable only by owner (authenticated + user_id match)
--      and service_role (bypass). No anon policies. Service_role has full access.
-- Indexes: FK, stripe ids, status, feature, processed, created_at.

-- ── 1) Billing customers ───────────────────────────────────────────────────────
create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  unique (user_id),
  constraint billing_customers_stripe_customer_id_len check (
    stripe_customer_id is null or char_length(btrim(stripe_customer_id)) between 1 and 120
  )
);

create index if not exists billing_customers_user_idx
  on public.billing_customers (user_id);
create index if not exists billing_customers_stripe_customer_id_idx
  on public.billing_customers (stripe_customer_id)
  where stripe_customer_id is not null;
create index if not exists billing_customers_created_idx
  on public.billing_customers (created_at desc);

alter table public.billing_customers enable row level security;

drop policy if exists billing_customers_select_own on public.billing_customers;
create policy billing_customers_select_own
  on public.billing_customers for select
  to authenticated
  using (user_id = auth.uid());

-- No insert/update/delete policies for authenticated — service_role only.
-- Stripe customer creation is server-side; browser never writes directly.

-- ── Helper: is the caller the owner of this billing customer? (after table exists)
create or replace function public.is_billing_owner(p_customer_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.billing_customers bc
    where bc.id = p_customer_id
      and bc.user_id = auth.uid()
  );
$$;

-- ── 2) Billing subscriptions ─────────────────────────────────────────────────
create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.billing_customers (id) on delete cascade,
  stripe_subscription_id text unique,
  plan_code text not null check (plan_code in ('free', 'premium', 'pro')),
  status text not null check (status in ('active', 'past_due', 'cancelled', 'incomplete')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  constraint billing_subscriptions_stripe_subscription_id_len check (
    stripe_subscription_id is null or char_length(btrim(stripe_subscription_id)) between 1 and 120
  )
);

create index if not exists billing_subscriptions_customer_idx
  on public.billing_subscriptions (customer_id);
create index if not exists billing_subscriptions_stripe_subscription_id_idx
  on public.billing_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;
create index if not exists billing_subscriptions_status_idx
  on public.billing_subscriptions (status);
create index if not exists billing_subscriptions_plan_code_idx
  on public.billing_subscriptions (plan_code);
create index if not exists billing_subscriptions_customer_status_idx
  on public.billing_subscriptions (customer_id, status);
create index if not exists billing_subscriptions_period_end_idx
  on public.billing_subscriptions (current_period_end)
  where current_period_end is not null;
create index if not exists billing_subscriptions_created_idx
  on public.billing_subscriptions (created_at desc);

alter table public.billing_subscriptions enable row level security;

drop policy if exists billing_subscriptions_select_own on public.billing_subscriptions;
create policy billing_subscriptions_select_own
  on public.billing_subscriptions for select
  to authenticated
  using (public.is_billing_owner(customer_id));

-- ── 3) Billing entitlements ──────────────────────────────────────────────────
create table if not exists public.billing_entitlements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.billing_customers (id) on delete cascade,
  feature_code text not null check (char_length(btrim(feature_code)) between 1 and 120),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint billing_entitlements_expires_after_granted check (
    expires_at is null or expires_at > granted_at
  )
);

create index if not exists billing_entitlements_customer_idx
  on public.billing_entitlements (customer_id);
create index if not exists billing_entitlements_customer_feature_idx
  on public.billing_entitlements (customer_id, feature_code);
create index if not exists billing_entitlements_feature_code_idx
  on public.billing_entitlements (feature_code);
create index if not exists billing_entitlements_expires_at_idx
  on public.billing_entitlements (expires_at)
  where expires_at is not null;
create index if not exists billing_entitlements_granted_idx
  on public.billing_entitlements (granted_at desc);

alter table public.billing_entitlements enable row level security;

drop policy if exists billing_entitlements_select_own on public.billing_entitlements;
create policy billing_entitlements_select_own
  on public.billing_entitlements for select
  to authenticated
  using (public.is_billing_owner(customer_id));

-- ── 4) Billing invoices ──────────────────────────────────────────────────────
create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.billing_customers (id) on delete cascade,
  stripe_invoice_id text unique,
  amount_due numeric not null check (amount_due >= 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  status text not null check (status in ('draft', 'open', 'paid', 'void')),
  created_at timestamptz not null default now(),
  constraint billing_invoices_stripe_invoice_id_len check (
    stripe_invoice_id is null or char_length(btrim(stripe_invoice_id)) between 1 and 120
  )
);

create index if not exists billing_invoices_customer_idx
  on public.billing_invoices (customer_id);
create index if not exists billing_invoices_customer_created_idx
  on public.billing_invoices (customer_id, created_at desc);
create index if not exists billing_invoices_stripe_invoice_id_idx
  on public.billing_invoices (stripe_invoice_id)
  where stripe_invoice_id is not null;
create index if not exists billing_invoices_status_idx
  on public.billing_invoices (status);
create index if not exists billing_invoices_currency_idx
  on public.billing_invoices (currency_code);
create index if not exists billing_invoices_created_idx
  on public.billing_invoices (created_at desc);

alter table public.billing_invoices enable row level security;

drop policy if exists billing_invoices_select_own on public.billing_invoices;
create policy billing_invoices_select_own
  on public.billing_invoices for select
  to authenticated
  using (public.is_billing_owner(customer_id));

-- ── 5) Billing webhook events (idempotency ledger) ───────────────────────────
create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique check (char_length(btrim(stripe_event_id)) between 1 and 120),
  type text not null check (char_length(btrim(type)) between 1 and 120),
  payload jsonb not null,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists billing_webhook_events_stripe_event_id_idx
  on public.billing_webhook_events (stripe_event_id);
create index if not exists billing_webhook_events_type_idx
  on public.billing_webhook_events (type);
create index if not exists billing_webhook_events_processed_idx
  on public.billing_webhook_events (processed)
  where processed = false;
create index if not exists billing_webhook_events_created_idx
  on public.billing_webhook_events (created_at desc);

alter table public.billing_webhook_events enable row level security;
-- No authenticated policies — service_role only (idempotency ledger is internal).
-- RLS enabled with no anon/authenticated policy means only service_role (bypass) can access.

-- ── 6) Grants (self-healing for restored DBs) ───────────────────────────────
grant usage on schema public to authenticated, service_role;

grant select on public.billing_customers to authenticated, service_role;
grant all on public.billing_customers to service_role;

grant select on public.billing_subscriptions to authenticated, service_role;
grant all on public.billing_subscriptions to service_role;

grant select on public.billing_entitlements to authenticated, service_role;
grant all on public.billing_entitlements to service_role;

grant select on public.billing_invoices to authenticated, service_role;
grant all on public.billing_invoices to service_role;

grant all on public.billing_webhook_events to service_role;

-- Ensure is_billing_owner is executable by authenticated (policies invoke it as definer).
grant execute on function public.is_billing_owner(uuid) to authenticated, service_role;
