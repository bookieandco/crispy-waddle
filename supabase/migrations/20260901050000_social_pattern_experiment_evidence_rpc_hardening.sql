-- Harden durable experiment evidence ingestion against conflicting replay.
-- execution_id is the immutable execution identity: an existing execution may
-- be replayed only when every evidence field is byte-for-byte equivalent after
-- the database's canonical type conversion.

create or replace function public.insert_social_pattern_experiment_evidence(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.growth_social_pattern_experiment_evidence%rowtype;
begin
  if payload is null then
    raise exception 'evidence payload is required';
  end if;

  if nullif(trim(payload->>'execution_id'), '') is null
     or nullif(trim(payload->>'experiment_id'), '') is null
     or nullif(trim(payload->>'hypothesis_id'), '') is null
     or nullif(trim(payload->>'target_account_id'), '') is null
     or nullif(trim(payload->>'target_audience_id'), '') is null
     or nullif(trim(payload->>'target_voice_id'), '') is null
     or nullif(trim(payload->>'success_metric'), '') is null
     or nullif(trim(payload->>'control_metric'), '') is null
     or nullif(trim(payload->>'treatment_metric'), '') is null
     or nullif(trim(payload->>'control_observations'), '') is null
     or nullif(trim(payload->>'treatment_observations'), '') is null
     or nullif(trim(payload->>'observed_at'), '') is null then
    raise exception 'evidence payload is missing required fields';
  end if;

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

  select * into existing
  from public.growth_social_pattern_experiment_evidence
  where execution_id = payload->>'execution_id';

  if existing.experiment_id is distinct from payload->>'experiment_id'
     or existing.hypothesis_id is distinct from payload->>'hypothesis_id'
     or existing.target_account_id is distinct from payload->>'target_account_id'
     or existing.target_audience_id is distinct from payload->>'target_audience_id'
     or existing.target_voice_id is distinct from payload->>'target_voice_id'
     or existing.success_metric is distinct from payload->>'success_metric'
     or existing.control_metric is distinct from (payload->>'control_metric')::numeric
     or existing.treatment_metric is distinct from (payload->>'treatment_metric')::numeric
     or existing.control_observations is distinct from (payload->>'control_observations')::integer
     or existing.treatment_observations is distinct from (payload->>'treatment_observations')::integer
     or existing.observed_at is distinct from (payload->>'observed_at')::timestamptz
     or existing.source is distinct from 'experiment-execution' then
    raise exception 'experiment evidence replay conflicts with immutable execution %', payload->>'execution_id';
  end if;
end;
$$;

revoke all on function public.insert_social_pattern_experiment_evidence(jsonb) from public, anon, authenticated;
grant execute on function public.insert_social_pattern_experiment_evidence(jsonb) to service_role;
