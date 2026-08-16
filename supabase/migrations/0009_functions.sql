-- 0009_functions.sql
-- Signup hook: when a user is created by Supabase Auth, provision their
-- Student 360 profile, default student role and preferences atomically.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.student_profiles (user_id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Student'),
    new.email
  )
  on conflict (user_id) do nothing;

  insert into public.identity_user_roles (user_id, role_code)
  values (new.id, 'student')
  on conflict do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
