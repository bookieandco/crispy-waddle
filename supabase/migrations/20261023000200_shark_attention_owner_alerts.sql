-- SHARK-ATTENTION.LIVE-PAPER.09
-- Owner-only read-model projection for public research alerts.
-- SOURCE ONLY; never apply without separately approved Supabase migration review.
-- This is NOT a trading ledger, notifier, scheduler, signer, or execution table.
create table if not exists public.shark_attention_owner_alerts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  alert_id text not null check (length(alert_id) between 1 and 256),
  mint text not null check (mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  code text not null check (code in (
    'PRICE_SWING','CONTRACT_COMPETITION','NARRATIVE_RETRACTED',
    'ONCHAIN_DISTRIBUTION','LIQUIDITY_RISK'
  )),
  severity text not null check (severity in ('WATCH','HIGH')),
  source_url text not null check (
    length(source_url) <= 512 and source_url like 'https://%'
  ),
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, alert_id)
);
create index if not exists shark_attention_owner_alerts_recent_idx
 on public.shark_attention_owner_alerts (owner_id, observed_at desc);
alter table public.shark_attention_owner_alerts enable row level security;
revoke all on public.shark_attention_owner_alerts from public, anon, authenticated;
grant select on public.shark_attention_owner_alerts to authenticated;
grant select, insert, update, delete on public.shark_attention_owner_alerts to service_role;
drop policy if exists shark_attention_owner_select on public.shark_attention_owner_alerts;
create policy shark_attention_owner_select
 on public.shark_attention_owner_alerts for select to authenticated
 using (owner_id = (select auth.uid()));
-- Deliberately no authenticated insert/update/delete policies.
-- Trusted projector, per-owner ingestion guard, retention job and staging
-- acceptance are separate prerequisites for populating this read-model.
