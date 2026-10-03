-- SIDE-HUSTLE-COMMISSIONING.1 — durable family-level commissioning evidence.
-- Evidence can certify provider, credential, live-customer, compliance and related gates.
-- This table/RPC grants no external-action or money-movement authority.

create table if not exists public.jhadina_side_hustle_commissioning_evidence (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  family text not null check (family in (
    'ai_business_implementation','business_automation','business_systems',
    'lead_generation_growth','ai_discovery_seo','content_social',
    'creative_advertising','media_production','owned_media','creator_monetization',
    'digital_products','software_apps','communities','pod_personalized_commerce',
    'commerce_affiliate','dropshipping_product_commerce','drop_servicing',
    'directories_marketplaces','physical_asset_businesses','boring_business_services',
    'research_services','procurement_subcontracting','website_revenue_systems',
    'human_premium_services','trading_investing_intelligence','pr_authority'
  )),
  gate_type text not null check (gate_type in (
    'provider','credential','live_customer','payment_billing','deployment',
    'outreach_authority','data_analytics','physical_evidence','compliance',
    'human_operator','capability_boundary','software'
  )),
  status text not null check (status in ('passed','blocked','not_applicable')),
  provider_ref text,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs)='array'),
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  observed_at timestamptz not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(user_id,id),
  check (expires_at is null or expires_at>observed_at)
);

create index if not exists jhadina_side_hustle_commissioning_family_gate_idx
  on public.jhadina_side_hustle_commissioning_evidence
  (user_id,family,gate_type,observed_at desc);

alter table public.jhadina_side_hustle_commissioning_evidence enable row level security;

drop policy if exists "jhadina_side_hustle_commissioning_select_own"
  on public.jhadina_side_hustle_commissioning_evidence;
create policy "jhadina_side_hustle_commissioning_select_own"
  on public.jhadina_side_hustle_commissioning_evidence
  for select to authenticated
  using ((select auth.uid())=user_id);

revoke all on public.jhadina_side_hustle_commissioning_evidence from public,anon;
revoke insert,update,delete on public.jhadina_side_hustle_commissioning_evidence from authenticated;
grant select on public.jhadina_side_hustle_commissioning_evidence to authenticated;
grant select,insert,update,delete on public.jhadina_side_hustle_commissioning_evidence to service_role;

create or replace function public.jhadina_side_hustle_commissioning_evidence_record(
  p_evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_id text:=nullif(p_evidence->>'id','');
  v_family text:=nullif(p_evidence->>'family','');
  v_gate_type text:=nullif(p_evidence->>'gateType','');
  v_status text:=nullif(p_evidence->>'status','');
  v_provider_ref text:=nullif(p_evidence->>'providerRef','');
  v_evidence_refs jsonb:=p_evidence->'evidenceRefs';
  v_observed_at timestamptz:=nullif(p_evidence->>'observedAt','')::timestamptz;
  v_expires_at timestamptz:=nullif(p_evidence->>'expiresAt','')::timestamptz;
  v_existing public.jhadina_side_hustle_commissioning_evidence%rowtype;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_evidence)<>'object' then raise exception 'commissioning evidence must be an object'; end if;
  if v_id is null or v_family is null or v_gate_type is null or v_status is null then
    raise exception 'commissioning evidence identity is required';
  end if;
  if v_status not in ('passed','blocked','not_applicable') then
    raise exception 'commissioning evidence status is invalid';
  end if;
  if v_observed_at is null then raise exception 'commissioning evidence observedAt is required'; end if;
  if v_expires_at is not null and v_expires_at<=v_observed_at then
    raise exception 'commissioning evidence expiresAt must follow observedAt';
  end if;
  if coalesce(jsonb_typeof(v_evidence_refs),'')<>'array'
     or jsonb_array_length(v_evidence_refs)=0
     or exists(
       select 1 from jsonb_array_elements(v_evidence_refs) as value(item)
       where jsonb_typeof(value.item)<>'string' or btrim(value.item #>> '{}')=''
     ) then
    raise exception 'commissioning evidenceRefs must contain non-empty strings';
  end if;
  if coalesce((p_evidence->>'externalActionAuthorized')::boolean,false) is true
     or coalesce((p_evidence->>'moneyMovementAuthorized')::boolean,false) is true
     or coalesce((p_evidence->>'paymentAuthorized')::boolean,false) is true
     or coalesce((p_evidence->>'assignmentAuthorized')::boolean,false) is true
     or coalesce((p_evidence->>'publishingAuthorized')::boolean,false) is true then
    raise exception 'commissioning evidence cannot grant execution or money authority';
  end if;

  select * into v_existing
  from public.jhadina_side_hustle_commissioning_evidence
  where user_id=v_user and id=v_id;

  if found then
    if v_existing.family<>v_family
       or v_existing.gate_type<>v_gate_type
       or v_existing.status<>v_status
       or coalesce(v_existing.provider_ref,'')<>coalesce(v_provider_ref,'')
       or v_existing.evidence_refs<>v_evidence_refs
       or v_existing.payload<>p_evidence
       or v_existing.observed_at<>v_observed_at
       or v_existing.expires_at is distinct from v_expires_at then
      raise exception 'commissioning evidence is immutable';
    end if;
    return v_existing.payload;
  end if;

  insert into public.jhadina_side_hustle_commissioning_evidence(
    user_id,id,family,gate_type,status,provider_ref,evidence_refs,payload,observed_at,expires_at
  ) values (
    v_user,v_id,v_family,v_gate_type,v_status,v_provider_ref,v_evidence_refs,p_evidence,v_observed_at,v_expires_at
  )
  returning payload into p_evidence;

  return p_evidence;
end;
$$;

revoke all on function public.jhadina_side_hustle_commissioning_evidence_record(jsonb) from public,anon;
grant execute on function public.jhadina_side_hustle_commissioning_evidence_record(jsonb) to authenticated,service_role;
