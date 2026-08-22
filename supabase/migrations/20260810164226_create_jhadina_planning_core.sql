create extension if not exists pgcrypto;

create table if not exists public.jhadina_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null default 1 check (version > 0),
  plan jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jhadina_planning_proposals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.jhadina_plans(id) on delete cascade,
  description text not null,
  requested_by uuid not null references auth.users(id),
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  policy_status text not null default 'pending' check (policy_status in ('pending','allowed','denied','executed','cancelled')),
  policy_reason text,
  requested_at timestamptz not null default now(),
  evaluated_at timestamptz
);

create table if not exists public.jhadina_planning_events (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.jhadina_plans(id) on delete cascade,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists jhadina_plans_updated_at_idx on public.jhadina_plans(updated_at desc);
create index if not exists jhadina_planning_proposals_plan_id_idx on public.jhadina_planning_proposals(plan_id);
create index if not exists jhadina_planning_events_plan_id_time_idx on public.jhadina_planning_events(plan_id, occurred_at desc);

alter table public.jhadina_plans enable row level security;
alter table public.jhadina_planning_proposals enable row level security;
alter table public.jhadina_planning_events enable row level security;

create policy "jhadina_plans_owner_access" on public.jhadina_plans
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "jhadina_planning_proposals_owner_access" on public.jhadina_planning_proposals
  for all using (auth.uid() = requested_by or exists (
    select 1 from public.jhadina_plans p where p.id = plan_id and auth.uid() is not null
  )) with check (auth.uid() = requested_by);

create policy "jhadina_planning_events_owner_access" on public.jhadina_planning_events
  for all using (auth.uid() = created_by or exists (
    select 1 from public.jhadina_plans p where p.id = plan_id and auth.uid() is not null
  )) with check (auth.uid() = created_by);
