-- AFFILIATE-COMPLIANCE.1 — durable evidence-backed compliance snapshots.
-- A snapshot records reviewed network/program terms plus disclosure/content review evidence.
-- It cannot grant publishing, payment, enrollment, transfer, or external-action authority.

create table if not exists public.jhadina_affiliate_compliance_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  opportunity_id text not null,
  status text not null check (status in ('passed','blocked')),
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  evaluated_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key(user_id,id),
  foreign key(user_id,opportunity_id)
    references public.jhadina_opportunities(user_id,id) on delete cascade,
  check (expires_at>evaluated_at)
);

create index if not exists jhadina_affiliate_compliance_lookup_idx
  on public.jhadina_affiliate_compliance_snapshots
  (user_id,opportunity_id,evaluated_at desc);

alter table public.jhadina_affiliate_compliance_snapshots enable row level security;

drop policy if exists "jhadina_affiliate_compliance_select_own"
  on public.jhadina_affiliate_compliance_snapshots;
create policy "jhadina_affiliate_compliance_select_own"
  on public.jhadina_affiliate_compliance_snapshots
  for select to authenticated
  using ((select auth.uid())=user_id);

revoke all on public.jhadina_affiliate_compliance_snapshots from public,anon;
revoke insert,update,delete on public.jhadina_affiliate_compliance_snapshots from authenticated;
grant select on public.jhadina_affiliate_compliance_snapshots to authenticated;
grant select,insert,update,delete on public.jhadina_affiliate_compliance_snapshots to service_role;

