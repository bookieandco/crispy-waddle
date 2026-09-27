-- ONE-RUNTIME.2/3: durable subsystem-neutral WorkSession tasks and cross-core event journal.
-- These tables are coordination/evidence state only. They grant no execution authority.

create unique index if not exists jhadina_work_sessions_id_owner_idx
  on public.jhadina_work_sessions(id,owner_user_id);

create table if not exists public.jhadina_work_session_tasks (
  id text not null,
  work_session_id text not null references public.jhadina_work_sessions(id) on delete cascade,
  owner_user_id uuid not null,
  parent_task_id text,
  domain text not null check (char_length(domain) between 1 and 120),
  capability text not null check (char_length(capability) between 1 and 240),
  status text not null check (status in (
    'queued','waiting-dependency','ready','running','waiting-approval',
    'retrying','paused','blocked','completed','failed','cancelled'
  )),
  authority_ref text not null,
  idempotency_key text not null,
  correlation_id text not null,
  causation_id text,
  dependency_ids jsonb not null default '[]'::jsonb,
  input_refs jsonb not null default '[]'::jsonb,
  output_refs jsonb not null default '[]'::jsonb,
  blocked_reason text,
  attempt integer not null default 0 check (attempt >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 20),
  version bigint not null default 1 check (version >= 1),
  lease_owner text,
  lease_token text,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (work_session_id,id),
  foreign key (work_session_id,owner_user_id)
    references public.jhadina_work_sessions(id,owner_user_id) on delete cascade,
  foreign key (work_session_id,parent_task_id)
    references public.jhadina_work_session_tasks(work_session_id,id)
);

create unique index if not exists jhadina_work_session_tasks_idempotency_idx
  on public.jhadina_work_session_tasks(owner_user_id,work_session_id,idempotency_key);
create index if not exists jhadina_work_session_tasks_ready_idx
  on public.jhadina_work_session_tasks(status,lease_expires_at,updated_at);
create index if not exists jhadina_work_session_tasks_owner_idx
  on public.jhadina_work_session_tasks(owner_user_id,work_session_id,updated_at desc);

alter table public.jhadina_work_session_tasks enable row level security;
revoke all on public.jhadina_work_session_tasks from anon, authenticated;
grant select, insert, update, delete on public.jhadina_work_session_tasks to service_role;
comment on table public.jhadina_work_session_tasks is
  'ONE-RUNTIME durable task graph. Lease/health/task state is coordination only and never action authority.';

create table if not exists public.jhadina_runtime_events (
  sequence_id bigint generated always as identity primary key,
  id text not null unique,
  event_type text not null,
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  work_session_id text not null references public.jhadina_work_sessions(id) on delete cascade,
  task_id text,
  correlation_id text not null,
  causation_id text,
  actor_id text,
  domain text not null,
  capability text,
  authority_ref text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  foreign key (work_session_id,task_id)
    references public.jhadina_work_session_tasks(work_session_id,id)
);

create unique index if not exists jhadina_runtime_events_idempotency_idx
  on public.jhadina_runtime_events(work_session_id,idempotency_key);
create index if not exists jhadina_runtime_events_session_sequence_idx
  on public.jhadina_runtime_events(work_session_id,sequence_id);
create index if not exists jhadina_runtime_events_correlation_idx
  on public.jhadina_runtime_events(correlation_id,sequence_id);

alter table public.jhadina_runtime_events enable row level security;
revoke all on public.jhadina_runtime_events from anon, authenticated;
grant select, insert on public.jhadina_runtime_events to service_role;
comment on table public.jhadina_runtime_events is
  'Append-only ONE-RUNTIME event journal for replay, audit lineage and cross-core coordination.';

revoke update, delete, truncate on public.jhadina_runtime_events from service_role;


-- Atomic worker lease operations. Security remains service-role-only because the
-- underlying table is not exposed to browser roles and these functions are not
-- granted to anon/authenticated.

