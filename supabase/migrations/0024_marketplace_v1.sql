-- 0024_marketplace_v1.sql
-- Human expert marketplace v1: provider profiles, service listings, bookings, orders.
-- Students buy human adviser/reviewer services (personal statement review,
-- application strategy, mentoring) and the platform takes a commission.
-- Types only in foundation; this migration adds the minimal plausible schema
-- plus RLS, indexes, checks and self-healing grants.
--
-- See docs/architecture/marketplace.md, domain-map.md:20, vision.md:15.

-- ── 0) Helper: does the current user own this marketplace provider? ─────────
create or replace function public.is_provider_owner(p_provider_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.provider_profiles pp
    where pp.id = p_provider_id
      and pp.user_id = auth.uid()
  );
$$;

-- ── 1) Provider profiles ─────────────────────────────────────────────────────
create table if not exists public.provider_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  bio text not null default '' check (char_length(bio) <= 2000),
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  specialisms text[] not null default '{}',
  country_scope text[] not null default '{}',
  language_scope text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists provider_profiles_user_idx
  on public.provider_profiles (user_id);
create index if not exists provider_profiles_verification_idx
  on public.provider_profiles (verification_status);
create index if not exists provider_profiles_created_idx
  on public.provider_profiles (created_at desc);

alter table public.provider_profiles enable row level security;

-- Readable by all authenticated (students can discover verified providers).
drop policy if exists provider_profiles_select_all on public.provider_profiles;
create policy provider_profiles_select_all
  on public.provider_profiles for select
  to authenticated
  using (true);

-- Writable only by the owning provider (auth.uid() = user_id).
drop policy if exists provider_profiles_insert_own on public.provider_profiles;
create policy provider_profiles_insert_own
  on public.provider_profiles for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists provider_profiles_update_own on public.provider_profiles;
create policy provider_profiles_update_own
  on public.provider_profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists provider_profiles_delete_own on public.provider_profiles;
create policy provider_profiles_delete_own
  on public.provider_profiles for delete
  to authenticated
  using (user_id = auth.uid());

-- ── 2) Service listings ──────────────────────────────────────────────────────
create table if not exists public.service_listings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  service_type text not null check (service_type in (
    'personal_statement', 'strategy', 'mentoring', 'cv_review', 'interview_prep', 'other'
  )),
  price numeric(10,2) not null check (price >= 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  turnaround_days integer not null check (turnaround_days between 1 and 90),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_listings_provider_idx
  on public.service_listings (provider_id);
create index if not exists service_listings_service_type_idx
  on public.service_listings (service_type);
create index if not exists service_listings_is_active_idx
  on public.service_listings (is_active);
create index if not exists service_listings_provider_active_idx
  on public.service_listings (provider_id, is_active);
create index if not exists service_listings_created_idx
  on public.service_listings (created_at desc);
create index if not exists service_listings_title_trgm_idx
  on public.service_listings using gin (title gin_trgm_ops);

alter table public.service_listings enable row level security;

-- Public catalogue: readable by anon and authenticated (like catalog/opportunities).
drop policy if exists service_listings_read_all on public.service_listings;
create policy service_listings_read_all
  on public.service_listings for select
  to anon, authenticated
  using (true);

-- Writable only by the owning provider.
drop policy if exists service_listings_insert_owner on public.service_listings;
create policy service_listings_insert_owner
  on public.service_listings for insert
  to authenticated
  with check (public.is_provider_owner(provider_id));

drop policy if exists service_listings_update_owner on public.service_listings;
create policy service_listings_update_owner
  on public.service_listings for update
  to authenticated
  using (public.is_provider_owner(provider_id))
  with check (public.is_provider_owner(provider_id));

drop policy if exists service_listings_delete_owner on public.service_listings;
create policy service_listings_delete_owner
  on public.service_listings for delete
  to authenticated
  using (public.is_provider_owner(provider_id));

-- ── 3) Bookings ──────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  service_listing_id uuid not null references public.service_listings (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_student_idx
  on public.bookings (student_id, created_at desc);
create index if not exists bookings_provider_idx
  on public.bookings (provider_id, created_at desc);
create index if not exists bookings_service_listing_idx
  on public.bookings (service_listing_id);
create index if not exists bookings_status_idx
  on public.bookings (status);
create index if not exists bookings_student_status_idx
  on public.bookings (student_id, status);
create index if not exists bookings_provider_status_idx
  on public.bookings (provider_id, status);
create index if not exists bookings_scheduled_idx
  on public.bookings (scheduled_at);

alter table public.bookings enable row level security;

-- Scoped to the student owner or the provider owner.
drop policy if exists bookings_select_scoped on public.bookings;
create policy bookings_select_scoped
  on public.bookings for select
  to authenticated
  using (
    public.is_student_owner(student_id)
    or public.is_provider_owner(provider_id)
  );

drop policy if exists bookings_insert_student on public.bookings;
create policy bookings_insert_student
  on public.bookings for insert
  to authenticated
  with check (public.is_student_owner(student_id));

drop policy if exists bookings_update_scoped on public.bookings;
create policy bookings_update_scoped
  on public.bookings for update
  to authenticated
  using (
    public.is_student_owner(student_id)
    or public.is_provider_owner(provider_id)
  )
  with check (
    public.is_student_owner(student_id)
    or public.is_provider_owner(provider_id)
  );

drop policy if exists bookings_delete_scoped on public.bookings;
create policy bookings_delete_scoped
  on public.bookings for delete
  to authenticated
  using (
    public.is_student_owner(student_id)
    or public.is_provider_owner(provider_id)
  );

-- ── 4) Service orders ────────────────────────────────────────────────────────
create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  platform_fee numeric(10,2) not null check (platform_fee >= 0),
  total numeric(10,2) not null check (total >= 0),
  currency_code text not null default 'GBP' check (currency_code ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'completed', 'disputed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id),
  constraint service_orders_total_check check (total = amount + platform_fee),
  constraint service_orders_fee_not_exceed_total check (platform_fee <= total)
);

