-- 0010_job_queue_function.sql
-- Atomic, idempotent job enqueue: if a job with the same idempotency key
-- already exists (any status), return it; otherwise insert a new row.
-- Used by the JobQueue repository (service role).

create or replace function public.enqueue_job(
  p_kind text,
  p_payload jsonb,
  p_idempotency_key text,
  p_correlation_id uuid,
  p_max_attempts integer
)
returns public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.background_jobs;
  created public.background_jobs;
begin
  if p_idempotency_key is not null then
    select * into existing
    from public.background_jobs
    where idempotency_key = p_idempotency_key;

    if existing.id is not null then
      return existing;
    end if;
  end if;

  insert into public.background_jobs (kind, payload, idempotency_key, correlation_id, max_attempts)
  values (p_kind, p_payload, p_idempotency_key, p_correlation_id, p_max_attempts)
  returning * into created;

  return created;
end;
$$;
