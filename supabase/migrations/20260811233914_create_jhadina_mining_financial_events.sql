create table if not exists public.jhadina_mining_financial_events (
  event_id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  resource_id text not null,
  event_type text not null check (event_type in ('mining_economics_projected','electricity_expense_observed','mining_payout_verified','mining_profitability_snapshot')),
  lifecycle text not null check (lifecycle in ('projected','realized')),
  currency text not null check (currency in ('USD','BTC')),
  amount numeric not null check (amount >= 0),
  cost_basis text check (cost_basis in ('user_paid','business_paid','included_in_rent','included_in_hosting','unknown')),
  verification_status text not null check (verification_status in ('unverified','observed','verified')),
  source text not null,
  transaction_id text,
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_jhadina_mining_financial_events_resource_observed
  on public.jhadina_mining_financial_events (resource_id, observed_at desc);

create index if not exists idx_jhadina_mining_financial_events_type
  on public.jhadina_mining_financial_events (event_type, observed_at desc);

alter table public.jhadina_mining_financial_events enable row level security;

create policy jhadina_mining_financial_events_service_role_only
  on public.jhadina_mining_financial_events
  for all
  to service_role
  using (true)
  with check (true);
