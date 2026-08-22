create table if not exists public.jhadina_mining_decisions (
  decision_id text primary key,
  resource_id text not null,
  decision text not null check (decision in ('run','do_not_run','insufficient_data')),
  observed_at timestamptz not null,
  projected_gross_per_hour numeric,
  projected_electricity_per_hour numeric,
  projected_net_per_hour numeric,
  health text not null check (health in ('healthy','degraded','offline','unknown')),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  reasons jsonb not null default '[]'::jsonb,
  policy_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_jhadina_mining_decisions_resource_observed
  on public.jhadina_mining_decisions (resource_id, observed_at desc);

alter table public.jhadina_mining_decisions enable row level security;

create policy jhadina_mining_decisions_service_role_only
  on public.jhadina_mining_decisions
  for all
  to service_role
  using (true)
  with check (true);
