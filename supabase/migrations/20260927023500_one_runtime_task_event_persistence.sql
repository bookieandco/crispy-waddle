-- ONE-RUNTIME.2/3: durable subsystem-neutral WorkSession tasks and cross-core event journal.
-- These tables are coordination/evidence state only. They grant no execution authority.

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
  primary key (work_session_id,id)
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
  created_at timestamptz not null default now()
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
