-- SIDE-HUSTLE-COMMERCIAL.1-.5 — durable work-order and evidence receipts.
-- This layer records commercial scope, observed delivery/acceptance, routing plans,
-- outcome bridges, and certification evidence. It grants no payment, signature,
-- assignment, external-action, or maturity-promotion authority.

create table if not exists public.jhadina_side_hustle_work_orders (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  opportunity_id text not null,
  venture_id text,
  family text not null,
  customer_ref text not null,
  status text not null check (status in (
    'draft','scope_locked','delivery_in_progress','delivered',
    'revision_required','accepted','cancelled'
  )),
  amount double precision not null check (amount >= 0),
  currency text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id),
  foreign key (user_id, opportunity_id)
    references public.jhadina_opportunities(user_id, id) on delete cascade,
  foreign key (user_id, venture_id)
    references public.jhadina_venture_records(owner_user_id, id) on delete cascade
);

create index if not exists jhadina_side_hustle_work_orders_opportunity_idx
  on public.jhadina_side_hustle_work_orders
  (user_id, opportunity_id, status, updated_at desc);

create index if not exists jhadina_side_hustle_work_orders_family_idx
  on public.jhadina_side_hustle_work_orders
  (user_id, family, status, updated_at desc);

create table if not exists public.jhadina_side_hustle_commercial_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  work_order_id text,
  opportunity_id text,
  family text not null,
  kind text not null check (kind in (
    'delivery_start',
    'delivery',
    'acceptance',
    'routing',
    'outcome_bridge',
    'certification'
  )),
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, work_order_id)
    references public.jhadina_side_hustle_work_orders(user_id, id) on delete cascade,
  foreign key (user_id, opportunity_id)
    references public.jhadina_opportunities(user_id, id) on delete cascade
);

create index if not exists jhadina_side_hustle_commercial_receipts_work_order_idx
  on public.jhadina_side_hustle_commercial_receipts
  (user_id, work_order_id, kind, recorded_at desc);

create index if not exists jhadina_side_hustle_commercial_receipts_family_idx
  on public.jhadina_side_hustle_commercial_receipts
  (user_id, family, kind, recorded_at desc);

alter table public.jhadina_side_hustle_work_orders enable row level security;
alter table public.jhadina_side_hustle_commercial_receipts enable row level security;

drop policy if exists "jhadina_side_hustle_work_orders_select_own"
  on public.jhadina_side_hustle_work_orders;
create policy "jhadina_side_hustle_work_orders_select_own"
  on public.jhadina_side_hustle_work_orders
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "jhadina_side_hustle_commercial_receipts_select_own"
  on public.jhadina_side_hustle_commercial_receipts;
create policy "jhadina_side_hustle_commercial_receipts_select_own"
  on public.jhadina_side_hustle_commercial_receipts
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.jhadina_side_hustle_work_orders from public, anon;
revoke all on public.jhadina_side_hustle_commercial_receipts from public, anon;
revoke insert, update, delete on public.jhadina_side_hustle_work_orders from authenticated;
revoke insert, update, delete on public.jhadina_side_hustle_commercial_receipts from authenticated;
grant select on public.jhadina_side_hustle_work_orders to authenticated;
grant select on public.jhadina_side_hustle_commercial_receipts to authenticated;
grant select, insert, update, delete on public.jhadina_side_hustle_work_orders to service_role;
grant select, insert, update, delete on public.jhadina_side_hustle_commercial_receipts to service_role;

