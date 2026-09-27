-- CLOUD.4/11: durable compute submission/result receipts.
-- Evidence/reconciliation only. Rows grant no execution authority.

create table if not exists public.jhadina_compute_executions (
  submission_id text primary key,
  action_request_id text not null,
  owner_user_id uuid not null,
  workload_id text not null,
  work_session_id text not null,
  task_id text not null,
  idempotency_key text not null,
  target text not null check (target in ('kubernetes-job','ray-job','long-lived-service')),
  provider text not null check (provider in ('kubernetes','shadow')),
  namespace text not null,
  queue_name text not null,
  resource_name text not null,
  planned_node_id text not null,
  actual_node_id text,
  primary_storage_backend_id text not null,
  cache_storage_backend_id text,
  manifest_fingerprint text not null,
  submitted_at timestamptz not null,
  result_status text check (result_status is null or result_status in ('succeeded','failed','cancelled')),
  result_started_at timestamptz,
  result_completed_at timestamptz,
  output_refs jsonb not null default '[]'::jsonb,
  telemetry_ref text,
  error_code text,
  retryable boolean,
  updated_at timestamptz not null default now(),
  foreign key (work_session_id,task_id)
    references public.jhadina_work_session_tasks(work_session_id,id) on delete cascade,
  foreign key (work_session_id,owner_user_id)
    references public.jhadina_work_sessions(id,owner_user_id) on delete cascade
);

create unique index if not exists jhadina_compute_executions_idempotency_idx
  on public.jhadina_compute_executions(owner_user_id,work_session_id,task_id,idempotency_key);

create index if not exists jhadina_compute_executions_workload_idx
  on public.jhadina_compute_executions(workload_id,submitted_at desc);

create index if not exists jhadina_compute_executions_pending_idx
  on public.jhadina_compute_executions(provider,result_status,submitted_at)
  where result_status is null;

alter table public.jhadina_compute_executions enable row level security;
revoke all on public.jhadina_compute_executions from anon, authenticated;
grant select, insert, update on public.jhadina_compute_executions to service_role;
revoke delete, truncate on public.jhadina_compute_executions from service_role;

comment on table public.jhadina_compute_executions is
  'Compute execution receipts for idempotent reconciliation. Evidence only; never execution authority.';

create or replace function public.jhadina_record_compute_submission(
  p_submission_id text,
  p_action_request_id text,
  p_owner_user_id uuid,
  p_workload_id text,
  p_work_session_id text,
  p_task_id text,
  p_idempotency_key text,
  p_target text,
  p_provider text,
  p_namespace text,
  p_queue_name text,
  p_resource_name text,
  p_planned_node_id text,
  p_primary_storage_backend_id text,
  p_cache_storage_backend_id text,
  p_manifest_fingerprint text,
  p_submitted_at timestamptz
)
returns public.jhadina_compute_executions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.jhadina_compute_executions;
begin
  insert into public.jhadina_compute_executions (
    submission_id,action_request_id,owner_user_id,workload_id,work_session_id,task_id,
    idempotency_key,target,provider,namespace,queue_name,resource_name,planned_node_id,
    primary_storage_backend_id,cache_storage_backend_id,manifest_fingerprint,submitted_at,updated_at
  ) values (
    p_submission_id,p_action_request_id,p_owner_user_id,p_workload_id,p_work_session_id,p_task_id,
    p_idempotency_key,p_target,p_provider,p_namespace,p_queue_name,p_resource_name,p_planned_node_id,
    p_primary_storage_backend_id,p_cache_storage_backend_id,p_manifest_fingerprint,p_submitted_at,clock_timestamp()
  )
  on conflict (owner_user_id,work_session_id,task_id,idempotency_key) do nothing;

  select * into v_row
    from public.jhadina_compute_executions e
   where e.owner_user_id=p_owner_user_id
     and e.work_session_id=p_work_session_id
     and e.task_id=p_task_id
     and e.idempotency_key=p_idempotency_key;

  if v_row.submission_id is null then
    raise exception 'COMPUTE_EXECUTION_RECEIPT_NOT_FOUND';
  end if;

  if v_row.submission_id<>p_submission_id
     or v_row.workload_id<>p_workload_id
     or v_row.manifest_fingerprint<>p_manifest_fingerprint then
    raise exception 'COMPUTE_EXECUTION_IDEMPOTENCY_CONFLICT';
  end if;

  return v_row;
end;
$$;

create or replace function public.jhadina_record_compute_result(
  p_submission_id text,
  p_workload_id text,
  p_status text,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_output_refs jsonb,
  p_telemetry_ref text,
  p_error_code text,
  p_retryable boolean,
  p_actual_node_id text
)
returns public.jhadina_compute_executions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.jhadina_compute_executions;
begin
  if p_status not in ('succeeded','failed','cancelled') then
    raise exception 'COMPUTE_EXECUTION_RESULT_STATUS_INVALID';
  end if;
  if p_completed_at < p_started_at then
    raise exception 'COMPUTE_EXECUTION_RESULT_TIME_INVALID';
  end if;

  select * into v_row
    from public.jhadina_compute_executions
   where submission_id=p_submission_id
   for update;

  if v_row.submission_id is null then
    raise exception 'COMPUTE_EXECUTION_SUBMISSION_NOT_FOUND';
  end if;
  if v_row.workload_id<>p_workload_id then
    raise exception 'COMPUTE_EXECUTION_RESULT_WORKLOAD_MISMATCH';
  end if;
  if v_row.result_status is not null then
    if v_row.result_status<>p_status
       or v_row.result_completed_at<>p_completed_at
       or coalesce(v_row.error_code,'')<>coalesce(p_error_code,'') then
      raise exception 'COMPUTE_EXECUTION_RESULT_CONFLICT';
    end if;
    return v_row;
  end if;

  update public.jhadina_compute_executions
     set result_status=p_status,
         result_started_at=p_started_at,
         result_completed_at=p_completed_at,
         output_refs=coalesce(p_output_refs,'[]'::jsonb),
         telemetry_ref=p_telemetry_ref,
         error_code=p_error_code,
         retryable=p_retryable,
         actual_node_id=coalesce(p_actual_node_id,actual_node_id),
         updated_at=clock_timestamp()
   where submission_id=p_submission_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.jhadina_record_compute_submission(text,text,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.jhadina_record_compute_result(text,text,text,timestamptz,timestamptz,jsonb,text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.jhadina_record_compute_submission(text,text,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.jhadina_record_compute_result(text,text,text,timestamptz,timestamptz,jsonb,text,text,boolean,text) to service_role;
