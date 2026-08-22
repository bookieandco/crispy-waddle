-- PupsonStuff order ledger.
-- Server/webhook only: the storefront remains anonymous for now.
-- RLS is enabled and public/authenticated access is revoked; the server
-- uses the Supabase service key for privileged writes/reads.

create table if not exists public.pupson_orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  stripe_payment_intent_id text,
  status text not null default 'paid'
    check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  fulfillment_status text not null default 'pending'
    check (fulfillment_status in ('pending', 'blocked', 'submitted', 'fulfilled', 'cancelled')),
  customer_email text,
  currency text,
  amount_total_cents integer check (amount_total_cents is null or amount_total_cents >= 0),
  stripe_created_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pupson_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pupson_orders(id) on delete cascade,
  product_id text not null,
  variant_id text not null,
  product_name text not null,
  variant_label text not null,
  art_style text not null,
  quantity integer not null check (quantity >= 1 and quantity <= 100),
  unit_amount_cents integer not null check (unit_amount_cents > 0),
  preview_path text,
  fulfillment_provider text,
  fulfillment_product_id text,
  fulfillment_variant_id text,
  created_at timestamptz not null default now()
);

create index if not exists pupson_orders_status_idx
  on public.pupson_orders (status, created_at desc);
create index if not exists pupson_orders_fulfillment_idx
  on public.pupson_orders (fulfillment_status, created_at desc);
create index if not exists pupson_order_items_order_idx
  on public.pupson_order_items (order_id);

create or replace function public.pupson_orders_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pupson_orders_updated_at on public.pupson_orders;
create trigger pupson_orders_updated_at
before update on public.pupson_orders
for each row execute function public.pupson_orders_set_updated_at();

alter table public.pupson_orders enable row level security;
alter table public.pupson_order_items enable row level security;

revoke all on table public.pupson_orders from anon, authenticated;
revoke all on table public.pupson_order_items from anon, authenticated;
grant all on table public.pupson_orders to service_role;
grant all on table public.pupson_order_items to service_role;

revoke all on function public.pupson_orders_set_updated_at() from public, anon, authenticated;
grant execute on function public.pupson_orders_set_updated_at() to service_role;
