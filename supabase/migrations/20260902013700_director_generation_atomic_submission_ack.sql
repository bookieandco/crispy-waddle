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
  p_execution_lease_owner text,
  p_execution_lease_token text,
  p_execution_lease_expires_at timestamptz
)
returns table (
  submission public.director_generation_submission_outbox,
  task public.director_generation_tasks,
  execution public.director_generation_executions
)
language plpgsql security definer set search_path = public
as $$
declare
  s public.director_generation_submission_outbox;
  t public.director_generation_tasks;
  e public.director_generation_executions;
  v_now timestamptz := clock_timestamp();
begin
  select * into s from public.director_generation_submission_outbox where id=p_submission_id for update;
  if not found then return; end if;

  if s.status='submitted' and s.provider_job_id=p_provider_job_id then
    select * into t from public.director_generation_tasks where id=s.task_id;
    select * into e from public.director_generation_executions where id=s.execution_id;
    submission := s; task := t; execution := e; return next; return;
  end if;

  if s.status <> 'submitting'
     or s.lease_owner <> p_worker_id
     or s.lease_token <> p_submission_lease_token
     or s.lease_expires_at is null
     or s.lease_expires_at <= v_now then return; end if;

  select * into t from public.director_generation_tasks where id=s.task_id for update;
  if not found then return; end if;
  select * into e from public.director_generation_executions where id=s.execution_id for update;
  if not found then return; end if;

  if e.task_id <> s.task_id
     or e.lease_owner <> p_execution_lease_owner
     or e.lease_token <> p_execution_lease_token
     or e.lease_expires_at is null
     or e.lease_expires_at <= v_now then return; end if;

  update public.director_generation_submission_outbox
     set status='submitted', provider_job_id=p_provider_job_id,
         lease_owner=null, lease_token=null, lease_expires_at=null, updated_at=v_now
   where id=s.id returning * into s;

  update public.director_generation_executions
     set provider_job_id=p_provider_job_id, status=p_execution_status,
         error=p_execution_error, lease_owner=p_execution_lease_owner,
         lease_token=p_execution_lease_token, lease_expires_at=p_execution_lease_expires_at,
         updated_at=p_execution_updated_at
   where id=e.id returning * into e;

  update public.director_generation_tasks
     set status=p_task_status, error=p_task_error, updated_at=p_task_updated_at
   where id=t.id returning * into t;

  submission := s; task := t; execution := e; return next;
end;
$$;

revoke all on function public.ack_director_generation_submission_and_save_state(uuid,text,text,text,text,text,timestamptz,text,text,timestamptz,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.ack_director_generation_submission_and_save_state(uuid,text,text,text,text,text,timestamptz,text,text,timestamptz,text,text,timestamptz) to service_role;
