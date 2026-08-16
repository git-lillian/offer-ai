-- 0013_atomic_application_cases.sql
-- ApplicationCase atomicity + invariants + route fix.
--
-- 1. `ucs` -> `ucas` (the correct application-routing body).
-- 2. Cross-table invariants enforced by trigger:
--      institution <-> course, course <-> intake, intake <-> cycle
-- 3. Atomic operations (security-definer RPCs): create case + created event
--    in one transaction; transition status + event in one transaction;
--    controlled append of non-status events; student profile claiming.

-- ── 1) Route value fix: ucs -> ucas ─────────────────────────────────────────
update public.application_cases
   set application_route = 'ucas'
 where application_route = 'ucs';

alter table public.application_cases
  drop constraint application_cases_application_route_check;
alter table public.application_cases
  add constraint application_cases_application_route_check
    check (application_route in ('ucas', 'institution_direct', 'agent_portal', 'other'));

-- ── 2) Invariant trigger ────────────────────────────────────────────────────
create or replace function public.application_case_invariants()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.catalog_courses c
    where c.id = new.course_id and c.institution_id = new.institution_id
  ) then
    raise exception 'application_case_invariant_violation: course does not belong to institution';
  end if;

  if not exists (
    select 1 from public.catalog_course_intakes i
    where i.id = new.course_intake_id and i.course_id = new.course_id
  ) then
    raise exception 'application_case_invariant_violation: intake does not belong to course';
  end if;

  if not exists (
    select 1 from public.catalog_course_intakes i
    where i.id = new.course_intake_id and i.application_cycle_id = new.application_cycle_id
  ) then
    raise exception 'application_case_invariant_violation: intake does not belong to cycle';
  end if;

  return new;
end;
$$;

drop trigger if exists application_cases_invariants_trigger on public.application_cases;
create trigger application_cases_invariants_trigger
  before insert or update on public.application_cases
  for each row execute function public.application_case_invariants();

-- ── 3) Transition matrix (mirrors packages/domain/src/application-case.ts) ──
-- Keep in sync when the domain state machine changes.
create or replace function public.transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select p_from = p_to or p_to = any (case p_from
    when 'draft'          then array['in_progress', 'withdrawn']
    when 'in_progress'    then array['draft', 'submitted', 'withdrawn']
    when 'submitted'      then array['under_review', 'withdrawn']
    when 'under_review'   then array['offer_received', 'rejected', 'withdrawn']
    when 'offer_received' then array['accepted', 'declined_offer', 'withdrawn']
    when 'accepted'       then array['enrolled', 'declined_offer', 'withdrawn']
    when 'rejected'       then array['withdrawn']
    else array[]::text[]
  end);
$$;