create or replace function public.jhadina_claim_work_session_task(
  p_work_session_id text,
  p_task_id text,
  p_owner_user_id uuid,
  p_worker_id text,
  p_lease_ms integer
)
returns setof public.jhadina_work_session_tasks
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_worker_id is null or btrim(p_worker_id) = '' or p_lease_ms < 1 or p_lease_ms > 3600000 then
    raise exception 'WORK_SESSION_TASK_LEASE_INVALID';
  end if;

  return query
  update public.jhadina_work_session_tasks t
     set status = 'running',
         attempt = t.attempt + 1,
         version = t.version + 1,
         lease_owner = p_worker_id,
         lease_token = md5(random()::text || clock_timestamp()::text || t.id),
         lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_ms::double precision / 1000.0),
         updated_at = clock_timestamp()
   where t.work_session_id = p_work_session_id
     and t.id = p_task_id
     and t.owner_user_id = p_owner_user_id
     and (
       t.status in ('ready','retrying')
       or (t.status = 'running' and t.lease_expires_at is not null and t.lease_expires_at <= clock_timestamp())
     )
     and t.attempt < t.max_attempts
     and (t.lease_expires_at is null or t.lease_expires_at <= clock_timestamp() or t.lease_owner = p_worker_id)
  returning t.*;
end;
$$;

create or replace function public.jhadina_renew_work_session_task_lease(
  p_work_session_id text,
  p_task_id text,
  p_owner_user_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_lease_ms integer
)
returns setof public.jhadina_work_session_tasks
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_lease_ms < 1 or p_lease_ms > 3600000 then
    raise exception 'WORK_SESSION_TASK_LEASE_INVALID';
  end if;

  return query
  update public.jhadina_work_session_tasks t
     set version = t.version + 1,
         lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_ms::double precision / 1000.0),
         updated_at = clock_timestamp()
   where t.work_session_id = p_work_session_id
     and t.id = p_task_id
     and t.owner_user_id = p_owner_user_id
     and t.status = 'running'
     and t.lease_owner = p_worker_id
     and t.lease_token = p_lease_token
     and t.lease_expires_at > clock_timestamp()
  returning t.*;
end;
$$;

create or replace function public.jhadina_release_work_session_task_lease(
  p_work_session_id text,
  p_task_id text,
  p_owner_user_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_next_status text,
  p_blocked_reason text default null
)
returns setof public.jhadina_work_session_tasks
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_next_status not in ('waiting-approval','retrying','paused','blocked','completed','failed','cancelled') then
    raise exception 'WORK_SESSION_TASK_RELEASE_STATUS_INVALID';
  end if;
  if p_next_status = 'blocked' and (p_blocked_reason is null or btrim(p_blocked_reason) = '') then
    raise exception 'WORK_SESSION_TASK_BLOCK_REASON_REQUIRED';
  end if;

  return query
  update public.jhadina_work_session_tasks t
     set status = p_next_status,
         blocked_reason = case when p_next_status = 'blocked' then p_blocked_reason else null end,
         version = t.version + 1,
         lease_owner = null,
         lease_token = null,
         lease_expires_at = null,
         updated_at = clock_timestamp()
   where t.work_session_id = p_work_session_id
     and t.id = p_task_id
     and t.owner_user_id = p_owner_user_id
     and t.status = 'running'
     and t.lease_owner = p_worker_id
     and t.lease_token = p_lease_token
     and t.lease_expires_at > clock_timestamp()
  returning t.*;
end;
$$;

revoke all on function public.jhadina_claim_work_session_task(text,text,uuid,text,integer) from public, anon, authenticated;
revoke all on function public.jhadina_renew_work_session_task_lease(text,text,uuid,text,text,integer) from public, anon, authenticated;
revoke all on function public.jhadina_release_work_session_task_lease(text,text,uuid,text,text,text,text) from public, anon, authenticated;

grant execute on function public.jhadina_claim_work_session_task(text,text,uuid,text,integer) to service_role;
grant execute on function public.jhadina_renew_work_session_task_lease(text,text,uuid,text,text,integer) to service_role;
grant execute on function public.jhadina_release_work_session_task_lease(text,text,uuid,text,text,text,text) to service_role;


-- Durable replay checkpoints for at-least-once cross-core consumers.
create table if not exists public.jhadina_runtime_event_checkpoints (
  consumer_id text not null check (char_length(consumer_id) between 1 and 240),
  work_session_id text not null references public.jhadina_work_sessions(id) on delete cascade,
  last_sequence bigint not null default 0 check (last_sequence >= 0),
  updated_at timestamptz not null default now(),
  primary key (consumer_id,work_session_id)
);

