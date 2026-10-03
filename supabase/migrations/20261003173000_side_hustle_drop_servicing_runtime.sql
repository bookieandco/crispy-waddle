-- SIDE-HUSTLE-DROP-SERVICING.1 — durable provider quote/assignment/rework/margin evidence.
-- This layer records observations/plans only and grants no assignment, payment, or external-action authority.

create table if not exists public.jhadina_side_hustle_drop_servicing_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  opportunity_id text not null,
  work_order_id text not null,
  kind text not null check (kind in (
    'provider_quote',
    'provider_assignment',
    'provider_issue',
    'margin_model'
  )),
  provider_ref text,
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key(user_id,id),
  foreign key(user_id,opportunity_id)
    references public.jhadina_opportunities(user_id,id) on delete cascade,
  foreign key(user_id,work_order_id)
    references public.jhadina_side_hustle_work_orders(user_id,id) on delete cascade
);

create index if not exists jhadina_side_hustle_drop_servicing_work_order_idx
  on public.jhadina_side_hustle_drop_servicing_records
  (user_id,work_order_id,kind,recorded_at desc);

alter table public.jhadina_side_hustle_drop_servicing_records enable row level security;

drop policy if exists "jhadina_side_hustle_drop_servicing_select_own"
  on public.jhadina_side_hustle_drop_servicing_records;
create policy "jhadina_side_hustle_drop_servicing_select_own"
  on public.jhadina_side_hustle_drop_servicing_records
  for select to authenticated
  using ((select auth.uid())=user_id);

revoke all on public.jhadina_side_hustle_drop_servicing_records from public,anon;
revoke insert,update,delete on public.jhadina_side_hustle_drop_servicing_records from authenticated;
grant select on public.jhadina_side_hustle_drop_servicing_records to authenticated;
grant select,insert,update,delete on public.jhadina_side_hustle_drop_servicing_records to service_role;

create or replace function public.jhadina_side_hustle_drop_servicing_record_save(
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
  v_work_order_id text:=nullif(p_record->>'workOrderId','');
  v_family text:=nullif(p_record->>'family','');
  v_provider_ref text:=nullif(p_record->>'providerRef','');
  v_recorded_at timestamptz;
  v_existing public.jhadina_side_hustle_drop_servicing_records%rowtype;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_record)<>'object' then raise exception 'drop servicing record must be an object'; end if;
  if p_kind not in ('provider_quote','provider_assignment','provider_issue','margin_model') then
    raise exception 'drop servicing record kind is invalid';
  end if;
  if v_id is null or v_opportunity_id is null or v_work_order_id is null then
    raise exception 'drop servicing record identity is required';
  end if;
  if v_family<>'drop_servicing' then raise exception 'drop servicing family is required'; end if;

  if coalesce((p_record->>'externalActionAuthorized')::boolean,false) is true
     or coalesce((p_record->>'assignmentAuthorized')::boolean,false) is true
     or coalesce((p_record->>'pricingCommitmentAuthorized')::boolean,false) is true
     or coalesce((p_record->>'paymentAuthorized')::boolean,false) is true
     or coalesce((p_record->>'moneyMovementAuthorized')::boolean,false) is true then
    raise exception 'drop servicing record cannot grant execution or money authority';
  end if;

  if not exists(
    select 1 from public.jhadina_opportunities
    where user_id=v_user and id=v_opportunity_id
      and payload->'metadata'->'sideHustleProfile'->>'family'='drop_servicing'
  ) then raise exception 'drop servicing opportunity not found'; end if;

  if not exists(
    select 1 from public.jhadina_side_hustle_work_orders
    where user_id=v_user and id=v_work_order_id
      and opportunity_id=v_opportunity_id and family='drop_servicing'
  ) then raise exception 'drop servicing work order not found'; end if;

  if p_kind='provider_quote' then
    v_recorded_at:=nullif(p_record->>'observedAt','')::timestamptz;
  elsif p_kind='provider_assignment' then
    v_recorded_at:=nullif(p_record->>'plannedAt','')::timestamptz;
  elsif p_kind='provider_issue' then
    v_recorded_at:=nullif(p_record->>'observedAt','')::timestamptz;
  else
    v_recorded_at:=now();
  end if;
  if v_recorded_at is null then raise exception 'drop servicing timestamp is required'; end if;

  select * into v_existing
  from public.jhadina_side_hustle_drop_servicing_records
  where user_id=v_user and id=v_id;

  if found then
    if v_existing.kind<>p_kind
       or v_existing.opportunity_id<>v_opportunity_id
       or v_existing.work_order_id<>v_work_order_id
       or v_existing.payload<>p_record then
      raise exception 'drop servicing record is immutable';
    end if;
    return v_existing.payload;
  end if;

  insert into public.jhadina_side_hustle_drop_servicing_records(
    user_id,id,opportunity_id,work_order_id,kind,provider_ref,payload,recorded_at
  ) values (
    v_user,v_id,v_opportunity_id,v_work_order_id,p_kind,v_provider_ref,p_record,v_recorded_at
  )
  returning payload into p_record;

  return p_record;
end;
$$;

revoke all on function public.jhadina_side_hustle_drop_servicing_record_save(text,jsonb) from public,anon;
grant execute on function public.jhadina_side_hustle_drop_servicing_record_save(text,jsonb) to authenticated,service_role;