create or replace function public.jhadina_side_hustle_work_order_save(
  p_work_order jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id text := p_work_order->>'id';
  v_opportunity_id text := p_work_order->>'opportunityId';
  v_venture_id text := nullif(p_work_order->>'ventureId','');
  v_family text := p_work_order->>'family';
  v_customer_ref text := p_work_order->>'customerRef';
  v_status text := p_work_order->>'status';
  v_created_at timestamptz := nullif(p_work_order->>'createdAt','')::timestamptz;
  v_updated_at timestamptz := nullif(p_work_order->>'updatedAt','')::timestamptz;
  v_amount double precision := nullif(p_work_order->'price'->>'amount','')::double precision;
  v_currency text := p_work_order->'price'->>'currency';
  v_opportunity public.jhadina_opportunities%rowtype;
  v_existing public.jhadina_side_hustle_work_orders%rowtype;
  v_has_existing boolean := false;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_work_order) <> 'object' then raise exception 'commercial work order must be an object'; end if;
  if coalesce(v_id,'') = '' or coalesce(v_opportunity_id,'') = '' or coalesce(v_family,'') = '' then
    raise exception 'commercial work order identity is required';
  end if;
  if coalesce(v_customer_ref,'') = '' then raise exception 'commercial work order customerRef is required'; end if;
  if v_status not in (
    'draft','scope_locked','delivery_in_progress','delivered',
    'revision_required','accepted','cancelled'
  ) then raise exception 'commercial work order status is invalid'; end if;
  if coalesce(p_work_order->>'authority','') <> 'COMMERCIAL_SCOPE_ONLY' then
    raise exception 'commercial work order authority must be COMMERCIAL_SCOPE_ONLY';
  end if;
  if (p_work_order->>'externalActionAuthorized')::boolean is distinct from false
     or (p_work_order->>'paymentAuthorized')::boolean is distinct from false
     or (p_work_order->>'signatureAuthorized')::boolean is distinct from false then
    raise exception 'commercial work order cannot grant execution authority';
  end if;
  if v_created_at is null or v_updated_at is null then
    raise exception 'commercial work order timestamps are required';
  end if;
  if v_updated_at < v_created_at then
    raise exception 'commercial work order updatedAt cannot predate createdAt';
  end if;
  if v_amount is null or v_amount < 0 or coalesce(v_currency,'') = '' then
    raise exception 'commercial work order price is invalid';
  end if;
  if jsonb_typeof(p_work_order->'scopeItems') <> 'array'
     or jsonb_array_length(p_work_order->'scopeItems') = 0 then
    raise exception 'commercial work order scope is required';
  end if;
  if jsonb_typeof(p_work_order->'acceptanceCriteria') <> 'array'
     or jsonb_array_length(p_work_order->'acceptanceCriteria') = 0 then
    raise exception 'commercial work order acceptance criteria are required';
  end if;
  if jsonb_typeof(p_work_order->'executionOwners') <> 'array'
     or jsonb_array_length(p_work_order->'executionOwners') = 0 then
    raise exception 'commercial work order execution owners are required';
  end if;
  if jsonb_typeof(p_work_order->'evidenceRefs') <> 'array'
     or jsonb_array_length(p_work_order->'evidenceRefs') = 0 then
    raise exception 'commercial work order evidence is required';
  end if;

  select * into v_opportunity
  from public.jhadina_opportunities
  where user_id = v_user and id = v_opportunity_id;
  if not found then raise exception 'opportunity not found'; end if;
  if coalesce(v_opportunity.payload->'metadata'->'sideHustleProfile'->>'family','') <> v_family then
    raise exception 'commercial work order family does not match canonical opportunity';
  end if;
  if coalesce(v_opportunity.payload->'metadata'->'sideHustleProfile'->>'role','') = 'capability'
     or v_family = 'trading_investing_intelligence' then
    raise exception 'capability-only side hustle cannot create a commercial work order';
  end if;
  if v_opportunity.status not in ('ready','approved','pursuing','won','lost') then
    raise exception 'opportunity is not eligible for commercial work order persistence';
  end if;

  if v_venture_id is not null and not exists (
    select 1 from public.jhadina_venture_records
    where owner_user_id = v_user
      and id = v_venture_id
      and opportunity_id = v_opportunity_id
      and family = v_family
  ) then
    raise exception 'commercial work order venture does not match canonical opportunity';
  end if;

  select * into v_existing
  from public.jhadina_side_hustle_work_orders
  where user_id = v_user and id = v_id
  for update;
  v_has_existing := found;

  if not v_has_existing and v_status <> 'draft' then
    raise exception 'new commercial work order must start as draft';
  end if;

  if v_has_existing then
    if v_existing.opportunity_id <> v_opportunity_id
       or v_existing.family <> v_family
       or v_existing.customer_ref <> v_customer_ref
       or coalesce(v_existing.venture_id,'') <> coalesce(v_venture_id,'')
       or v_existing.payload->'scopeItems' is distinct from p_work_order->'scopeItems'
       or v_existing.payload->'acceptanceCriteria' is distinct from p_work_order->'acceptanceCriteria'
       or v_existing.payload->'price' is distinct from p_work_order->'price'
       or v_existing.payload->'executionOwners' is distinct from p_work_order->'executionOwners'
       or v_existing.payload->>'createdAt' is distinct from p_work_order->>'createdAt'
    then
      raise exception 'commercial work order immutable scope or identity cannot be rewritten';
    end if;

    if not (
      (v_existing.status = 'draft' and v_status = 'scope_locked')
      or (v_existing.status = 'scope_locked' and v_status = 'delivery_in_progress')
      or (v_existing.status = 'revision_required' and v_status = 'delivery_in_progress')
      or (v_existing.status = 'delivery_in_progress' and v_status = 'delivered')
      or (v_existing.status = 'delivered' and v_status in ('accepted','revision_required','cancelled'))
      or (v_existing.status = v_status and v_existing.payload = p_work_order)
    ) then
      raise exception 'commercial work order state transition is invalid';
    end if;
  end if;

  if v_status <> 'draft' and coalesce(p_work_order->>'scopeLockedAt','') = '' then
    raise exception 'scope-locked commercial work order requires scopeLockedAt';
  end if;
  if v_status in ('delivery_in_progress','delivered','revision_required','accepted','cancelled')
     and coalesce(p_work_order->>'startedAt','') = '' then
    raise exception 'commercial delivery state requires startedAt';
  end if;
  if v_status in ('delivered','revision_required','accepted','cancelled')
     and coalesce(p_work_order->>'deliveredAt','') = '' then
    raise exception 'delivered commercial state requires deliveredAt';
  end if;
  if v_status = 'accepted' and coalesce(p_work_order->>'acceptedAt','') = '' then
    raise exception 'accepted commercial work order requires acceptedAt';
  end if;

  insert into public.jhadina_side_hustle_work_orders (
    user_id,id,opportunity_id,venture_id,family,customer_ref,status,
    amount,currency,payload,created_at,updated_at
  ) values (
    v_user,v_id,v_opportunity_id,v_venture_id,v_family,v_customer_ref,v_status,
    v_amount,upper(v_currency),p_work_order,v_created_at,v_updated_at
  )
  on conflict (user_id,id) do update
    set status = excluded.status,
        payload = excluded.payload,
        updated_at = excluded.updated_at
  returning payload into p_work_order;

  return p_work_order;
