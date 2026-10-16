-- SOCIAL-FREE.07: authenticated, owner-scoped, evidence-only influencer campaign records.
-- Deploy only after the canonical Swlc database recovers and RLS is verified.
-- No credentials, payment methods, provider tokens, approvals or outbound actions.
create table if not exists public.jhadina_creator_campaign_records (
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 record_id uuid not null default gen_random_uuid(),
 kind text not null check (kind in ('campaign','creator','collaboration','license','outcome','ad_study','creative_brief')),
 brand_id text not null check (length(trim(brand_id)) between 2 and 96),
 campaign_ref text null check (campaign_ref is null or length(trim(campaign_ref)) between 2 and 160),
 source_key text not null check (length(trim(source_key)) between 2 and 160),
 payload jsonb not null check (jsonb_typeof(payload)='object' and pg_column_size(payload)<=16000),
 evidence_refs text[] not null check (cardinality(evidence_refs) between 1 and 30),
 observed_at timestamptz not null,
 revision integer not null default 1 check (revision between 1 and 1000000),
 status text not null default 'DRAFT_ONLY' check (status='DRAFT_ONLY'),
 external_action_authorized boolean not null default false check (external_action_authorized=false),
 money_movement_authorized boolean not null default false check (money_movement_authorized=false),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 archived_at timestamptz,
 primary key (owner_user_id,record_id),
 unique (owner_user_id,kind,brand_id,source_key),
 constraint creator_evidence_nonblank check (array_position(evidence_refs,null) is null)
);
create index if not exists jhadina_creator_record_owner_brand_idx
 on public.jhadina_creator_campaign_records (owner_user_id,brand_id,kind,updated_at desc)
 where archived_at is null;
alter table public.jhadina_creator_campaign_records enable row level security;
alter table public.jhadina_creator_campaign_records force row level security;
revoke all on public.jhadina_creator_campaign_records from public,anon;
grant select,insert,update on public.jhadina_creator_campaign_records to authenticated;
drop policy if exists creator_records_select_own on public.jhadina_creator_campaign_records;
create policy creator_records_select_own on public.jhadina_creator_campaign_records for select to authenticated
 using ((select auth.uid())=owner_user_id);
drop policy if exists creator_records_insert_own on public.jhadina_creator_campaign_records;
create policy creator_records_insert_own on public.jhadina_creator_campaign_records for insert to authenticated
 with check ((select auth.uid())=owner_user_id and status='DRAFT_ONLY'
   and external_action_authorized=false and money_movement_authorized=false);
drop policy if exists creator_records_update_own on public.jhadina_creator_campaign_records;
create policy creator_records_update_own on public.jhadina_creator_campaign_records for update to authenticated
 using ((select auth.uid())=owner_user_id)
 with check ((select auth.uid())=owner_user_id and status='DRAFT_ONLY'
   and external_action_authorized=false and money_movement_authorized=false);
-- No DELETE privilege; archive with an optimistic-lock UPDATE.
comment on table public.jhadina_creator_campaign_records is
 'Owner-only manual creator evidence, campaigns and observed ROI; zero external execution authority. Stored inputs are unverified attestations until matched to provenance.';
