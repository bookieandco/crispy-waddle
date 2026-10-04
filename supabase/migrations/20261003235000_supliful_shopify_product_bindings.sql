-- SH-SUPLIFUL-LIVE.2 — verified Supliful <-> Shopify product bindings.
-- A supplier order may only use Shopify variants that were observed on the
-- Supliful Fulfillment service. Browser roles have no direct access.

create table if not exists public.jhadina_supliful_shopify_product_bindings (
  user_id uuid not null references auth.users(id) on delete cascade,
  internal_product_id text not null,
  internal_variant_id text not null,
  shopify_product_gid text not null,
  shopify_variant_gid text not null,
  sku text,
  fulfillment_service_name text not null check (
    fulfillment_service_name = 'Supliful Fulfillment'
  ),
  evidence_refs jsonb not null check (
    jsonb_typeof(evidence_refs)='array'
    and jsonb_array_length(evidence_refs)>0
  ),
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,internal_product_id,internal_variant_id),
  unique(user_id,shopify_variant_gid)
);

create index if not exists jhadina_supliful_shopify_variant_idx
  on public.jhadina_supliful_shopify_product_bindings(user_id,shopify_variant_gid);

alter table public.jhadina_supliful_shopify_product_bindings enable row level security;

revoke all on public.jhadina_supliful_shopify_product_bindings from public,anon,authenticated;
grant select,insert,update,delete on public.jhadina_supliful_shopify_product_bindings to service_role;
