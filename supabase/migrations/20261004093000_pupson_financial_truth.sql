-- PUPSON-FINANCIAL-TRUTH.1
-- Preserve provider-backed payment/refund and fulfillment-cost observations so
-- downstream Business Factory learning never substitutes catalog estimates for
-- realized economics. These rows are server-only evidence; they do not grant
-- refund, payout, fulfillment, or money-movement authority.

alter table public.pupson_orders
  add column if not exists stripe_charge_id text,
  add column if not exists stripe_balance_transaction_id text,
  add column if not exists stripe_fee_cents integer
    check (stripe_fee_cents is null or stripe_fee_cents >= 0),
  add column if not exists stripe_net_cents integer,
  add column if not exists refunded_amount_cents integer not null default 0
    check (refunded_amount_cents >= 0),
  add column if not exists financial_observed_at timestamptz;

alter table public.pupson_order_items
  add column if not exists provider_product_cost_cents integer
    check (provider_product_cost_cents is null or provider_product_cost_cents >= 0),
  add column if not exists provider_shipping_cost_cents integer
    check (provider_shipping_cost_cents is null or provider_shipping_cost_cents >= 0),
  add column if not exists provider_cost_observed_at timestamptz;

alter table public.pupson_fulfillment_orders
  add column if not exists provider_product_cost_cents integer
    check (provider_product_cost_cents is null or provider_product_cost_cents >= 0),
  add column if not exists provider_shipping_cost_cents integer
    check (provider_shipping_cost_cents is null or provider_shipping_cost_cents >= 0),
  add column if not exists provider_tax_cents integer
    check (provider_tax_cents is null or provider_tax_cents >= 0),
  add column if not exists provider_total_cost_cents integer
    check (provider_total_cost_cents is null or provider_total_cost_cents >= 0),
  add column if not exists provider_cost_observed_at timestamptz;

create table if not exists public.pupson_order_financial_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pupson_orders(id) on delete restrict,
  provider text not null check (provider in ('stripe')),
  provider_event_id text not null,
  event_type text not null check (event_type in (
    'payment_settled',
    'refund_observed'
  )),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists pupson_order_financial_events_order_idx
  on public.pupson_order_financial_events (order_id, occurred_at desc);

alter table public.pupson_order_financial_events enable row level security;

revoke all on table public.pupson_order_financial_events from public, anon, authenticated;
grant all on table public.pupson_order_financial_events to service_role;
