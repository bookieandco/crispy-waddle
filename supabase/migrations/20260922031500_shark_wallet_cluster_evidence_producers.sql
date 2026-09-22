-- SHARK-CONVERGE.9 — raw wallet evidence producers.
-- Score snapshots and buy observations are append-only research facts. Aggregate
-- wallet-cluster calibration rows must be derived from these stores plus canonical
-- launch outcomes; clients cannot write aggregate cluster metrics directly.

create table if not exists public.jhadina_shark_wallet_score_evidence (
  score_id text primary key,
  chain_id text not null,
  wallet_id text not null,
  score_model_id text not null,
  score numeric not null check (score >= 0),
  information_cutoff timestamptz not null,
  observed_at timestamptz not null,
  available_at timestamptz not null,
  evidence_ids text[] not null check (cardinality(evidence_ids) > 0),
  source text not null check (length(btrim(source)) > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  constraint jhadina_shark_wallet_score_time_check check (
    information_cutoff <= observed_at and observed_at <= available_at
  )
);

create index if not exists jhadina_shark_wallet_score_lookup_idx
  on public.jhadina_shark_wallet_score_evidence
  (chain_id, wallet_id, score_model_id, available_at desc, information_cutoff desc);

create table if not exists public.jhadina_shark_wallet_buy_evidence (
  evidence_id text primary key,
  signature text not null,
  chain_id text not null,
  token_address text not null,
  wallet_id text not null,
  amount_usd numeric null check (amount_usd is null or amount_usd >= 0),
  observed_at timestamptz not null,
  available_at timestamptz not null,
  evidence_ids text[] not null check (cardinality(evidence_ids) > 0),
  source text not null check (length(btrim(source)) > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  constraint jhadina_shark_wallet_buy_time_check check (observed_at <= available_at)
);

create index if not exists jhadina_shark_wallet_buy_token_idx
  on public.jhadina_shark_wallet_buy_evidence
  (chain_id, token_address, observed_at, wallet_id);

create index if not exists jhadina_shark_wallet_buy_wallet_idx
  on public.jhadina_shark_wallet_buy_evidence
  (chain_id, wallet_id, available_at desc);

alter table public.jhadina_shark_wallet_score_evidence enable row level security;
alter table public.jhadina_shark_wallet_buy_evidence enable row level security;

revoke all on public.jhadina_shark_wallet_score_evidence from public, anon, authenticated;
revoke all on public.jhadina_shark_wallet_buy_evidence from public, anon, authenticated;

grant select, insert on public.jhadina_shark_wallet_score_evidence to service_role;
grant select, insert on public.jhadina_shark_wallet_buy_evidence to service_role;
revoke update, delete on public.jhadina_shark_wallet_score_evidence from service_role;
revoke update, delete on public.jhadina_shark_wallet_buy_evidence from service_role;

create or replace function public.jhadina_shark_append_wallet_score_evidence(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing jsonb;
begin
  insert into public.jhadina_shark_wallet_score_evidence (
    score_id, chain_id, wallet_id, score_model_id, score, information_cutoff,
    observed_at, available_at, evidence_ids, source, payload
  ) values (
    p_payload->>'scoreId',
    p_payload->>'chainId',
    p_payload->>'walletId',
    p_payload->>'scoreModelId',
    (p_payload->>'score')::numeric,
    (p_payload->>'informationCutoff')::timestamptz,
    (p_payload->>'observedAt')::timestamptz,
    (p_payload->>'availableAt')::timestamptz,
    array(select jsonb_array_elements_text(coalesce(p_payload->'evidenceIds','[]'::jsonb))),
    p_payload->>'source',
    p_payload
  )
  on conflict (score_id) do nothing;

  if found then return 'INSERTED'; end if;
  select payload into v_existing
    from public.jhadina_shark_wallet_score_evidence
    where score_id = p_payload->>'scoreId';
  if v_existing = p_payload then return 'REPLAY'; end if;
  raise exception 'shark_wallet_score_evidence_conflict';
end;
$$;

create or replace function public.jhadina_shark_append_wallet_buy_evidence(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing jsonb;
begin
  insert into public.jhadina_shark_wallet_buy_evidence (
    evidence_id, signature, chain_id, token_address, wallet_id, amount_usd,
    observed_at, available_at, evidence_ids, source, payload
  ) values (
    p_payload->>'evidenceId',
    p_payload->>'signature',
    p_payload->>'chainId',
    p_payload->>'tokenAddress',
    p_payload->>'walletId',
    nullif(p_payload->>'amountUsd','')::numeric,
    (p_payload->>'observedAt')::timestamptz,
    (p_payload->>'availableAt')::timestamptz,
    array(select jsonb_array_elements_text(coalesce(p_payload->'evidenceIds','[]'::jsonb))),
    p_payload->>'source',
    p_payload
  )
  on conflict (evidence_id) do nothing;

  if found then return 'INSERTED'; end if;
  select payload into v_existing
    from public.jhadina_shark_wallet_buy_evidence
    where evidence_id = p_payload->>'evidenceId';
  if v_existing = p_payload then return 'REPLAY'; end if;
  raise exception 'shark_wallet_buy_evidence_conflict';
end;
$$;

revoke all on function public.jhadina_shark_append_wallet_score_evidence(jsonb) from public, anon, authenticated;
revoke all on function public.jhadina_shark_append_wallet_buy_evidence(jsonb) from public, anon, authenticated;
grant execute on function public.jhadina_shark_append_wallet_score_evidence(jsonb) to service_role;
grant execute on function public.jhadina_shark_append_wallet_buy_evidence(jsonb) to service_role;


create or replace function public.jhadina_shark_wallet_score_models()
returns table(score_model_id text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select distinct s.score_model_id
  from public.jhadina_shark_wallet_score_evidence s
  order by s.score_model_id;
$$;

revoke all on function public.jhadina_shark_wallet_score_models() from public, anon, authenticated;
grant execute on function public.jhadina_shark_wallet_score_models() to service_role;
