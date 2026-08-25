-- Capital Intelligence is a derived projection of Money Core transactions.
-- Money Core remains the source of truth. This schema stores only classified
-- investment events, positions, and lots needed for read-side intelligence.

create table if not exists public.jhadina_capital_transaction_projection (
  id bigint generated always as identity primary key,
  source_transaction_id text not null unique,
  account_id text not null,
  domain text not null check (domain in ('equities','etf','forex','crypto','sports','prediction_market')),
  instrument text not null,
  side text not null check (side in ('buy','sell')),
  quantity numeric(38,18) not null check (quantity > 0),
  unit_price numeric(38,18) not null check (unit_price >= 0),
  currency text not null,
  occurred_at timestamptz not null,
  classification_status text not null default 'classified' check (classification_status in ('classified','needs_review','rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_capital_tx_account_time_idx
  on public.jhadina_capital_transaction_projection (account_id, occurred_at desc);

create index if not exists jhadina_capital_tx_instrument_idx
  on public.jhadina_capital_transaction_projection (instrument, occurred_at desc);

create table if not exists public.jhadina_capital_position_projection (
  id bigint generated always as identity primary key,
  account_id text not null,
  domain text not null check (domain in ('equities','etf','forex','crypto','sports','prediction_market')),
  instrument text not null,
  quantity numeric(38,18) not null check (quantity >= 0),
  average_cost numeric(38,18) not null check (average_cost >= 0),
  currency text not null,
  realized_pnl numeric(38,18) not null default 0,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  unique (account_id, instrument)
);

create table if not exists public.jhadina_capital_lot_projection (
  id bigint generated always as identity primary key,
  position_id bigint not null references public.jhadina_capital_position_projection(id) on delete cascade,
  source_transaction_id text not null references public.jhadina_capital_transaction_projection(source_transaction_id),
  quantity numeric(38,18) not null check (quantity > 0),
  remaining_quantity numeric(38,18) not null check (remaining_quantity >= 0),
  unit_cost numeric(38,18) not null check (unit_cost >= 0),
  currency text not null,
  acquired_at timestamptz not null,
  unique (source_transaction_id)
);

create index if not exists jhadina_capital_lot_fifo_idx
  on public.jhadina_capital_lot_projection (position_id, acquired_at asc, id asc);

alter table public.jhadina_capital_transaction_projection enable row level security;
alter table public.jhadina_capital_position_projection enable row level security;
alter table public.jhadina_capital_lot_projection enable row level security;

revoke all on public.jhadina_capital_transaction_projection from public, anon, authenticated;
revoke all on public.jhadina_capital_position_projection from public, anon, authenticated;
revoke all on public.jhadina_capital_lot_projection from public, anon, authenticated;

-- No client-facing policies are granted in this first projection migration.
-- Writes/reads must occur through the server-side application boundary after
-- transaction ownership and authorization have already been checked.
