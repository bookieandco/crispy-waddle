-- DIGITAL-PRODUCT-STUDIO.REGISTRY.1 — immutable owner-scoped Studio planning evidence.
-- This is not a checkout, entitlement, delivery, payout, or publishing ledger.

create table if not exists public.jhadina_digital_product_studio_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  opportunity_id text not null,
  kind text not null check (kind in (
    'opportunity_score',
    'matrix_cell',
    'b2b_roi',
    'product_definition',
    'policy_snapshot',
    'marketplace_eligibility',
    'provenance'
  )),
  status text not null,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs)='array'),
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key(user_id,id),
  foreign key(user_id,opportunity_id)
    references public.jhadina_opportunities(user_id,id) on delete cascade
);

create index if not exists jhadina_digital_product_studio_opportunity_idx
  on public.jhadina_digital_product_studio_records
  (user_id,opportunity_id,kind,recorded_at desc);

alter table public.jhadina_digital_product_studio_records enable row level security;

drop policy if exists "jhadina_digital_product_studio_select_own"
  on public.jhadina_digital_product_studio_records;
create policy "jhadina_digital_product_studio_select_own"
  on public.jhadina_digital_product_studio_records
  for select to authenticated
  using ((select auth.uid())=user_id);

revoke all on public.jhadina_digital_product_studio_records from public,anon;
revoke insert,update,delete on public.jhadina_digital_product_studio_records from authenticated;
grant select on public.jhadina_digital_product_studio_records to authenticated;
grant select,insert,update,delete on public.jhadina_digital_product_studio_records to service_role;

