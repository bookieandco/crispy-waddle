-- MEME-AUTO durable research runtime.
-- Append-only assessment and external-source outcome evidence.
-- These stores carry no trade, signing, capital, or execution authority.

create table if not exists public.jhadina_shark_meme_trade_assessments (
  assessment_id text primary key,
  chain_id text not null,
  token_address text not null,
  assessed_at timestamptz not null,
  information_cutoff timestamptz not null,
  risk_band text not null check (risk_band in ('candidate','watch','high-risk','blocked')),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  evidence_ids text[] not null check (cardinality(evidence_ids) > 0),
  source text not null check (length(btrim(source)) > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  constraint jhadina_shark_meme_assessment_cutoff_check check (information_cutoff <= assessed_at)
);

create index if not exists jhadina_shark_meme_assessment_token_idx
  on public.jhadina_shark_meme_trade_assessments (chain_id, token_address, information_cutoff, assessment_id);

create table if not exists public.jhadina_shark_external_signal_outcomes (
  outcome_id text primary key,
  platform text not null,
  source_handle text not null,
  channel_id text null,
  signal_observation_id text not null,
  token_candidate text not null,
  observed_at timestamptz not null,
  resolved_at timestamptz not null,
  evidence_ids text[] not null check (cardinality(evidence_ids) > 0),
  source text not null check (length(btrim(source)) > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  constraint jhadina_shark_external_signal_outcome_clock_check check (resolved_at >= observed_at)
);

create index if not exists jhadina_shark_external_signal_source_idx
  on public.jhadina_shark_external_signal_outcomes (platform, source_handle, channel_id, resolved_at, outcome_id);

alter table public.jhadina_shark_meme_trade_assessments enable row level security;
alter table public.jhadina_shark_external_signal_outcomes enable row level security;

revoke all on public.jhadina_shark_meme_trade_assessments from public, anon, authenticated;
revoke all on public.jhadina_shark_external_signal_outcomes from public, anon, authenticated;

grant select, insert on public.jhadina_shark_meme_trade_assessments to service_role;
grant select, insert on public.jhadina_shark_external_signal_outcomes to service_role;

revoke update, delete on public.jhadina_shark_meme_trade_assessments from service_role;
revoke update, delete on public.jhadina_shark_external_signal_outcomes from service_role;

create or replace function public.jhadina_shark_append_meme_trade_assessment(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing jsonb;
begin
  insert into public.jhadina_shark_meme_trade_assessments (
    assessment_id, chain_id, token_address, assessed_at, information_cutoff,
    risk_band, confidence, evidence_ids, source, payload
  ) values (
    p_payload->>'assessmentId',
    p_payload->>'chainId',
    p_payload->>'tokenAddress',
    (p_payload->>'assessedAt')::timestamptz,
    (p_payload->>'informationCutoff')::timestamptz,
    p_payload->>'riskBand',
    (p_payload->>'confidence')::numeric,
    array(select jsonb_array_elements_text(coalesce(p_payload->'evidenceIds','[]'::jsonb))),
    p_payload->>'source',
    p_payload
  )
  on conflict (assessment_id) do nothing;

  if found then return 'INSERTED'; end if;
  select payload into v_existing
    from public.jhadina_shark_meme_trade_assessments
    where assessment_id = p_payload->>'assessmentId';
  if v_existing = p_payload then return 'REPLAY'; end if;
  raise exception 'shark_meme_trade_assessment_conflict';
end;
$$;

create or replace function public.jhadina_shark_append_external_signal_outcome(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing jsonb;
begin
  insert into public.jhadina_shark_external_signal_outcomes (
    outcome_id, platform, source_handle, channel_id, signal_observation_id,
    token_candidate, observed_at, resolved_at, evidence_ids, source, payload
  ) values (
    p_payload->>'outcomeId',
    p_payload->>'platform',
    p_payload->>'sourceHandle',
    nullif(p_payload->>'channelId',''),
    p_payload->>'signalObservationId',
    p_payload->>'tokenCandidate',
    (p_payload->>'observedAt')::timestamptz,
    (p_payload->>'resolvedAt')::timestamptz,
    array(select jsonb_array_elements_text(coalesce(p_payload->'evidenceIds','[]'::jsonb))),
    p_payload->>'source',
    p_payload
  )
  on conflict (outcome_id) do nothing;

  if found then return 'INSERTED'; end if;
  select payload into v_existing
    from public.jhadina_shark_external_signal_outcomes
    where outcome_id = p_payload->>'outcomeId';
  if v_existing = p_payload then return 'REPLAY'; end if;
  raise exception 'shark_external_signal_outcome_conflict';
end;
$$;

revoke all on function public.jhadina_shark_append_meme_trade_assessment(jsonb) from public, anon, authenticated;
revoke all on function public.jhadina_shark_append_external_signal_outcome(jsonb) from public, anon, authenticated;

grant execute on function public.jhadina_shark_append_meme_trade_assessment(jsonb) to service_role;
grant execute on function public.jhadina_shark_append_external_signal_outcome(jsonb) to service_role;
