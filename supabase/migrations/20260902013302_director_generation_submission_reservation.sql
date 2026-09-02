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
  v_execution public.director_generation_executions%rowtype;
  v_task public.director_generation_tasks%rowtype;
  v_submission public.director_generation_submission_outbox%rowtype;
begin
  select * into v_task from public.director_generation_tasks where id = p_task_id for update;
  if not found then return null; end if;

  select * into v_execution from public.director_generation_executions where id = p_execution_id for update;
  if not found or v_execution.task_id <> p_task_id then return null; end if;
  if v_execution.lease_owner is distinct from p_lease_owner
     or v_execution.lease_token is distinct from p_lease_token
     or v_execution.lease_expires_at is null
     or v_execution.lease_expires_at <= clock_timestamp() then
    return null;
  end if;

  select * into v_submission
  from public.director_generation_submission_outbox
  where provider_id = p_provider_id and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_submission.task_id <> p_task_id then
      raise exception 'Submission idempotency key belongs to another generation task';
    end if;
    if v_submission.status <> 'submitted' then
      update public.director_generation_submission_outbox
      set execution_id = p_execution_id,
          request_payload = p_request_payload,
          lease_owner = p_lease_owner,
          lease_token = p_lease_token,
          lease_expires_at = v_execution.lease_expires_at,
          updated_at = clock_timestamp()
      where id = v_submission.id
      returning * into v_submission;
    end if;
    return v_submission;
  end if;

  insert into public.director_generation_submission_outbox (
    task_id, execution_id, provider_id, idempotency_key, request_payload,
    status, attempt, lease_owner, lease_token, lease_expires_at,
    created_at, updated_at
  ) values (
    p_task_id, p_execution_id, p_provider_id, p_idempotency_key, p_request_payload,
    'pending', 0, p_lease_owner, p_lease_token, v_execution.lease_expires_at,
    clock_timestamp(), clock_timestamp()
  ) returning * into v_submission;

  return v_submission;
exception
  when unique_violation then
    select * into v_submission
    from public.director_generation_submission_outbox
    where provider_id = p_provider_id and idempotency_key = p_idempotency_key;
    if v_submission.task_id <> p_task_id then
      raise exception 'Submission idempotency key belongs to another generation task';
    end if;
    return v_submission;
end;
$$;

revoke execute on function public.reserve_director_generation_submission(text,text,text,text,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.reserve_director_generation_submission(text,text,text,text,jsonb,text,text) to service_role;