-- ── 4) Atomic create: case + created event ──────────────────────────────────
-- The only client path for creating an application case. Enforces the
-- cross-table invariants and cycle-open rule inside the same transaction.
create or replace function public.create_application_case(
  p_student_id uuid,
  p_institution_id uuid,
  p_course_id uuid,
  p_course_intake_id uuid,
  p_application_cycle_id uuid,
  p_application_route text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.application_cases;
  v_event public.application_events;
begin
  if not (public.is_student_owner(p_student_id) or public.has_student_access(p_student_id)) then
    raise exception 'not_authorized: cannot create a case for this student';
  end if;

  if not exists (select 1 from public.student_profiles sp where sp.id = p_student_id) then
    raise exception 'not_found: student profile';
  end if;
  if not exists (select 1 from public.catalog_institutions i where i.id = p_institution_id) then
    raise exception 'not_found: institution';
  end if;
  if not exists (
    select 1 from public.catalog_courses c
    where c.id = p_course_id and c.institution_id = p_institution_id
  ) then
    raise exception 'application_case_invariant_violation: course does not belong to institution';
  end if;
  if not exists (
    select 1 from public.catalog_course_intakes i
    where i.id = p_course_intake_id and i.course_id = p_course_id
  ) then
    raise exception 'application_case_invariant_violation: intake does not belong to course';
  end if;
  if not exists (
    select 1 from public.catalog_course_intakes i
    where i.id = p_course_intake_id and i.application_cycle_id = p_application_cycle_id
  ) then
    raise exception 'application_case_invariant_violation: intake does not belong to cycle';
  end if;
  if exists (
    select 1 from public.catalog_application_cycles cy
    where cy.id = p_application_cycle_id and cy.status = 'closed'
  ) then
    raise exception 'conflict: application cycle is closed';
  end if;

  insert into public.application_cases (
    student_id, institution_id, course_id, course_intake_id,
    application_cycle_id, application_route, current_status
  )
  values (
    p_student_id, p_institution_id, p_course_id, p_course_intake_id,
    p_application_cycle_id, p_application_route, 'draft'
  )
  returning * into v_case;

  insert into public.application_events (case_id, event_type, status, actor_user_id, message)
  values (v_case.id, 'created', 'draft', p_actor_user_id, 'Application case created.')
  returning * into v_event;

  return jsonb_build_object('case', to_jsonb(v_case), 'event', to_jsonb(v_event));
end;
$$;

-- ── 5) Atomic transition: status + event ────────────────────────────────────
-- The only client path for changing an application case status.
create or replace function public.transition_application_case(
  p_case_id uuid,
  p_to_status text,
  p_actor_user_id uuid,
  p_event_type text,
  p_message text,
  p_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.application_cases;
  v_event public.application_events;
begin
  select * into v_case
    from public.application_cases
   where id = p_case_id
     for update;

  if not found then
    raise exception 'not_found: application case';
  end if;

  if not (
    public.is_student_owner(v_case.student_id)
    or public.has_student_access(v_case.student_id)
    or public.has_scoped_grant(v_case.student_id, 'case', v_case.id)
  ) then
    raise exception 'not_authorized: cannot transition this case';
  end if;

  if not public.transition_allowed(v_case.current_status, p_to_status) then
    raise exception 'invalid_transition: % -> %', v_case.current_status, p_to_status;
  end if;

  update public.application_cases
     set current_status = p_to_status, updated_at = now()
   where id = p_case_id;

  insert into public.application_events (case_id, event_type, status, actor_user_id, message, metadata)
  values (p_case_id, p_event_type, p_to_status, p_actor_user_id, p_message, p_metadata)
  returning * into v_event;

  return to_jsonb(v_event);
end;
$$;

-- ── 6) Controlled event append (notes, documents) ───────────────────────────
-- Non-status events may only be appended through this function; the event
-- stream stays append-only and authorization is enforced.
create or replace function public.append_application_event(
  p_case_id uuid,
  p_event_type text,
  p_status text,
  p_actor_user_id uuid,
  p_message text,
  p_metadata jsonb
)
returns public.application_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.application_cases;
  v_event public.application_events;
begin
  if p_event_type not in ('note_added', 'document_added', 'other') then
    raise exception 'invalid_event_type: must use a controlled operation for status events';
  end if;

  select * into v_case
    from public.application_cases
   where id = p_case_id
     for update;

  if not found then
    raise exception 'not_found: application case';
  end if;

  if not (
    public.is_student_owner(v_case.student_id)
    or public.has_student_access(v_case.student_id)
    or public.has_scoped_grant(v_case.student_id, 'case', v_case.id)
  ) then
    raise exception 'not_authorized: cannot append events to this case';
  end if;

  insert into public.application_events (case_id, event_type, status, actor_user_id, message, metadata)
  values (p_case_id, p_event_type, p_status, p_actor_user_id, p_message, p_metadata)
  returning * into v_event;

  return v_event;
end;
$$;

-- ── 7) Student profile claiming ─────────────────────────────────────────────
-- A person who created/registers an account links an unclaimed student
-- profile to their auth account. One auth account <=> one student profile.
create or replace function public.claim_student_profile(p_student_id uuid)
returns public.student_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.student_profiles;
begin
  select * into v_profile
    from public.student_profiles
   where id = p_student_id
     for update;

  if not found then
    raise exception 'not_found: student profile';
  end if;

  if v_profile.user_id is not null then
    raise exception 'conflict: student profile already claimed';
  end if;
  if v_profile.account_status <> 'unclaimed' then
    raise exception 'conflict: student profile is not claimable';
  end if;
  if exists (
    select 1 from public.student_profiles sp
    where sp.user_id = auth.uid() and sp.id <> p_student_id
  ) then
    raise exception 'conflict: this account is already linked to a student profile';
  end if;

  update public.student_profiles
     set user_id = auth.uid(), account_status = 'claimed', claimed_at = now()
   where id = p_student_id
  returning * into v_profile;

  return v_profile;
end;
$$;