-- MEME-AUTO.2 — append-only Pump lifecycle evidence.
-- Records read-only bonding-curve/pool observations. No execution authority.

create table if not exists public.jhadina_shark_pump_lifecycle_observations (
  observation_id text primary key,
  launch_id text not null references public.jhadina_token_launches(launch_id) on delete cascade,
  mint text not null,
  bonding_curve_address text,
  quote_mint text,
  stage text not null check (stage in ('DISCOVERED','APPROACHING_GRADUATION','CURVE_COMPLETE','PUMPSWAP_MIGRATED')),
  graduation_progress numeric null check (graduation_progress is null or (graduation_progress >= 0 and graduation_progress <= 1)),
  real_token_reserves numeric(78,0),
  initial_real_token_reserves numeric(78,0),
  curve_complete boolean,
  mayhem_mode boolean,
  pumpswap_pool_address text,
  pumpswap_pool_verified boolean,
  observed_at timestamptz not null,
  available_at timestamptz not null,
  evidence_ids text[] not null check (cardinality(evidence_ids) > 0),
  source text not null check (length(btrim(source)) > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  constraint jhadina_shark_pump_lifecycle_clock_check check (available_at >= observed_at)
);

create index if not exists jhadina_shark_pump_lifecycle_launch_idx
  on public.jhadina_shark_pump_lifecycle_observations (launch_id, available_at desc, observation_id);

create index if not exists jhadina_shark_pump_lifecycle_mint_idx
  on public.jhadina_shark_pump_lifecycle_observations (mint, available_at desc, observation_id);

alter table public.jhadina_shark_pump_lifecycle_observations enable row level security;

revoke all on public.jhadina_shark_pump_lifecycle_observations from public, anon, authenticated;
grant select, insert on public.jhadina_shark_pump_lifecycle_observations to service_role;
revoke update, delete on public.jhadina_shark_pump_lifecycle_observations from service_role;

create or replace function public.jhadina_shark_append_pump_lifecycle_observation(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing jsonb;
begin
  insert into public.jhadina_shark_pump_lifecycle_observations (
    observation_id, launch_id, mint, bonding_curve_address, quote_mint, stage,
    graduation_progress, real_token_reserves, initial_real_token_reserves,
    curve_complete, mayhem_mode, pumpswap_pool_address, pumpswap_pool_verified,
    observed_at, available_at, evidence_ids, source, payload
  ) values (
    p_payload->>'observationId',
    p_payload->>'launchId',
    p_payload->>'mint',
    nullif(p_payload->>'bondingCurveAddress',''),
    nullif(p_payload->>'quoteMint',''),
    p_payload->>'stage',
    nullif(p_payload->>'graduationProgress','')::numeric,
    nullif(p_payload->>'realTokenReserves','')::numeric,
    nullif(p_payload->>'initialRealTokenReserves','')::numeric,
    case when p_payload ? 'complete' and p_payload->'complete' <> 'null'::jsonb then (p_payload->>'complete')::boolean else null end,
    case when p_payload ? 'mayhemMode' and p_payload->'mayhemMode' <> 'null'::jsonb then (p_payload->>'mayhemMode')::boolean else null end,
    nullif(p_payload->>'pumpSwapPoolAddress',''),
    case when p_payload ? 'pumpSwapPoolVerified' and p_payload->'pumpSwapPoolVerified' <> 'null'::jsonb then (p_payload->>'pumpSwapPoolVerified')::boolean else null end,
    (p_payload->>'observedAt')::timestamptz,
    (p_payload->>'availableAt')::timestamptz,
    array(select jsonb_array_elements_text(coalesce(p_payload->'evidenceIds','[]'::jsonb))),
    p_payload->>'source',
    p_payload
  )
  on conflict (observation_id) do nothing;

  if found then return 'INSERTED'; end if;
  select payload into v_existing
    from public.jhadina_shark_pump_lifecycle_observations
    where observation_id = p_payload->>'observationId';
  if v_existing = p_payload then return 'REPLAY'; end if;
  raise exception 'shark_pump_lifecycle_observation_conflict';
end;
$$;

revoke all on function public.jhadina_shark_append_pump_lifecycle_observation(jsonb) from public, anon, authenticated;
grant execute on function public.jhadina_shark_append_pump_lifecycle_observation(jsonb) to service_role;
