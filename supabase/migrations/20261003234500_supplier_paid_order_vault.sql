-- SH-SUPLIFUL-LIVE.1 — private paid-order fulfillment vault.
-- Customer contact/shipping PII is never embedded in supplier proposals.
-- Browser roles have no table access; server-side service-role code owns reads/writes.

create table if not exists public.jhadina_supplier_paid_orders (
  user_id uuid not null references auth.users(id) on delete cascade,
  internal_order_id text not null,
  internal_order_item_id text not null,
  payment_status text not null check (payment_status = 'paid'),
  customer_email text not null,
  customer_phone text,
  shipping_address jsonb not null check (jsonb_typeof(shipping_address)='object'),
  paid_at timestamptz not null,
  payment_evidence_refs jsonb not null check (
    jsonb_typeof(payment_evidence_refs)='array'
    and jsonb_array_length(payment_evidence_refs)>0
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,internal_order_id,internal_order_item_id)
);

create index if not exists jhadina_supplier_paid_orders_order_idx
  on public.jhadina_supplier_paid_orders(user_id,internal_order_id,paid_at desc);

alter table public.jhadina_supplier_paid_orders enable row level security;

revoke all on public.jhadina_supplier_paid_orders from public,anon,authenticated;
grant select,insert,update,delete on public.jhadina_supplier_paid_orders to service_role;

-- No browser RLS policy is created intentionally. The service role bypasses RLS;
-- authenticated/anon roles have neither privileges nor policies for this PII vault.