create or replace function public.jhadina_digital_product_studio_record_save(
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
  v_kind text:=nullif(btrim(p_record->>'kind'),'');
  v_status text:=nullif(btrim(p_record->>'status'),'');
  v_evidence_refs jsonb:=p_record->'evidenceRefs';
  v_payload jsonb:=p_record->'payload';
  v_recorded_at timestamptz;
  v_canonical_family text;
  v_existing public.jhadina_digital_product_studio_records%rowtype;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_record)<>'object' then
    raise exception 'digital product studio record must be an object';
  end if;
  if v_id is null or v_opportunity_id is null or v_family is null
     or v_kind is null or v_status is null then
    raise exception 'digital product studio record identity is required';
  end if;
  if v_family<>'digital_products' then
    raise exception 'digital product studio record requires digital_products family';
  end if;
  if v_kind not in (
    'opportunity_score','matrix_cell','b2b_roi','product_definition',
    'policy_snapshot','marketplace_eligibility','provenance'
  ) then
    raise exception 'digital product studio record kind is invalid';
  end if;

  begin
    v_recorded_at:=nullif(p_record->>'recordedAt','')::timestamptz;
  exception when others then
    raise exception 'digital product studio recordedAt is invalid';
  end;
  if v_recorded_at is null then
    raise exception 'digital product studio recordedAt is required';
  end if;

  if coalesce(jsonb_typeof(v_evidence_refs),'')<>'array'
     or jsonb_array_length(v_evidence_refs)=0
     or exists(
       select 1
       from jsonb_array_elements(v_evidence_refs) value(item)
       where jsonb_typeof(value.item)<>'string'
          or btrim(value.item #>> '{}')=''
     ) then
    raise exception 'digital product studio evidenceRefs are invalid';
  end if;
  if coalesce(jsonb_typeof(v_payload),'')<>'object' then
    raise exception 'digital product studio payload is required';
  end if;

  if coalesce(p_record->>'authority','')<>'DIGITAL_PRODUCT_STUDIO_RECORD_ONLY'
     or coalesce((p_record->>'externalActionAuthorized')::boolean,false) is true
     or coalesce((p_record->>'publishingAuthorized')::boolean,false) is true
     or coalesce((p_record->>'paymentAuthorized')::boolean,false) is true
     or coalesce((p_record->>'moneyMovementAuthorized')::boolean,false) is true then
    raise exception 'digital product studio record cannot grant execution or money authority';
  end if;

  if v_kind='opportunity_score' then
    if v_status not in ('reject','research','validate','priority') then
      raise exception 'digital product opportunity score status is invalid';
    end if;
    if coalesce((v_payload->'score'->>'externalActionAuthorized')::boolean,false) is true
       or coalesce((v_payload->'score'->>'publishingAuthorized')::boolean,false) is true
       or coalesce((v_payload->'score'->>'paymentAuthorized')::boolean,false) is true then
      raise exception 'digital product opportunity score cannot grant authority';
    end if;
  elsif v_kind='matrix_cell' then
    if v_status<>'recorded' then
      raise exception 'digital product matrix status is invalid';
    end if;
    if coalesce(v_payload->>'opportunityId','')<>v_opportunity_id then
      raise exception 'digital product matrix opportunity mismatch';
    end if;
  elsif v_kind='b2b_roi' then
    if v_status not in ('low','medium','high') then
      raise exception 'digital product B2B ROI status is invalid';
    end if;
    if coalesce((v_payload->'score'->>'externalActionAuthorized')::boolean,false) is true then
      raise exception 'digital product B2B ROI cannot grant authority';
    end if;
  elsif v_kind='product_definition' then
    if v_status<>'draft' then
      raise exception 'digital product definition status is invalid';
    end if;
    if coalesce(v_payload->>'opportunityId','')<>v_opportunity_id then
      raise exception 'digital product definition opportunity mismatch';
    end if;
  elsif v_kind='policy_snapshot' then
    if v_status<>'verified' then
      raise exception 'digital product policy status is invalid';
    end if;
    if coalesce((v_payload->>'externalActionAuthorized')::boolean,false) is true
       or coalesce((v_payload->>'publishingAuthorized')::boolean,false) is true then
      raise exception 'digital product policy cannot grant authority';
    end if;
  elsif v_kind='marketplace_eligibility' then
    if v_status not in ('eligible','conditional','blocked','review_required','stale') then
      raise exception 'digital product marketplace eligibility status is invalid';
    end if;
    if coalesce(v_payload->'product'->>'opportunityId','')<>v_opportunity_id then
      raise exception 'digital product eligibility opportunity mismatch';
    end if;
    if coalesce((v_payload->'evaluation'->>'externalActionAuthorized')::boolean,false) is true
       or coalesce((v_payload->'evaluation'->>'publishingAuthorized')::boolean,false) is true then
      raise exception 'digital product eligibility cannot grant authority';
    end if;
  elsif v_kind='provenance' then
    if v_status not in ('passed','blocked') then
      raise exception 'digital product provenance status is invalid';
    end if;
    if coalesce((v_payload->'provenance'->>'externalActionAuthorized')::boolean,false) is true
       or coalesce((v_payload->'provenance'->>'publishingAuthorized')::boolean,false) is true
       or coalesce((v_payload->'provenance'->>'paymentAuthorized')::boolean,false) is true
       or coalesce((v_payload->'assessment'->>'externalActionAuthorized')::boolean,false) is true
       or coalesce((v_payload->'assessment'->>'publishingAuthorized')::boolean,false) is true then
      raise exception 'digital product provenance cannot grant authority';
    end if;
  end if;

  select payload->'metadata'->'sideHustleProfile'->>'family'
  into v_canonical_family
  from public.jhadina_opportunities
  where user_id=v_user and id=v_opportunity_id;

  if v_canonical_family is null then
    raise exception 'digital product studio opportunity not found';
  end if;
  if v_canonical_family<>'digital_products' then
    raise exception 'digital product studio requires digital_products opportunity';
  end if;

  select * into v_existing
  from public.jhadina_digital_product_studio_records
  where user_id=v_user and id=v_id;

  if found then
    if v_existing.opportunity_id<>v_opportunity_id
       or v_existing.kind<>v_kind
       or v_existing.status<>v_status
       or v_existing.evidence_refs<>v_evidence_refs
       or v_existing.payload<>p_record
       or v_existing.recorded_at<>v_recorded_at then
      raise exception 'digital product studio record is immutable';
    end if;
    return v_existing.payload;
  end if;

  insert into public.jhadina_digital_product_studio_records(
    user_id,id,opportunity_id,kind,status,evidence_refs,payload,recorded_at
  ) values (
    v_user,v_id,v_opportunity_id,v_kind,v_status,v_evidence_refs,p_record,v_recorded_at
  )
  returning payload into p_record;

  return p_record;
end;
$$;

revoke all on function public.jhadina_digital_product_studio_record_save(jsonb)
  from public,anon;
grant execute on function public.jhadina_digital_product_studio_record_save(jsonb)
  to authenticated,service_role;
