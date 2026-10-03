-- SIDE-HUSTLE-SPECIALIZED.1 — durable Owned Media + Physical Asset operating records.
-- Provider/publication/payment authority remains outside this evidence ledger.

create table if not exists public.jhadina_side_hustle_specialized_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  opportunity_id text not null,
  family text not null,
  kind text not null check (kind in (
    'owned_media_property','owned_media_cycle','owned_media_publication',
    'owned_media_analytics','owned_media_monetization',
    'physical_asset','physical_booking','physical_custody','physical_maintenance'
  )),
  status text,
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key(user_id,id),
  foreign key(user_id,opportunity_id)
    references public.jhadina_opportunities(user_id,id) on delete cascade
);

create index if not exists jhadina_side_hustle_specialized_opportunity_idx
  on public.jhadina_side_hustle_specialized_records
  (user_id,opportunity_id,kind,recorded_at desc);

create index if not exists jhadina_side_hustle_specialized_family_idx
  on public.jhadina_side_hustle_specialized_records
  (user_id,family,kind,recorded_at desc);

alter table public.jhadina_side_hustle_specialized_records enable row level security;

drop policy if exists "jhadina_side_hustle_specialized_select_own"
  on public.jhadina_side_hustle_specialized_records;
create policy "jhadina_side_hustle_specialized_select_own"
  on public.jhadina_side_hustle_specialized_records
  for select to authenticated
  using ((select auth.uid())=user_id);

revoke all on public.jhadina_side_hustle_specialized_records from public, anon;
revoke insert,update,delete on public.jhadina_side_hustle_specialized_records from authenticated;
grant select on public.jhadina_side_hustle_specialized_records to authenticated;
grant select,insert,update,delete on public.jhadina_side_hustle_specialized_records to service_role;

