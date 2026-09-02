alter table public.director_generation_executions
  add column if not exists lease_token text;

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
  v_now timestamptz := now();
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

  if v_execution.status in ('completed','failed','cancelled') then
    return v_execution;
  end if;

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

create or replace function public.save_director_generation_state(
  p_task_id text,
  p_project_id text,
  p_edit_plan_id text,
  p_operation_id text,
  p_idempotency_key text,
  p_request jsonb,
  p_task_status text,
  p_task_error text,
  p_task_updated_at timestamptz,
  p_execution_id text,
  p_execution_task_id text,
  p_provider_id text,
  p_provider_job_id text,
  p_attempt integer,
  p_execution_status text,
  p_execution_error text,
  p_lease_owner text,
  p_lease_token text,
  p_lease_expires_at timestamptz,
  p_execution_created_at timestamptz,
  p_execution_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.director_generation_tasks;
  v_execution public.director_generation_executions;
begin
  select * into v_task
  from public.director_generation_tasks
  where id = p_task_id
  for update;

  if v_task.id is null then
    return jsonb_build_object('saved', false, 'task', null, 'execution', null);
  end if;

  select * into v_execution
  from public.director_generation_executions
  where id = p_execution_id
  for update;

  if v_execution.id is null
     or v_execution.task_id is distinct from p_task_id
     or p_execution_task_id is distinct from p_task_id then
    return jsonb_build_object('saved', false, 'task', to_jsonb(v_task), 'execution', null);
  end if;

  if v_execution.lease_token is not null
     and v_execution.lease_token is distinct from p_lease_token then
    return jsonb_build_object('saved', false, 'task', to_jsonb(v_task), 'execution', to_jsonb(v_execution));
  end if;

  if v_execution.lease_owner is not null
     and v_execution.lease_owner is distinct from p_lease_owner then
    return jsonb_build_object('saved', false, 'task', to_jsonb(v_task), 'execution', to_jsonb(v_execution));
  end if;

  update public.director_generation_executions
  set task_id = p_execution_task_id,
      provider_id = p_provider_id,
      provider_job_id = p_provider_job_id,
      attempt = p_attempt,
      status = p_execution_status,
      error = p_execution_error,
      lease_owner = p_lease_owner,
      lease_token = p_lease_token,
      lease_expires_at = p_lease_expires_at,
      created_at = p_execution_created_at,
      updated_at = p_execution_updated_at
  where id = p_execution_id
  returning * into v_execution;

  update public.director_generation_tasks
  set project_id = p_project_id,
      edit_plan_id = p_edit_plan_id,
      operation_id = p_operation_id,
      idempotency_key = p_idempotency_key,
      request = p_request,
      status = p_task_status,
      error = p_task_error,
      updated_at = p_task_updated_at
  where id = p_task_id
  returning * into v_task;

  return jsonb_build_object('saved', true, 'task', to_jsonb(v_task), 'execution', to_jsonb(v_execution));
end;
$$;

revoke execute on function public.claim_director_generation_execution(text, text, text, integer) from public, anon, authenticated;
revoke execute on function public.save_director_generation_state(text, text, text, text, text, jsonb, text, text, timestamptz, text, text, text, text, integer, text, text, text, text, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_director_generation_execution(text, text, text, integer) to service_role;
grant execute on function public.save_director_generation_state(text, text, text, text, text, jsonb, text, text, timestamptz, text, text, text, text, integer, text, text, text, text, timestamptz, timestamptz, timestamptz) to service_role;
