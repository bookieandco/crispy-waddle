-- JLLM-RUNTIME.FINAL: durable WorkSession envelope.
-- Service-role governed path only. A session is context, never execution authority.
create table if not exists public.jhadina_work_sessions (
  id text primary key,
  owner_user_id uuid not null,
  goal text not null check (char_length(goal) between 1 and 4000),
  status text not null check (status in ('active','waiting-approval','completed','abandoned')),
  active_subsystems jsonb not null default '[]'::jsonb,
  artifact_refs jsonb not null default '[]'::jsonb,
  decision_refs jsonb not null default '[]'::jsonb,
  output_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.jhadina_work_sessions enable row level security;
revoke all on public.jhadina_work_sessions from anon, authenticated;
grant select, insert, update, delete on public.jhadina_work_sessions to service_role;
comment on table public.jhadina_work_sessions is 'Durable Jhadina task/session context. Contains references and continuity only; grants no subsystem execution authority.';
create index if not exists jhadina_work_sessions_owner_updated_idx on public.jhadina_work_sessions(owner_user_id,updated_at desc);
