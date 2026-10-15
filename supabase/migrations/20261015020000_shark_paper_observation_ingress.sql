-- SHARK seven-day field evidence -> durable Supabase quarantine bridge.
-- Real market snapshots or NO_TRADE guard receipts ONLY. This is NOT a
-- synthetic launch, actor-history source, executable Money ingress, or approval.
create table if not exists public.jhadina_shark_paper_observation_ingress (
  receipt_digest text primary key check (receipt_digest ~ '^[a-f0-9]{64}$'),
  experiment_id text not null check (experiment_id = 'JHADINA-MEME-20261013-7D-001'),
  event_kind text not null check (event_kind in ('MARKET_OBSERVATION','SHARK_MONEY_PAPER_GUARD')),
  chain_id text not null default 'solana' check (chain_id = 'solana'),
  mint text not null check (mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  pool text null check (pool is null or pool ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  event_observed_at timestamptz not null,
  event_available_at timestamptz not null,
  source_git_commit text not null check (source_git_commit ~ '^[a-f0-9]{40}$'),
  source_ledger_head text not null check (source_ledger_head ~ '^[a-f0-9]{64}$'),
  source_cycle_digest text not null check (source_cycle_digest ~ '^[a-f0-9]{64}$'),
  source_event_json jsonb not null check (jsonb_typeof(source_event_json) = 'object'),
  safety_status text not null default 'UNVERIFIED' check (safety_status='UNVERIFIED'),
  money_disposition text not null default 'NO_TRADE' check (money_disposition='NO_TRADE'),
  authority text not null default 'RESEARCH_ONLY' check (authority='RESEARCH_ONLY'),
  can_trade boolean not null default false check (can_trade=false),
  can_sign boolean not null default false check (can_sign=false),
  can_broadcast boolean not null default false check (can_broadcast=false),
  created_at timestamptz not null default now(),
  constraint jhadina_shark_paper_observation_clock check (event_observed_at <= event_available_at),
  constraint jhadina_shark_paper_observation_market_pool check (
    (event_kind='MARKET_OBSERVATION' and pool is not null)
    or (event_kind='SHARK_MONEY_PAPER_GUARD' and pool is null)
  ),
  constraint jhadina_shark_paper_observation_event_digest check (
    source_event_json->>'digest'=receipt_digest
    and source_event_json->>'type'=event_kind
    and source_event_json->>'mint'=mint
    and source_event_json->>'canTrade'='false'
  )
);

create index if not exists jhadina_shark_paper_ingress_mint_time_idx
  on public.jhadina_shark_paper_observation_ingress (mint,event_available_at desc);
create index if not exists jhadina_shark_paper_ingress_cycle_idx
  on public.jhadina_shark_paper_observation_ingress (source_cycle_digest);

alter table public.jhadina_shark_paper_observation_ingress enable row level security;
alter table public.jhadina_shark_paper_observation_ingress force row level security;
revoke all on public.jhadina_shark_paper_observation_ingress from public,anon,authenticated;
revoke all on public.jhadina_shark_paper_observation_ingress from service_role;
grant select,insert on public.jhadina_shark_paper_observation_ingress to service_role;
comment on table public.jhadina_shark_paper_observation_ingress is
  'Immutable research-only SHARK market observations and NO_TRADE paper refusal provenance; not a token launch, actor-history, Money approval, executable trade or verified rug. Only service_role may SELECT/INSERT.';