create index if not exists service_orders_booking_idx
  on public.service_orders (booking_id);
create index if not exists service_orders_student_idx
  on public.service_orders (student_id, created_at desc);
create index if not exists service_orders_provider_idx
  on public.service_orders (provider_id, created_at desc);
create index if not exists service_orders_status_idx
  on public.service_orders (status);
create index if not exists service_orders_student_status_idx
  on public.service_orders (student_id, status);
create index if not exists service_orders_provider_status_idx
  on public.service_orders (provider_id, status);

alter table public.service_orders enable row level security;

drop policy if exists service_orders_select_scoped on public.service_orders;
create policy service_orders_select_scoped
  on public.service_orders for select
  to authenticated
  using (
    public.is_student_owner(student_id)
    or public.is_provider_owner(provider_id)
  );

drop policy if exists service_orders_insert_scoped on public.service_orders;
create policy service_orders_insert_scoped
  on public.service_orders for insert
  to authenticated
  with check (
    public.is_student_owner(student_id)
    or public.is_provider_owner(provider_id)
  );

drop policy if exists service_orders_update_scoped on public.service_orders;
create policy service_orders_update_scoped
  on public.service_orders for update
  to authenticated
  using (
    public.is_student_owner(student_id)
    or public.is_provider_owner(provider_id)
  )
  with check (
    public.is_student_owner(student_id)
    or public.is_provider_owner(provider_id)
  );

drop policy if exists service_orders_delete_scoped on public.service_orders;
create policy service_orders_delete_scoped
  on public.service_orders for delete
  to authenticated
  using (
    public.is_student_owner(student_id)
    or public.is_provider_owner(provider_id)
  );

-- ── 5) Service reviews ───────────────────────────────────────────────────────
-- One review per order, authored by the student.
create table if not exists public.service_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders (id) on delete cascade,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  unique (order_id)
);

create index if not exists service_reviews_order_idx
  on public.service_reviews (order_id);
create index if not exists service_reviews_provider_idx
  on public.service_reviews (provider_id, created_at desc);
create index if not exists service_reviews_student_idx
  on public.service_reviews (student_id, created_at desc);
create index if not exists service_reviews_rating_idx
  on public.service_reviews (rating);

alter table public.service_reviews enable row level security;

-- Readable by anon/authenticated (public proof of provider quality).
drop policy if exists service_reviews_read_all on public.service_reviews;
create policy service_reviews_read_all
  on public.service_reviews for select
  to anon, authenticated
  using (true);

-- Insert: only the student owner of the order.
drop policy if exists service_reviews_insert_student on public.service_reviews;
create policy service_reviews_insert_student
  on public.service_reviews for insert
  to authenticated
  with check (public.is_student_owner(student_id));

-- Update/delete: student owner or provider (moderation).
drop policy if exists service_reviews_update_scoped on public.service_reviews;
create policy service_reviews_update_scoped
  on public.service_reviews for update
  to authenticated
  using (
    public.is_student_owner(student_id)
    or public.is_provider_owner(provider_id)
  )
  with check (
    public.is_student_owner(student_id)
    or public.is_provider_owner(provider_id)
  );

drop policy if exists service_reviews_delete_scoped on public.service_reviews;
create policy service_reviews_delete_scoped
  on public.service_reviews for delete
  to authenticated
  using (
    public.is_student_owner(student_id)
    or public.is_provider_owner(provider_id)
  );

-- ── 6) Marketplace commissions ───────────────────────────────────────────────
-- Platform fee ledger: one row per order, service_role managed.
create table if not exists public.marketplace_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  rate numeric(5,4) not null check (rate >= 0 and rate <= 1),
  currency_code text not null default 'GBP' check (currency_code ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  unique (order_id)
);

create index if not exists marketplace_commissions_order_idx
  on public.marketplace_commissions (order_id);
create index if not exists marketplace_commissions_provider_idx
  on public.marketplace_commissions (provider_id, created_at desc);

alter table public.marketplace_commissions enable row level security;

-- Readable by participants; writes are service_role only (no client insert/update).
drop policy if exists marketplace_commissions_select_scoped on public.marketplace_commissions;
create policy marketplace_commissions_select_scoped
  on public.marketplace_commissions for select
  to authenticated
  using (
    public.is_provider_owner(provider_id)
    or exists (
      select 1 from public.service_orders so
      where so.id = order_id and public.is_student_owner(so.student_id)
    )
  );

-- ── 7) Grants (self-healing for restored DBs) ───────────────────────────────
grant usage on schema public to anon, authenticated, service_role;

grant select on public.provider_profiles to anon, authenticated, service_role;
grant insert, update, delete on public.provider_profiles to authenticated, service_role;
grant all on public.provider_profiles to service_role;

grant select on public.service_listings to anon, authenticated, service_role;
grant insert, update, delete on public.service_listings to authenticated, service_role;
grant all on public.service_listings to service_role;

grant select, insert, update, delete on public.bookings to authenticated, service_role;
grant all on public.bookings to service_role;

grant select, insert, update, delete on public.service_orders to authenticated, service_role;
grant all on public.service_orders to service_role;

grant select on public.service_reviews to anon, authenticated, service_role;
grant insert, update, delete on public.service_reviews to authenticated, service_role;
grant all on public.service_reviews to service_role;

grant select on public.marketplace_commissions to authenticated, service_role;
grant all on public.marketplace_commissions to service_role;
