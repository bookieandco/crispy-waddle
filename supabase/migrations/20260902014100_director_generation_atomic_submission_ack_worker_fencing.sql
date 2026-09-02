drop function if exists public.ack_director_generation_submission_and_save_state(uuid,text,text,text,text,text,timestamptz,text,text,timestamptz,text,text,timestamptz);
create or replace function public.ack_director_generation_submission_and_save_state(
  p_submission_id uuid,
  p_worker_id text,
  p_submission_lease_token text,
  p_provider_job_id text,
  p_task_status text,
  p_task_error text,
  p_task_updated_at timestamptz,
  p_execution_status text,
  p_execution_error text,
  p_execution_updated_at timestamptz,
  p_execution_lease_token text,
  p_execution_lease_expires_at timestamptz
)
returns table (submission public.director_generation_submission_outbox, task public.director_generation_tasks, execution public.director_generation_executions)
language plpgsql security definer set search_path = public
as $$
declare
  v_submission public.director_generation_submission_outbox%rowtype;
  v_task public.director_generation_tasks%rowtype;
  v_execution public.director_generation_executions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_submission from public.director_generation_submission_outbox where id=p_submission_id for update;
  if not found then return; end if;
  if v_submission.status='submitted' and v_submission.provider_job_id=p_provider_job_id then
    select * into v_task from public.director_generation_tasks where id=v_submission.task_id;
    select * into v_execution from public.director_generation_executions where id=v_submission.execution_id;
    submission:=v_submission; task:=v_task; execution:=v_execution; return next; return;
  end if;
  if v_submission.status <> 'submitting' or v_submission.lease_owner <> p_worker_id or v_submission.lease_token <> p_submission_lease_token or v_submission.lease_expires_at is null or v_submission.lease_expires_at <= v_now then return; end if;
  select * into v_task from public.director_generation_tasks where id=v_submission.task_id for update;
  if not found then return; end if;
  select * into v_execution from public.director_generation_executions where id=v_submission.execution_id for update;
  if not found then return; end if;
  if v_execution.task_id <> v_submission.task_id or v_execution.lease_owner <> p_worker_id or v_execution.lease_token <> p_execution_lease_token or v_execution.lease_expires_at is null or v_execution.lease_expires_at <= v_now then return; end if;
  update public.director_generation_submission_outbox set status='submitted', provider_job_id=p_provider_job_id, lease_owner=null, lease_token=null, lease_expires_at=null, updated_at=v_now where id=p_submission_id returning * into v_submission;
  update public.director_generation_executions set provider_job_id=p_provider_job_id, status=p_execution_status, error=p_execution_error, lease_owner=p_worker_id, lease_token=p_execution_lease_token, lease_expires_at=p_execution_lease_expires_at, updated_at=p_execution_updated_at where id=v_execution.id returning * into v_execution;
  update public.director_generation_tasks set status=p_task_status, error=p_task_error, updated_at=p_task_updated_at where id=v_task.id returning * into v_task;
  submission:=v_submission; task:=v_task; execution:=v_execution; return next;
end; $$;
revoke execute on function public.ack_director_generation_submission_and_save_state(uuid,text,text,text,text,text,timestamptz,text,text,timestamptz,text,timestamptz) from public,anon,authenticated;
grant execute on function public.ack_director_generation_submission_and_save_state(uuid,text,text,text,text,text,timestamptz,text,text,timestamptz,text,timestamptz) to service_role;
