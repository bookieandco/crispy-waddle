-- TIKTOK-LIVE.8 — durable seller settlement/refund evidence.
-- Owner-scoped observations only. This table does not authorize payments,
-- withdrawals, refunds, order mutation, fulfillment, or money movement.

create table if not exists public.jhadina_tiktok_seller_finance_observations (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  opportunity_id text not null,
  order_ref text,
  transaction_ref text not null,
  kind text not null check (
    kind in (
      'sale_settlement',
      'refund',
      'chargeback',
      'platform_fee',
      'affiliate_commission',
      'promotion_fee',
      'fee_and_tax',
      'fulfillment_cost',
      'shipping_cost',
      'platform_shipping_cost'
    )
  ),
  currency text not null,
  amount double precision not null check (amount >= 0),
  accounting_effect text not null default 'include'
    check (accounting_effect in ('include','informational')),
  evidence_refs text[] not null default '{}',
  payload jsonb not null,
  occurred_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, id),
  foreign key (owner_user_id, opportunity_id)
    references public.jhadina_opportunities(user_id, id) on delete cascade
);

create index if not exists jhadina_tiktok_seller_finance_opportunity_time_idx
  on public.jhadina_tiktok_seller_finance_observations(
    owner_user_id,
    opportunity_id,
    occurred_at desc
  );

alter table public.jhadina_tiktok_seller_finance_observations enable row level security;

drop policy if exists "jhadina_tiktok_seller_finance_select_own"
  on public.jhadina_tiktok_seller_finance_observations;
create policy "jhadina_tiktok_seller_finance_select_own"
  on public.jhadina_tiktok_seller_finance_observations
  for select to authenticated
  using (auth.uid() = owner_user_id);

revoke all on public.jhadina_tiktok_seller_finance_observations
  from public, anon;
revoke insert, update, delete
  on public.jhadina_tiktok_seller_finance_observations
  from authenticated;
grant select
  on public.jhadina_tiktok_seller_finance_observations
  to authenticated;
grant select, insert, update, delete
  on public.jhadina_tiktok_seller_finance_observations
  to service_role;

comment on table public.jhadina_tiktok_seller_finance_observations is
  'Read-only-to-owner TikTok seller settlement/refund evidence used by Side Hustle outcome learning. No money movement authority.';