alter table public.jhadina_runtime_event_checkpoints enable row level security;
revoke all on public.jhadina_runtime_event_checkpoints from anon, authenticated;
grant select, insert, update on public.jhadina_runtime_event_checkpoints to service_role;
revoke delete, truncate on public.jhadina_runtime_event_checkpoints from service_role;

comment on table public.jhadina_runtime_event_checkpoints is
  'ONE-RUNTIME per-consumer replay checkpoint. Checkpoints coordinate delivery only and grant no action authority.';

create or replace function public.jhadina_read_runtime_events_after(
  p_work_session_id text,
  p_after_sequence bigint,
  p_limit integer
)
returns setof public.jhadina_runtime_events
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_after_sequence < 0 or p_limit < 1 or p_limit > 500 then
    raise exception 'RUNTIME_EVENT_REPLAY_REQUEST_INVALID';
  end if;

  return query
  select e.*
    from public.jhadina_runtime_events e
   where e.work_session_id = p_work_session_id
     and e.sequence_id > p_after_sequence
   order by e.sequence_id asc
   limit p_limit;
end;
$$;

create or replace function public.jhadina_get_runtime_event_checkpoint(
  p_consumer_id text,
  p_work_session_id text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sequence bigint;
begin
  if p_consumer_id is null or btrim(p_consumer_id) = '' or p_work_session_id is null or btrim(p_work_session_id) = '' then
    raise exception 'RUNTIME_EVENT_CHECKPOINT_IDENTITY_REQUIRED';
  end if;

  insert into public.jhadina_runtime_event_checkpoints(consumer_id,work_session_id,last_sequence)
  values (p_consumer_id,p_work_session_id,0)
  on conflict (consumer_id,work_session_id) do nothing;

  select c.last_sequence into v_sequence
    from public.jhadina_runtime_event_checkpoints c
   where c.consumer_id = p_consumer_id
     and c.work_session_id = p_work_session_id;

  return coalesce(v_sequence,0);
end;
$$;

create or replace function public.jhadina_advance_runtime_event_checkpoint(
  p_consumer_id text,
  p_work_session_id text,
  p_expected_sequence bigint,
  p_next_sequence bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_consumer_id is null or btrim(p_consumer_id) = '' or p_work_session_id is null or btrim(p_work_session_id) = '' then
    raise exception 'RUNTIME_EVENT_CHECKPOINT_IDENTITY_REQUIRED';
  end if;
  if p_expected_sequence < 0 or p_next_sequence < p_expected_sequence then
    raise exception 'RUNTIME_EVENT_CHECKPOINT_INVALID';
  end if;
  if p_next_sequence > 0 and not exists (
    select 1 from public.jhadina_runtime_events e
     where e.work_session_id = p_work_session_id
       and e.sequence_id = p_next_sequence
  ) then
    raise exception 'RUNTIME_EVENT_CHECKPOINT_EVENT_NOT_FOUND';
  end if;

  insert into public.jhadina_runtime_event_checkpoints(consumer_id,work_session_id,last_sequence)
  values (p_consumer_id,p_work_session_id,0)
  on conflict (consumer_id,work_session_id) do nothing;

  update public.jhadina_runtime_event_checkpoints c
     set last_sequence = p_next_sequence,
         updated_at = clock_timestamp()
   where c.consumer_id = p_consumer_id
     and c.work_session_id = p_work_session_id
     and c.last_sequence = p_expected_sequence;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.jhadina_read_runtime_events_after(text,bigint,integer) from public, anon, authenticated;
revoke all on function public.jhadina_get_runtime_event_checkpoint(text,text) from public, anon, authenticated;
revoke all on function public.jhadina_advance_runtime_event_checkpoint(text,text,bigint,bigint) from public, anon, authenticated;

grant execute on function public.jhadina_read_runtime_events_after(text,bigint,integer) to service_role;
grant execute on function public.jhadina_get_runtime_event_checkpoint(text,text) to service_role;
grant execute on function public.jhadina_advance_runtime_event_checkpoint(text,text,bigint,bigint) to service_role;
