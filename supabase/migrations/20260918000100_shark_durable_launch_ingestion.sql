-- SHARK durable launch ingestion + actor graph persistence.
-- Service-role workers write; authenticated clients may read launch evidence.
create table if not exists public.jhadina_token_launches (
  launch_id text primary key,
  chain_id text not null,
  token_address text not null,
  deployer_wallet_id text,
  developer_entity_id text,
  cluster_id text,
  launched_at timestamptz not null,
  launchpad text,
  initial_liquidity_usd numeric,
  outcome text not null default 'UNKNOWN',
  evidence_ids text[] not null default '{}',
  source text not null,
  observation_id text unique,
  signature text,
  slot bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jhadina_token_launches_outcome_check check (outcome in ('UNKNOWN','HEALTHY','RUG','FAILED','PUMP_AND_DUMP')),
  constraint jhadina_token_launches_identity_unique unique (chain_id, token_address)
);

-- Reconcile the earlier wallet-launch/sniper table that may already exist in
-- production. That schema used jsonb evidence_ids and omitted SHARK ingestion
-- provenance columns. Canonical SHARK persistence uses text[] evidence IDs.
do $
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jhadina_token_launches'
      and column_name = 'evidence_ids'
      and data_type = 'jsonb'
  ) then
    alter table public.jhadina_token_launches
      add column if not exists evidence_ids_shark_text text[] not null default '{}';

    update public.jhadina_token_launches
       set evidence_ids_shark_text = coalesce(
         (select array_agg(value) from jsonb_array_elements_text(evidence_ids) value),
         '{}'::text[]
       );

    alter table public.jhadina_token_launches drop column evidence_ids;
    alter table public.jhadina_token_launches rename column evidence_ids_shark_text to evidence_ids;
  end if;
end
$;

alter table public.jhadina_token_launches
  add column if not exists source text,
  add column if not exists observation_id text,
  add column if not exists signature text,
  add column if not exists slot bigint,
  add column if not exists outcome_observed_at timestamptz;

update public.jhadina_token_launches
set source = 'legacy-wallet-launch'
where source is null or btrim(source) = '';

alter table public.jhadina_token_launches
  alter column source set default 'unknown',
  alter column source set not null,
  alter column evidence_ids set default '{}';

create table if not exists public.jhadina_token_actor_edges (
  edge_id text primary key,
  launch_id text not null references public.jhadina_token_launches(launch_id) on delete cascade,
  token_address text not null,
  actor_id text not null,
  actor_kind text not null,
  role text not null,
  observed_at timestamptz not null,
  evidence_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint jhadina_token_actor_edges_kind_check check (actor_kind in ('wallet','developer','organization','cluster'))
);

create index if not exists jhadina_token_launches_token_idx on public.jhadina_token_launches(chain_id, token_address);
create index if not exists jhadina_token_actor_edges_actor_idx on public.jhadina_token_actor_edges(actor_kind, actor_id);

alter table public.jhadina_token_launches enable row level security;
alter table public.jhadina_token_actor_edges enable row level security;

drop policy if exists jhadina_token_launches_select_authenticated on public.jhadina_token_launches;
create policy jhadina_token_launches_select_authenticated on public.jhadina_token_launches for select to authenticated using (true);
drop policy if exists jhadina_token_actor_edges_select_authenticated on public.jhadina_token_actor_edges;
create policy jhadina_token_actor_edges_select_authenticated on public.jhadina_token_actor_edges for select to authenticated using (true);

-- No client write policies: ingestion/evaluation writes remain service-role only.