create or replace function public.jhadina_affiliate_compliance_snapshot_record(
  p_record jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_id text:=nullif(btrim(p_record->>'id'),'');
  v_opportunity_id text:=nullif(btrim(p_record->>'opportunityId'),'');
  v_family text:=nullif(btrim(p_record->>'family'),'');
  v_status text:=nullif(btrim(p_record->>'status'),'');
  v_evidence_refs jsonb:=p_record->'evidenceRefs';
  v_blockers jsonb:=p_record->'blockers';
  v_used_channels jsonb:=p_record->'usedChannels';
  v_active_program_refs jsonb:=p_record->'activeProgramRefs';
  v_terms jsonb:=p_record->'termsSnapshots';
  v_disclosures jsonb:=p_record->'disclosureObservations';
  v_reviews jsonb:=p_record->'contentReviews';
  v_evaluated_at timestamptz;
  v_expires_at timestamptz;
  v_opportunity_family text;
  v_existing public.jhadina_affiliate_compliance_snapshots%rowtype;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_record)<>'object' then
    raise exception 'affiliate compliance snapshot must be an object';
  end if;
  if v_id is null or v_opportunity_id is null or v_family is null or v_status is null then
    raise exception 'affiliate compliance snapshot identity is required';
  end if;
  if v_family<>'commerce_affiliate' then
    raise exception 'affiliate compliance snapshot requires commerce_affiliate family';
  end if;
  if v_status not in ('passed','blocked') then
    raise exception 'affiliate compliance snapshot status is invalid';
  end if;

  begin
    v_evaluated_at:=nullif(p_record->>'evaluatedAt','')::timestamptz;
    v_expires_at:=nullif(p_record->>'expiresAt','')::timestamptz;
  exception when others then
    raise exception 'affiliate compliance timestamps are invalid';
  end;
  if v_evaluated_at is null or v_expires_at is null then
    raise exception 'affiliate compliance timestamps are required';
  end if;
  if v_expires_at<=v_evaluated_at then
    raise exception 'affiliate compliance expiresAt must follow evaluatedAt';
  end if;

  if coalesce(jsonb_typeof(v_evidence_refs),'')<>'array'
     or jsonb_array_length(v_evidence_refs)=0
     or exists(
       select 1 from jsonb_array_elements(v_evidence_refs) value(item)
       where jsonb_typeof(value.item)<>'string'
          or btrim(value.item #>> '{}')=''
     ) then
    raise exception 'affiliate compliance evidenceRefs are invalid';
  end if;

  if coalesce(jsonb_typeof(v_blockers),'')<>'array'
     or coalesce(jsonb_typeof(v_used_channels),'')<>'array'
     or coalesce(jsonb_typeof(v_active_program_refs),'')<>'array'
     or coalesce(jsonb_typeof(v_terms),'')<>'array'
     or coalesce(jsonb_typeof(v_disclosures),'')<>'array'
     or coalesce(jsonb_typeof(v_reviews),'')<>'array' then
    raise exception 'affiliate compliance structured evidence arrays are required';
  end if;

  if v_status='passed' then
    if jsonb_array_length(v_blockers)<>0 then
      raise exception 'passed affiliate compliance snapshot cannot contain blockers';
    end if;
    if jsonb_array_length(v_used_channels)=0
       or jsonb_array_length(v_active_program_refs)=0
       or jsonb_array_length(v_terms)=0
       or jsonb_array_length(v_disclosures)=0
       or jsonb_array_length(v_reviews)=0 then
      raise exception 'passed affiliate compliance snapshot requires complete structured evidence';
    end if;
  else
    if jsonb_array_length(v_blockers)=0 then
      raise exception 'blocked affiliate compliance snapshot requires blockers';
    end if;
  end if;

  if coalesce(p_record->>'authority','')<>'AFFILIATE_COMPLIANCE_SNAPSHOT_ONLY' then
    raise exception 'affiliate compliance snapshot authority is invalid';
  end if;
  if coalesce((p_record->>'externalActionAuthorized')::boolean,false) is true
     or coalesce((p_record->>'publishingAuthorized')::boolean,false) is true
     or coalesce((p_record->>'paymentAuthorized')::boolean,false) is true
     or coalesce((p_record->>'moneyMovementAuthorized')::boolean,false) is true then
    raise exception 'affiliate compliance snapshot cannot grant execution or money authority';
  end if;

  if exists(
    select 1 from jsonb_array_elements(v_terms) value(item)
    where coalesce((value.item->>'externalActionAuthorized')::boolean,false) is true
       or coalesce((value.item->>'publishingAuthorized')::boolean,false) is true
       or coalesce((value.item->>'paymentAuthorized')::boolean,false) is true
       or coalesce((value.item->>'moneyMovementAuthorized')::boolean,false) is true
  ) or exists(
    select 1 from jsonb_array_elements(v_disclosures) value(item)
    where coalesce((value.item->>'externalActionAuthorized')::boolean,false) is true
       or coalesce((value.item->>'publishingAuthorized')::boolean,false) is true
  ) or exists(
    select 1 from jsonb_array_elements(v_reviews) value(item)
    where coalesce((value.item->>'externalActionAuthorized')::boolean,false) is true
       or coalesce((value.item->>'publishingAuthorized')::boolean,false) is true
  ) then
    raise exception 'affiliate compliance nested evidence cannot grant execution authority';
  end if;

  select payload->'metadata'->'sideHustleProfile'->>'family'
  into v_opportunity_family
  from public.jhadina_opportunities
  where user_id=v_user and id=v_opportunity_id;

  if v_opportunity_family is null then
    raise exception 'affiliate compliance opportunity not found';
  end if;
  if v_opportunity_family<>'commerce_affiliate' then
    raise exception 'affiliate compliance snapshot requires commerce_affiliate opportunity';
  end if;

  select * into v_existing
  from public.jhadina_affiliate_compliance_snapshots
  where user_id=v_user and id=v_id;

  if found then
    if v_existing.opportunity_id<>v_opportunity_id
       or v_existing.status<>v_status
       or v_existing.payload<>p_record
       or v_existing.evaluated_at<>v_evaluated_at
       or v_existing.expires_at<>v_expires_at then
      raise exception 'affiliate compliance snapshot is immutable';
    end if;
    return v_existing.payload;
  end if;

  insert into public.jhadina_affiliate_compliance_snapshots(
    user_id,id,opportunity_id,status,payload,evaluated_at,expires_at
  ) values (
    v_user,v_id,v_opportunity_id,v_status,p_record,v_evaluated_at,v_expires_at
  )
  returning payload into p_record;

  return p_record;
end;
$$;

revoke all on function public.jhadina_affiliate_compliance_snapshot_record(jsonb)
  from public,anon;
grant execute on function public.jhadina_affiliate_compliance_snapshot_record(jsonb)
  to authenticated,service_role;
