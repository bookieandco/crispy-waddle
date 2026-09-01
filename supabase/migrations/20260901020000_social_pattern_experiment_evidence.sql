-- Durable execution evidence for social pattern experiments.
-- This table records the upstream execution batch used for evaluation.
-- It is service-role-only until the Jhadina identity boundary is production-ready.

create table if not exists public.growth_social_pattern_experiment_evidence (
  execution_id text primary key,
  experiment_id text not null,
  hypothesis_id text not null,
  target_account_id text not null,
  target_audience_id text not null,
  target_voice_id text not null,
  success_metric text not null check (success_metric in ('qualified_leads', 'conversions', 'conversation_rate')),
  control_metric numeric not null check (control_metric >= 0 and control_metric <= 1),
  treatment_metric numeric not null check (treatment_metric >= 0 and treatment_metric <= 1),
  control_observations integer not null check (control_observations > 0),
  treatment_observations integer not null check (treatment_observations > 0),
  observed_at timestamptz not null,
  source text not null check (source = 'experiment-execution'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growth_social_pattern_experiment_evidence_experiment_idx
  on public.growth_social_pattern_experiment_evidence (experiment_id, observed_at desc);

alter table public.growth_social_pattern_experiment_evidence enable row level security;

revoke all on table public.growth_social_pattern_experiment_evidence from anon, authenticated;

create or replace function public.insert_social_pattern_experiment_evidence(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.growth_social_pattern_experiment_evidence (
    execution_id, experiment_id, hypothesis_id, target_account_id,
    target_audience_id, target_voice_id, success_metric,
    control_metric, treatment_metric, control_observations,
    treatment_observations, observed_at, source
  ) values (
    payload->>'execution_id', payload->>'experiment_id', payload->>'hypothesis_id',
    payload->>'target_account_id', payload->>'target_audience_id', payload->>'target_voice_id',
    payload->>'success_metric', (payload->>'control_metric')::numeric,
    (payload->>'treatment_metric')::numeric, (payload->>'control_observations')::integer,
    (payload->>'treatment_observations')::integer, (payload->>'observed_at')::timestamptz,
    'experiment-execution'
  )
  on conflict (execution_id) do nothing;
end;
$$;

revoke all on function public.insert_social_pattern_experiment_evidence(jsonb) from public, anon, authenticated;