create or replace function public.jhadina_side_hustle_specialized_record_save(
  p_kind text,
  p_record jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_id text:=nullif(p_record->>'id','');
  v_opportunity_id text:=nullif(p_record->>'opportunityId','');
  v_family text:=nullif(p_record->>'family','');
  v_status text:=nullif(p_record->>'status','');
  v_recorded_at timestamptz;
  v_canonical_family text;
  v_existing public.jhadina_side_hustle_specialized_records%rowtype;
  v_has_existing boolean:=false;
  v_allowed boolean:=false;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_record)<>'object' then raise exception 'specialized record must be an object'; end if;
  if p_kind not in (
    'owned_media_property','owned_media_cycle','owned_media_publication',
    'owned_media_analytics','owned_media_monetization',
    'physical_asset','physical_booking','physical_custody','physical_maintenance'
  ) then raise exception 'specialized record kind is invalid'; end if;
  if v_id is null or v_opportunity_id is null or v_family is null then
    raise exception 'specialized record identity is required';
  end if;

  if coalesce((p_record->>'externalActionAuthorized')::boolean,false) is true
     or coalesce((p_record->>'publishingAuthorized')::boolean,false) is true
     or coalesce((p_record->>'paymentAuthorized')::boolean,false) is true
     or coalesce((p_record->>'moneyMovementAuthorized')::boolean,false) is true then
    raise exception 'specialized record cannot grant execution or money authority';
  end if;

  select payload->'metadata'->'sideHustleProfile'->>'family'
    into v_canonical_family
  from public.jhadina_opportunities
  where user_id=v_user and id=v_opportunity_id;
  if v_canonical_family is null then raise exception 'specialized opportunity not found'; end if;
  if v_canonical_family<>v_family then raise exception 'specialized record family mismatch'; end if;

  if p_kind like 'owned_media_%' and v_family<>'owned_media' then
    raise exception 'owned-media record requires owned_media opportunity';
  end if;
  if p_kind like 'physical_%' and v_family<>'physical_asset_businesses' then
    raise exception 'physical record requires physical_asset_businesses opportunity';
  end if;

  if p_kind in ('owned_media_property','owned_media_cycle','physical_asset','physical_booking') then
    v_recorded_at:=nullif(p_record->>'updatedAt','')::timestamptz;
  elsif p_kind='owned_media_publication' then
    v_recorded_at:=nullif(p_record->>'publishedAt','')::timestamptz;
  else
    v_recorded_at:=nullif(p_record->>'observedAt','')::timestamptz;
  end if;
  if v_recorded_at is null then raise exception 'specialized record timestamp is required'; end if;

  select * into v_existing
  from public.jhadina_side_hustle_specialized_records
  where user_id=v_user and id=v_id
  for update;
  v_has_existing:=found;

  if v_has_existing then
    if v_existing.opportunity_id<>v_opportunity_id
       or v_existing.family<>v_family
       or v_existing.kind<>p_kind then
      raise exception 'specialized record identity cannot be rewritten';
    end if;
    if v_existing.payload=p_record then return v_existing.payload; end if;

    if p_kind='owned_media_property' then
      v_allowed:=
        (v_existing.status='active' and v_status in ('paused','retired'))
        or (v_existing.status='paused' and v_status in ('active','retired'));
    elsif p_kind='owned_media_cycle' then
      v_allowed:=
        (v_existing.status='planned' and v_status in ('produced','cancelled'))
        or (v_existing.status='produced' and v_status in ('approved','cancelled'))
        or (v_existing.status='approved' and v_status in ('published','cancelled'))
        or (v_existing.status='published' and v_status='measured');
    elsif p_kind='physical_asset' then
      v_allowed:=
        (v_existing.status='planned' and v_status in ('available','maintenance','retired'))
        or (v_existing.status='available' and v_status in ('reserved','maintenance','retired'))
        or (v_existing.status='reserved' and v_status in ('checked_out','available','maintenance','retired'))
        or (v_existing.status='checked_out' and v_status in ('available','maintenance','retired'))
        or (v_existing.status='maintenance' and v_status in ('available','retired'));
    elsif p_kind='physical_booking' then
      v_allowed:=
        (v_existing.status='requested' and v_status in ('reserved','cancelled'))
        or (v_existing.status='reserved' and v_status in ('checked_out','cancelled'))
        or (v_existing.status='checked_out' and v_status='returned');
    else
      raise exception 'immutable specialized observation cannot be rewritten';
    end if;

    if not v_allowed then raise exception 'specialized record state transition is invalid'; end if;
  else
    if p_kind='owned_media_property' and v_status<>'active' then
      raise exception 'new owned-media property must start active';
    end if;
    if p_kind='owned_media_cycle' and v_status<>'planned' then
      raise exception 'new owned-media cycle must start planned';
    end if;
    if p_kind='physical_asset' and v_status<>'planned' then
      raise exception 'new physical asset must start planned';
    end if;
    if p_kind='physical_booking' and v_status<>'requested' then
      raise exception 'new physical booking must start requested';
    end if;
  end if;

  insert into public.jhadina_side_hustle_specialized_records(
    user_id,id,opportunity_id,family,kind,status,payload,recorded_at
  ) values (
    v_user,v_id,v_opportunity_id,v_family,p_kind,v_status,p_record,v_recorded_at
  )
  on conflict(user_id,id) do update
    set status=excluded.status,payload=excluded.payload,recorded_at=excluded.recorded_at
  returning payload into p_record;

  return p_record;
end;
$$;

create or replace function public.jhadina_side_hustle_specialized_batch_save(
  p_records jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_item jsonb;
  v_results jsonb:='[]'::jsonb;
begin
  if jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)=0 then
    raise exception 'specialized batch requires records';
  end if;
  for v_item in select value from jsonb_array_elements(p_records)
  loop
    if coalesce(v_item->>'kind','')='' or jsonb_typeof(v_item->'record')<>'object' then
      raise exception 'specialized batch item is invalid';
    end if;
    v_results:=v_results||jsonb_build_array(
      public.jhadina_side_hustle_specialized_record_save(
        v_item->>'kind',
        v_item->'record'
      )
    );
  end loop;
  return v_results;
end;
$$;

revoke all on function public.jhadina_side_hustle_specialized_record_save(text,jsonb) from public,anon;
revoke all on function public.jhadina_side_hustle_specialized_batch_save(jsonb) from public,anon;
grant execute on function public.jhadina_side_hustle_specialized_record_save(text,jsonb) to authenticated,service_role;
grant execute on function public.jhadina_side_hustle_specialized_batch_save(jsonb) to authenticated,service_role;
