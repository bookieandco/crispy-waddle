create or replace function public.reserve_director_generation_submission(
  p_task_id text,
  p_execution_id text,
  p_provider_id text,
  p_idempotency_key text,
  p_request_payload jsonb,
  p_lease_owner text,
  p_lease_token text
)
returns public.director_generation_submission_outbox
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.director_generation_tasks;
  v_execution public.director_generation_executions;
  v_existing public.director_generation_submission_outbox;
  v_row public.director_generation_submission_outbox;
begin
  select * into v_task
  from public.director_generation_tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'generation task not found: %', p_task_id;
  end if;

  select * into v_execution
  from public.director_generation_executions
  where id = p_execution_id
  for update;

  if not found or v_execution.task_id <> p_task_id then
    raise exception 'generation execution does not belong to task: %', p_execution_id;
  end if;

  if v_execution.lease_owner is distinct from p_lease_owner
     or v_execution.lease_token is distinct from p_lease_token
     or v_execution.lease_expires_at is null
     or v_execution.lease_expires_at <= clock_timestamp() then
    raise exception 'stale or expired generation execution lease: %', p_execution_id;
  end if;

  select * into v_existing
  from public.director_generation_submission_outbox
  where provider_id = p_provider_id
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_existing.task_id <> p_task_id or v_existing.execution_id <> p_execution_id then
      raise exception 'submission idempotency key belongs to another generation execution';
    end if;
    return v_existing;
  end if;

  insert into public.director_generation_submission_outbox (
    task_id, execution_id, provider_id, idempotency_key, request_payload,
    status, attempt, lease_owner, lease_token, lease_expires_at,
    created_at, updated_at
  ) values (
    p_task_id, p_execution_id, p_provider_id, p_idempotency_key, p_request_payload,
    'pending', 0, p_lease_owner, p_lease_token, v_execution.lease_expires_at,
    clock_timestamp(), clock_timestamp()
  ) returning * into v_row;

  return v_row;
exception
  when unique_violation then
    select * into v_existing
    from public.director_generation_submission_outbox
    where provider_id = p_provider_id
      and idempotency_key = p_idempotency_key;
    if found and v_existing.task_id = p_task_id and v_existing.execution_id = p_execution_id then
      return v_existing;
    end if;
    raise;
end;
$$;

revoke execute on function public.reserve_director_generation_submission(text,text,text,text,jsonb,text,text) from public;
revoke execute on function public.reserve_director_generation_submission(text,text,text,text,jsonb,text,text) from anon;
revoke execute on function public.reserve_director_generation_submission(text,text,text,text,jsonb,text,text) from authenticated;
grant execute on function public.reserve_director_generation_submission(text,text,text,text,jsonb,text,text) to service_role;
