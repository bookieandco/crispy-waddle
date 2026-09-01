-- Jhadina Home B&W-6.2: durable ingestion idempotency and canonical entity state.
--
-- The current Home ingestion boundary is server-side and does not yet use a
-- real end-user Supabase Auth session. Follow the established Jhadina
-- service_role-only pattern until Identity/Ask Jhadina auth is authoritative.
-- Application code remains responsible for user/installation scoping when
-- that identity boundary becomes real.

create table if not exists public.jhadina_home_ingestion_idempotency (
  event_id text primary key,
  entity_id text not null,
  status text not null default 'processing'
    check (status in ('processing', 'completed')),
  claimed_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists jhadina_home_ingestion_idempotency_entity_idx
  on public.jhadina_home_ingestion_idempotency (entity_id, created_at desc);

create table if not exists public.jhadina_home_entity_state (
  entity_id text primary key,
  domain text not null,
  friendly_name text not null,
  availability text not null,
  attributes jsonb not null default '{}'::jsonb,
  provider text not null check (provider = 'home-assistant'),
  source_entity_id text not null,
  source_event_id text not null,
  state_at timestamptz not null,
  timestamp_missing boolean not null default false,
  updated_at timestamptz not null default now(),
  correlation_id text,
  causation_id text
);

create index if not exists jhadina_home_entity_state_updated_idx
  on public.jhadina_home_entity_state (updated_at desc);

alter table public.jhadina_home_ingestion_idempotency enable row level security;
alter table public.jhadina_home_entity_state enable row level security;

create policy jhadina_home_ingestion_idempotency_service_role_only
  on public.jhadina_home_ingestion_idempotency as restrictive for all
  to service_role using (true) with check (true);

create policy jhadina_home_entity_state_service_role_only
  on public.jhadina_home_entity_state as restrictive for all
  to service_role using (true) with check (true);

revoke all on public.jhadina_home_ingestion_idempotency from anon, authenticated;
revoke all on public.jhadina_home_entity_state from anon, authenticated;
