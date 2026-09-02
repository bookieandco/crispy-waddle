create table if not exists public.jhadina_launch_outcome_observations (
  observation_id text primary key,
  launch_id text not null references public.jhadina_token_launches(launch_id) on delete cascade,
  observed_at timestamptz not null,
  price_return_from_launch_pct numeric,
  peak_return_pct numeric,
  max_drawdown_pct numeric,
  initial_liquidity_usd numeric,
  current_liquidity_usd numeric,
  peak_liquidity_usd numeric,
  liquidity_drawdown_from_peak numeric,
  liquidity_drain_rate numeric,
  liquidity_drain_acceleration numeric,
  liquidity_stability_score numeric,
  holder_count_change_pct numeric,
  holder_exit_pct numeric,
  developer_sold_pct numeric,
  liquidity_removed boolean,
  trading_halted boolean,
  holder_behavior text,
  evidence_ids text[] not null default '{}',
  source text not null,
  created_at timestamptz not null default now(),
  constraint jhadina_launch_outcome_observation_holder_behavior_check
    check (holder_behavior is null or holder_behavior in ('ACCUMULATING','STABLE','DISTRIBUTING','PANIC_EXIT'))
);

create index if not exists jhadina_launch_outcome_obs_launch_observed_idx
  on public.jhadina_launch_outcome_observations (launch_id, observed_at desc);

create table if not exists public.jhadina_actor_outcome_history (
  actor_key text primary key,
  actor_id text not null,
  actor_kind text not null,
  launches integer not null default 0,
  healthy_launches integer not null default 0,
  bad_launches integer not null default 0,
  failed_launches integer not null default 0,
  rug_rate numeric not null default 0,
  pump_and_dump_rate numeric not null default 0,
  outcome_coverage numeric not null default 0,
  confidence numeric not null default 0,
  association_confidence numeric not null default 0,
  evidence_ids text[] not null default '{}',
  evaluated_at timestamptz not null,
  evaluator_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jhadina_actor_outcome_history_kind_check
    check (actor_kind in ('wallet','developer','cluster')),
  constraint jhadina_actor_outcome_history_rates_check
    check (rug_rate between 0 and 1 and pump_and_dump_rate between 0 and 1 and outcome_coverage between 0 and 1 and confidence between 0 and 1 and association_confidence between 0 and 1)
);

create index if not exists jhadina_actor_outcome_history_actor_idx
  on public.jhadina_actor_outcome_history (actor_kind, actor_id);

create table if not exists public.jhadina_launch_outcome_evaluations (
  evaluation_id text primary key,
  launch_id text not null references public.jhadina_token_launches(launch_id) on delete cascade,
  previous_outcome text not null,
  evaluated_outcome text not null,
  confidence numeric not null,
  evaluated_at timestamptz not null,
  evaluator_version text not null,
  evidence_ids text[] not null default '{}',
  reasons text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint jhadina_launch_outcome_evaluation_outcome_check
    check (evaluated_outcome in ('UNKNOWN','HEALTHY','RUG','FAILED','PUMP_AND_DUMP')),
  constraint jhadina_launch_outcome_evaluation_confidence_check
    check (confidence between 0 and 1)
);

create index if not exists jhadina_launch_outcome_evaluations_launch_idx
  on public.jhadina_launch_outcome_evaluations (launch_id, evaluated_at desc);

alter table public.jhadina_launch_outcome_observations enable row level security;
alter table public.jhadina_actor_outcome_history enable row level security;
alter table public.jhadina_launch_outcome_evaluations enable row level security;

drop policy if exists jhadina_launch_outcome_observations_select_authenticated on public.jhadina_launch_outcome_observations;
create policy jhadina_launch_outcome_observations_select_authenticated
  on public.jhadina_launch_outcome_observations for select
  to authenticated using (true);

drop policy if exists jhadina_actor_outcome_history_select_authenticated on public.jhadina_actor_outcome_history;
create policy jhadina_actor_outcome_history_select_authenticated
  on public.jhadina_actor_outcome_history for select
  to authenticated using (true);

drop policy if exists jhadina_launch_outcome_evaluations_select_authenticated on public.jhadina_launch_outcome_evaluations;
create policy jhadina_launch_outcome_evaluations_select_authenticated
  on public.jhadina_launch_outcome_evaluations for select
  to authenticated using (true);

-- Writes are service-role/worker only. No client policy grants INSERT/UPDATE/DELETE.