end;
$$;

create or replace function public.jhadina_side_hustle_commercial_receipt_record(
  p_record jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id text := p_record->>'id';
  v_work_order_id text := nullif(p_record->>'workOrderId','');
  v_opportunity_id text := nullif(p_record->>'opportunityId','');
  v_family text := p_record->>'family';
  v_kind text := p_record->>'kind';
  v_evidence_refs jsonb := p_record->'evidenceRefs';
  v_payload jsonb := p_record->'payload';
  v_recorded_at timestamptz := nullif(p_record->>'recordedAt','')::timestamptz;
  v_existing public.jhadina_side_hustle_commercial_receipts%rowtype;
  v_work_order public.jhadina_side_hustle_work_orders%rowtype;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_record) <> 'object' then raise exception 'commercial receipt record must be an object'; end if;
  if coalesce(v_id,'') = '' or coalesce(v_family,'') = '' then
    raise exception 'commercial receipt id and family are required';
  end if;
  if v_kind not in ('delivery_start','delivery','acceptance','routing','outcome_bridge','certification') then
    raise exception 'commercial receipt kind is invalid';
  end if;
  if jsonb_typeof(v_payload) <> 'object' then raise exception 'commercial receipt payload must be an object'; end if;
  if v_recorded_at is null then raise exception 'commercial receipt recordedAt is required'; end if;
  if jsonb_typeof(v_evidence_refs) <> 'array'
     or jsonb_array_length(v_evidence_refs) = 0
     or exists (
       select 1 from jsonb_array_elements(v_evidence_refs) value
       where jsonb_typeof(value) <> 'string' or btrim(value #>> '{}') = ''
     ) then
    raise exception 'commercial receipt evidenceRefs must contain non-empty strings';
  end if;

  if coalesce((v_payload->>'externalActionAuthorized')::boolean,false) is true
     or coalesce((v_payload->>'paymentAuthorized')::boolean,false) is true
     or coalesce((v_payload->>'moneyMovementAuthorized')::boolean,false) is true
     or coalesce((v_payload->>'assignmentAuthorized')::boolean,false) is true
     or coalesce((v_payload->>'automaticMaturityPromotionAuthorized')::boolean,false) is true then
    raise exception 'commercial receipt cannot grant execution, payment, assignment, or maturity authority';
  end if;

  if v_kind <> 'certification' and v_work_order_id is null then
    raise exception 'commercial receipt requires workOrderId';
  end if;

  if v_work_order_id is not null then
    select * into v_work_order
    from public.jhadina_side_hustle_work_orders
    where user_id = v_user and id = v_work_order_id;
    if not found then raise exception 'commercial work order not found'; end if;
    if v_work_order.family <> v_family then raise exception 'commercial receipt family mismatch'; end if;
    if v_opportunity_id is null then v_opportunity_id := v_work_order.opportunity_id; end if;
    if v_opportunity_id <> v_work_order.opportunity_id then
      raise exception 'commercial receipt opportunity mismatch';
    end if;
  end if;

  if v_opportunity_id is not null and not exists (
    select 1 from public.jhadina_opportunities
    where user_id = v_user and id = v_opportunity_id
  ) then
    raise exception 'commercial receipt opportunity not found';
  end if;

  select * into v_existing
  from public.jhadina_side_hustle_commercial_receipts
  where user_id = v_user and id = v_id;

  if found then
    if v_existing.kind <> v_kind
       or coalesce(v_existing.work_order_id,'') <> coalesce(v_work_order_id,'')
       or coalesce(v_existing.opportunity_id,'') <> coalesce(v_opportunity_id,'')
       or v_existing.family <> v_family
       or v_existing.evidence_refs <> v_evidence_refs
       or v_existing.payload <> v_payload
       or v_existing.recorded_at <> v_recorded_at then
      raise exception 'commercial receipt id already exists with different evidence';
    end if;
    return v_existing.payload;
  end if;

  insert into public.jhadina_side_hustle_commercial_receipts (
    user_id,id,work_order_id,opportunity_id,family,kind,evidence_refs,payload,recorded_at
  ) values (
    v_user,v_id,v_work_order_id,v_opportunity_id,v_family,v_kind,v_evidence_refs,v_payload,v_recorded_at
  );

  return v_payload;
end;
$$;

revoke all on function public.jhadina_side_hustle_work_order_save(jsonb) from public;
revoke all on function public.jhadina_side_hustle_commercial_receipt_record(jsonb) from public;
grant execute on function public.jhadina_side_hustle_work_order_save(jsonb) to authenticated;
grant execute on function public.jhadina_side_hustle_commercial_receipt_record(jsonb) to authenticated;
