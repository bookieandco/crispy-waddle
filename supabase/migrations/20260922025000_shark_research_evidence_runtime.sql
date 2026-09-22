-- SHARK-CONVERGE.8 — durable research evidence admission.
-- These tables are append-only evidence stores. They do not store a selected
-- production threshold, trading decision, capital authority, or execution intent.

create table if not exists public.jhadina_shark_wallet_cluster_calibration_observations (
  observation_id text primary key,
  token_id text not null,
  distinct_wallets integer not null check (distinct_wallets > 0),
  window_seconds integer not null check (window_seconds >= 0),
  aggregate_wallet_score numeric not null check (aggregate_wallet_score >= 0),
  total_usd numeric null check (total_usd is null or total_usd >= 0),
  observed_at timestamptz not null,
  available_at timestamptz not null,
  outcome text not null check (outcome in ('HEALTHY','ADVERSE','UNKNOWN')),
  evidence_ids text[] not null check (cardinality(evidence_ids) > 0),
  source text not null check (length(btrim(source)) > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  constraint jhadina_shark_cluster_availability_check check (available_at >= observed_at)
);

create index if not exists jhadina_shark_cluster_calibration_available_idx
  on public.jhadina_shark_wallet_cluster_calibration_observations (available_at, observation_id);

create table if not exists public.jhadina_shark_meteora_cash_flow_evidence (
  evidence_id text primary key,
  transaction_id text not null,
  position text not null,
  kind text not null check (kind in ('DEPOSIT','WITHDRAWAL','FEE')),
  amount_minor numeric(78,0) not null check (amount_minor >= 0),
  currency text not null,
  amount_semantics text not null check (amount_semantics in ('NATIVE_TRANSFER','VERIFIED_VALUATION')),
  valuation_evidence_ids text[] not null default '{}',
  observed_at timestamptz not null,
  available_at timestamptz not null,
  source text not null check (length(btrim(source)) > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  constraint jhadina_shark_meteora_cash_flow_availability_check check (available_at >= observed_at),
  constraint jhadina_shark_meteora_cash_flow_valuation_check check (
    (amount_semantics = 'VERIFIED_VALUATION' and cardinality(valuation_evidence_ids) > 0)
    or
    (amount_semantics = 'NATIVE_TRANSFER' and cardinality(valuation_evidence_ids) = 0)
  )
);

create index if not exists jhadina_shark_meteora_cash_flow_position_idx
  on public.jhadina_shark_meteora_cash_flow_evidence (position, currency, available_at, evidence_id);

create table if not exists public.jhadina_shark_meteora_position_state_evidence (
  state_id text primary key,
  position text not null,
  currency text not null,
  position_closed boolean not null,
  transaction_history_complete boolean not null,
  observed_at timestamptz not null,
  available_at timestamptz not null,
  evidence_ids text[] not null check (cardinality(evidence_ids) > 0),
  source text not null check (length(btrim(source)) > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  constraint jhadina_shark_meteora_position_state_availability_check check (available_at >= observed_at)
);

create index if not exists jhadina_shark_meteora_position_state_idx
  on public.jhadina_shark_meteora_position_state_evidence (position, currency, available_at desc, state_id);

alter table public.jhadina_shark_wallet_cluster_calibration_observations enable row level security;
alter table public.jhadina_shark_meteora_cash_flow_evidence enable row level security;
alter table public.jhadina_shark_meteora_position_state_evidence enable row level security;

revoke all on public.jhadina_shark_wallet_cluster_calibration_observations from public, anon, authenticated;
revoke all on public.jhadina_shark_meteora_cash_flow_evidence from public, anon, authenticated;
revoke all on public.jhadina_shark_meteora_position_state_evidence from public, anon, authenticated;

grant select, insert on public.jhadina_shark_wallet_cluster_calibration_observations to service_role;
grant select, insert on public.jhadina_shark_meteora_cash_flow_evidence to service_role;
grant select, insert on public.jhadina_shark_meteora_position_state_evidence to service_role;

revoke update, delete on public.jhadina_shark_wallet_cluster_calibration_observations from service_role;
revoke update, delete on public.jhadina_shark_meteora_cash_flow_evidence from service_role;
revoke update, delete on public.jhadina_shark_meteora_position_state_evidence from service_role;

create or replace function public.jhadina_shark_append_cluster_calibration_observation(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing jsonb;
begin
  insert into public.jhadina_shark_wallet_cluster_calibration_observations (
    observation_id, token_id, distinct_wallets, window_seconds, aggregate_wallet_score,
    total_usd, observed_at, available_at, outcome, evidence_ids, source, payload
  ) values (
    p_payload->>'observationId',
    p_payload->>'tokenId',
    (p_payload->>'distinctWallets')::integer,
    (p_payload->>'windowSeconds')::integer,
    (p_payload->>'aggregateWalletScore')::numeric,
    nullif(p_payload->>'totalUsd','')::numeric,
    (p_payload->>'observedAt')::timestamptz,
    (p_payload->>'availableAt')::timestamptz,
    p_payload->>'outcome',
    array(select jsonb_array_elements_text(coalesce(p_payload->'evidenceIds','[]'::jsonb))),
    p_payload->>'source',
    p_payload
  )
  on conflict (observation_id) do nothing;

  if found then return 'INSERTED'; end if;
  select payload into v_existing
    from public.jhadina_shark_wallet_cluster_calibration_observations
    where observation_id = p_payload->>'observationId';
  if v_existing = p_payload then return 'REPLAY'; end if;
  raise exception 'shark_cluster_calibration_observation_conflict';
end;
$$;

create or replace function public.jhadina_shark_append_meteora_cash_flow(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing jsonb;
begin
  insert into public.jhadina_shark_meteora_cash_flow_evidence (
    evidence_id, transaction_id, position, kind, amount_minor, currency,
    amount_semantics, valuation_evidence_ids, observed_at, available_at, source, payload
  ) values (
    p_payload->>'evidenceId',
    p_payload->>'transactionId',
    p_payload->>'position',
    p_payload->>'kind',
    (p_payload->>'amountMinor')::numeric,
    p_payload->>'currency',
    p_payload->>'amountSemantics',
    array(select jsonb_array_elements_text(coalesce(p_payload->'valuationEvidenceIds','[]'::jsonb))),
    (p_payload->>'observedAt')::timestamptz,
    (p_payload->>'availableAt')::timestamptz,
    p_payload->>'source',
    p_payload
  )
  on conflict (evidence_id) do nothing;

  if found then return 'INSERTED'; end if;
  select payload into v_existing
    from public.jhadina_shark_meteora_cash_flow_evidence
    where evidence_id = p_payload->>'evidenceId';
  if v_existing = p_payload then return 'REPLAY'; end if;
  raise exception 'shark_meteora_cash_flow_conflict';
end;
$$;

create or replace function public.jhadina_shark_append_meteora_position_state(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing jsonb;
begin
  insert into public.jhadina_shark_meteora_position_state_evidence (
    state_id, position, currency, position_closed, transaction_history_complete,
    observed_at, available_at, evidence_ids, source, payload
  ) values (
    p_payload->>'stateId',
    p_payload->>'position',
    p_payload->>'currency',
    (p_payload->>'positionClosed')::boolean,
    (p_payload->>'transactionHistoryComplete')::boolean,
    (p_payload->>'observedAt')::timestamptz,
    (p_payload->>'availableAt')::timestamptz,
    array(select jsonb_array_elements_text(coalesce(p_payload->'evidenceIds','[]'::jsonb))),
    p_payload->>'source',
    p_payload
  )
  on conflict (state_id) do nothing;

  if found then return 'INSERTED'; end if;
  select payload into v_existing
    from public.jhadina_shark_meteora_position_state_evidence
    where state_id = p_payload->>'stateId';
  if v_existing = p_payload then return 'REPLAY'; end if;
  raise exception 'shark_meteora_position_state_conflict';
end;
$$;

revoke all on function public.jhadina_shark_append_cluster_calibration_observation(jsonb) from public, anon, authenticated;
revoke all on function public.jhadina_shark_append_meteora_cash_flow(jsonb) from public, anon, authenticated;
revoke all on function public.jhadina_shark_append_meteora_position_state(jsonb) from public, anon, authenticated;

grant execute on function public.jhadina_shark_append_cluster_calibration_observation(jsonb) to service_role;
grant execute on function public.jhadina_shark_append_meteora_cash_flow(jsonb) to service_role;
grant execute on function public.jhadina_shark_append_meteora_position_state(jsonb) to service_role;
