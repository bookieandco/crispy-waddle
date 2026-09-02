create or replace function public.claim_director_generation_execution(
  p_task_id text,
  p_provider_id text,
  p_worker_id text,
  p_lease_ms integer default 30000
)
returns public.director_generation_executions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_execution public.director_generation_executions;
  v_now timestamptz := clock_timestamp();
  v_expiry timestamptz := v_now + make_interval(secs => greatest(p_lease_ms, 1000) / 1000.0);
  v_token text := md5(gen_random_uuid()::text || clock_timestamp()::text || p_worker_id);
begin
  select * into v_execution
  from public.director_generation_executions
  where task_id = p_task_id
  order by attempt desc
  limit 1
  for update;

  if v_execution.id is null then
    insert into public.director_generation_executions
      (id, task_id, provider_id, attempt, status, lease_owner, lease_token, lease_expires_at, created_at, updated_at)
    values
      (p_task_id || ':attempt:1', p_task_id, p_provider_id, 1, 'queued', p_worker_id, v_token, v_expiry, v_now, v_now)
    returning * into v_execution;
    return v_execution;
  end if;

  if v_execution.status in ('completed','failed','cancelled') then return v_execution; end if;

  if v_execution.lease_expires_at is not null
     and v_execution.lease_expires_at > v_now
     and v_execution.lease_owner is distinct from p_worker_id then
    return null;
  end if;

  update public.director_generation_executions
  set provider_id = p_provider_id,
      lease_owner = p_worker_id,
      lease_token = v_token,
      lease_expires_at = v_expiry,
      updated_at = v_now
  where id = v_execution.id
  returning * into v_execution;
  return v_execution;
end;
$$;

revoke execute on function public.claim_director_generation_execution(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_director_generation_execution(text, text, text, integer) to service_role;
