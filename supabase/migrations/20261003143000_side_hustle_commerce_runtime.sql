-- SIDE-HUSTLE-COMMERCE.1 — durable revenue-product and affiliate evidence.
-- Records catalog/entitlement/subscription/delivery/listing/refund/affiliate state.
-- This layer is evidence and lifecycle state only. It never authorizes charges,
-- refunds, payouts, publication, provider writes, or other external actions.

create table if not exists public.jhadina_side_hustle_commerce_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  opportunity_id text not null,
  family text not null,
  kind text not null check (kind in (
    'offer',
    'entitlement',
    'subscription_observation',
    'delivery',
    'listing',
    'refund_reversal',
    'affiliate_event'
  )),
  status text,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, opportunity_id)
    references public.jhadina_opportunities(user_id, id) on delete cascade
);

create index if not exists jhadina_side_hustle_commerce_records_opportunity_idx
  on public.jhadina_side_hustle_commerce_records
  (user_id, opportunity_id, kind, recorded_at desc);

create index if not exists jhadina_side_hustle_commerce_records_family_idx
  on public.jhadina_side_hustle_commerce_records
  (user_id, family, kind, recorded_at desc);

alter table public.jhadina_side_hustle_commerce_records enable row level security;

drop policy if exists "jhadina_side_hustle_commerce_records_select_own"
  on public.jhadina_side_hustle_commerce_records;
create policy "jhadina_side_hustle_commerce_records_select_own"
  on public.jhadina_side_hustle_commerce_records
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.jhadina_side_hustle_commerce_records from public, anon;
revoke insert, update, delete on public.jhadina_side_hustle_commerce_records from authenticated;
grant select on public.jhadina_side_hustle_commerce_records to authenticated;
grant select, insert, update, delete on public.jhadina_side_hustle_commerce_records to service_role;

create or replace function public.jhadina_side_hustle_commerce_record_save(
  p_kind text,
  p_record jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id text := nullif(p_record->>'id','');
  v_opportunity_id text := nullif(p_record->>'opportunityId','');
  v_family text := nullif(p_record->>'family','');
  v_status text := nullif(p_record->>'status','');
  v_recorded_at timestamptz;
  v_canonical_family text;
  v_existing public.jhadina_side_hustle_commerce_records%rowtype;
  v_existing_found boolean := false;
  v_allowed boolean := false;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_record) <> 'object' then raise exception 'commerce record must be an object'; end if;
  if p_kind not in (
    'offer','entitlement','subscription_observation','delivery',
    'listing','refund_reversal','affiliate_event'
  ) then raise exception 'commerce record kind is invalid'; end if;
  if v_id is null or v_opportunity_id is null or v_family is null then
    raise exception 'commerce record identity is required';
  end if;

  if coalesce((p_record->>'externalActionAuthorized')::boolean,false) is true
     or coalesce((p_record->>'paymentAuthorized')::boolean,false) is true
     or coalesce((p_record->>'moneyMovementAuthorized')::boolean,false) is true then
    raise exception 'commerce record cannot grant external or money authority';
  end if;

  select payload->'metadata'->'sideHustleProfile'->>'family'
    into v_canonical_family
  from public.jhadina_opportunities
  where user_id = v_user and id = v_opportunity_id;

  if v_canonical_family is null then raise exception 'commerce opportunity not found'; end if;
  if v_canonical_family <> v_family then raise exception 'commerce record family mismatch'; end if;

  if p_kind = 'affiliate_event' then
    if v_family <> 'commerce_affiliate' then
      raise exception 'affiliate event requires commerce_affiliate opportunity';
    end if;
    v_recorded_at := nullif(p_record->>'occurredAt','')::timestamptz;
  elsif p_kind = 'offer' then
    if v_family not in ('digital_products','software_apps','communities','directories_marketplaces') then
      raise exception 'offer family is not supported by revenue-product runtime';
    end if;
    v_recorded_at := nullif(p_record->>'updatedAt','')::timestamptz;
  elsif p_kind = 'listing' then
    if v_family <> 'directories_marketplaces' then
      raise exception 'listing requires directories_marketplaces opportunity';
    end if;
    v_recorded_at := nullif(p_record->>'updatedAt','')::timestamptz;
  elsif p_kind = 'entitlement' then
    if v_family not in ('digital_products','software_apps','communities','directories_marketplaces') then
      raise exception 'entitlement family is not supported';
    end if;
    v_recorded_at := coalesce(
      nullif(p_record->>'endedAt','')::timestamptz,
      nullif(p_record->>'grantedAt','')::timestamptz
    );
  elsif p_kind = 'subscription_observation' then
    v_recorded_at := nullif(p_record->>'observedAt','')::timestamptz;
  elsif p_kind = 'delivery' then
    v_recorded_at := nullif(p_record->>'deliveredAt','')::timestamptz;
  elsif p_kind = 'refund_reversal' then
    v_recorded_at := nullif(p_record->>'observedAt','')::timestamptz;
  end if;

  if v_recorded_at is null then raise exception 'commerce record timestamp is required'; end if;

  select * into v_existing
  from public.jhadina_side_hustle_commerce_records
  where user_id = v_user and id = v_id
  for update;
  v_existing_found := found;

  if v_existing_found then
    if v_existing.opportunity_id <> v_opportunity_id
       or v_existing.family <> v_family
       or v_existing.kind <> p_kind then
      raise exception 'commerce record identity cannot be rewritten';
    end if;

    if v_existing.payload = p_record then
      return v_existing.payload;
    end if;

    if p_kind = 'offer' then
      v_allowed :=
        (v_existing.status = 'draft' and v_status = 'active')
        or (v_existing.status in ('draft','active') and v_status = 'retired');
    elsif p_kind = 'entitlement' then
      v_allowed := v_existing.status = 'active' and v_status in ('expired','revoked');
    elsif p_kind = 'listing' then
      v_allowed :=
        (v_existing.status = 'draft' and v_status in ('pending_review','retired'))
        or (v_existing.status = 'pending_review' and v_status in ('approved','rejected','retired'))
        or (v_existing.status = 'approved' and v_status in ('published','retired'))
        or (v_existing.status = 'rejected' and v_status in ('pending_review','retired'))
        or (v_existing.status = 'published' and v_status = 'retired');
    else
      raise exception 'immutable commerce observation cannot be rewritten';
    end if;

    if not v_allowed then raise exception 'commerce record state transition is invalid'; end if;
  else
    if p_kind = 'offer' and v_status <> 'draft' then
      raise exception 'new commerce offer must start as draft';
    end if;
    if p_kind = 'entitlement' and v_status <> 'active' then
      raise exception 'new entitlement must start active';
    end if;
    if p_kind = 'listing' and v_status <> 'draft' then
      raise exception 'new listing must start as draft';
    end if;
  end if;

  insert into public.jhadina_side_hustle_commerce_records(
    user_id,id,opportunity_id,family,kind,status,payload,recorded_at
  ) values (
    v_user,v_id,v_opportunity_id,v_family,p_kind,v_status,p_record,v_recorded_at
  )
  on conflict (user_id,id) do update
    set status = excluded.status,
        payload = excluded.payload,
        recorded_at = excluded.recorded_at
  returning payload into p_record;

  return p_record;
end;
$$;

revoke all on function public.jhadina_side_hustle_commerce_record_save(text,jsonb) from public, anon;
grant execute on function public.jhadina_side_hustle_commerce_record_save(text,jsonb) to authenticated, service_role;
