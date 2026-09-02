create extension if not exists pgcrypto;

create table if not exists public.jhadina_agent_runs (
  id text primary key,
  objective text not null,
  status text not null check (status in ('planning','awaiting_policy','executing','awaiting_approval','replanning','completed','failed','cancelled')),
  plan_revision integer not null default 0 check (plan_revision >= 0),
  current_step_id text,
  policy_decision_id text,
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.jhadina_agent_plans (
  id text primary key,
  run_id text not null references public.jhadina_agent_runs(id) on delete cascade,
  revision integer not null check (revision > 0),
  objective text not null,
  rationale text not null,
  steps jsonb not null,
  supersedes_plan_id text references public.jhadina_agent_plans(id),
  created_at timestamptz not null,
  unique (run_id, revision)
);

create table if not exists public.jhadina_agent_steps (
  id text primary key,
  run_id text not null references public.jhadina_agent_runs(id) on delete cascade,
  plan_id text not null references public.jhadina_agent_plans(id) on delete restrict,
  plan_revision integer not null check (plan_revision > 0),
  ordinal integer not null check (ordinal > 0),
  kind text not null check (kind in ('plan','execute','observe','replan','approval')),
  status text not null check (status in ('pending','running','completed','failed','skipped')),
  capability text,
  operation text,
  input jsonb,
  output jsonb,
  error text,
  policy_decision_id text,
  attempt integer not null default 1 check (attempt > 0),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists jhadina_agent_steps_run_idx
  on public.jhadina_agent_steps (run_id, plan_revision, ordinal);

create table if not exists public.jhadina_agent_checkpoints (
  id text primary key,
  run_id text not null references public.jhadina_agent_runs(id) on delete cascade,
  step_id text,
  plan_id text,
  plan_revision integer not null default 0 check (plan_revision >= 0),
  reason text not null check (reason in ('created','step-completed','awaiting-policy','awaiting-approval','replan','terminal','recovery')),
  state jsonb not null,
  created_at timestamptz not null
);

create index if not exists jhadina_agent_checkpoints_run_idx
  on public.jhadina_agent_checkpoints (run_id, created_at desc);

create table if not exists public.jhadina_agent_policy_decisions (
  id text primary key,
  run_id text not null references public.jhadina_agent_runs(id) on delete cascade,
  step_id text,
  allowed boolean not null,
  required_approval boolean not null,
  reason text not null,
  evaluated_at timestamptz not null
);

alter table public.jhadina_agent_runs enable row level security;
alter table public.jhadina_agent_plans enable row level security;
alter table public.jhadina_agent_steps enable row level security;
alter table public.jhadina_agent_checkpoints enable row level security;
alter table public.jhadina_agent_policy_decisions enable row level security;

revoke all on public.jhadina_agent_runs from public, anon, authenticated;
revoke all on public.jhadina_agent_plans from public, anon, authenticated;
revoke all on public.jhadina_agent_steps from public, anon, authenticated;
revoke all on public.jhadina_agent_checkpoints from public, anon, authenticated;
revoke all on public.jhadina_agent_policy_decisions from public, anon, authenticated;

grant select, insert, update, delete on public.jhadina_agent_runs to service_role;
grant select, insert, update, delete on public.jhadina_agent_plans to service_role;
grant select, insert, update, delete on public.jhadina_agent_steps to service_role;
grant select, insert, update, delete on public.jhadina_agent_checkpoints to service_role;
grant select, insert, update, delete on public.jhadina_agent_policy_decisions to service_role;

create or replace function public.update_jhadina_agent_run(
  p_id text,
  p_expected_version integer,
  p_objective text,
  p_status text,
  p_plan_revision integer,
  p_current_step_id text,
  p_policy_decision_id text,
  p_updated_at timestamptz
)
returns public.jhadina_agent_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.jhadina_agent_runs;
begin
  update public.jhadina_agent_runs
     set objective = p_objective,
         status = p_status,
         plan_revision = p_plan_revision,
         current_step_id = p_current_step_id,
         policy_decision_id = p_policy_decision_id,
         updated_at = p_updated_at,
         version = version + 1
   where id = p_id and version = p_expected_version
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.update_jhadina_agent_run(text, integer, text, text, integer, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.update_jhadina_agent_run(text, integer, text, text, integer, text, text, timestamptz) to service_role;
