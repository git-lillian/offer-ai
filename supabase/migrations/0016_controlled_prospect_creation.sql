-- 0016_controlled_prospect_creation.sql
-- Route adviser/guardian prospect creation through a controlled, security-
-- definer RPC, matching the atomic-RPC pattern used for application cases
-- and student claiming.
--
-- Rationale: PostgREST evaluates `WITH CHECK` policies that reference
-- SECURITY DEFINER helpers (has_role, is_student_owner) correctly for plain
-- inserts but rejects the same insert when the client requests
-- `Prefer: return=representation`. A controlled RPC avoids that
-- inconsistency, returns the created row directly, and keeps write
-- authorization in one auditable place.
--
-- The direct client INSERT policy on student_profiles remains for the
-- self-registration edge case (`user_id = auth.uid()`); prospect creation
-- by advisers/guardians goes through the RPC.

-- ── 1) create_prospect: role-checked creation of an unclaimed profile ──────
create or replace function public.create_prospect(
  p_full_name text,
  p_email text
)
returns public.student_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.student_profiles;
begin
  if not (public.has_role('adviser') or public.has_role('guardian')) then
    raise exception 'not_authorized: only advisers and guardians can create prospects';
  end if;

  if btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'validation_error: prospect name is required';
  end if;

  insert into public.student_profiles (
    user_id, full_name, email, account_status, created_by_user_id
  )
  values (
    null, btrim(p_full_name), nullif(btrim(coalesce(p_email, '')), ''),
    'unclaimed', auth.uid()
  )
  returning * into v_profile;

  return v_profile;
end;
$$;

-- ── 2) Creator read-back for unclaimed prospects ────────────────────────────
-- An adviser/guardian may select the unclaimed prospects they created (to
-- list and manage them) but can never read a claimed student's profile.
drop policy if exists student_profiles_select_own on public.student_profiles;
create policy student_profiles_select_own
  on public.student_profiles for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.has_student_access(id)
    or (created_by_user_id = auth.uid() and user_id is null)
  );

-- ── 3) Direct prospect inserts by advisers are still blocked at RLS ────────
-- The 0012 `student_profiles_insert_own` policy remains for self-insert only;
-- the adviser/guardian branch of that policy is now redundant (prospect
-- creation flows through create_prospect) but harmless. Keep it so an
-- application that still uses a direct insert without representation still
-- works, while the RPC is the canonical path.