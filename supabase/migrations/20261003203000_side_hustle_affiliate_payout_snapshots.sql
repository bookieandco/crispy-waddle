-- AFFILIATE-PAYOUT-TRUTH.1 — durable cumulative payout balance snapshots.
-- Stores provider-reported read-only payout balances for commerce_affiliate Opportunities.
-- The first observation for an account/currency is a baseline. Application logic may
-- recognize only positive movement above the historical cumulative-paid high-water mark.
-- This table/function never authorizes withdrawals, payments, transfers, or external actions.

create table if not exists public.jhadina_affiliate_payout_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  opportunity_id text not null,
  provider text not null,
  account_ref text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id,id),
  foreign key (user_id,opportunity_id)
    references public.jhadina_opportunities(user_id,id) on delete cascade
);

create index if not exists jhadina_affiliate_payout_snapshots_lookup_idx
  on public.jhadina_affiliate_payout_snapshots
  (user_id,opportunity_id,provider,account_ref,observed_at desc);

alter table public.jhadina_affiliate_payout_snapshots enable row level security;

drop policy if exists "jhadina_affiliate_payout_snapshots_select_own"
  on public.jhadina_affiliate_payout_snapshots;
create policy "jhadina_affiliate_payout_snapshots_select_own"
  on public.jhadina_affiliate_payout_snapshots
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.jhadina_affiliate_payout_snapshots from public,anon;
revoke insert,update,delete on public.jhadina_affiliate_payout_snapshots from authenticated;
grant select on public.jhadina_affiliate_payout_snapshots to authenticated;
grant select,insert,update,delete on public.jhadina_affiliate_payout_snapshots to service_role;

create or replace function public.jhadina_affiliate_payout_snapshot_record(
  p_record jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id text := nullif(btrim(p_record->>'id'),'');
  v_opportunity_id text := nullif(btrim(p_record->>'opportunityId'),'');
  v_provider text := nullif(btrim(p_record->>'provider'),'');
  v_account_ref text := nullif(btrim(p_record->>'accountRef'),'');
  v_snapshot jsonb := p_record->'snapshot';
  v_paid_high_water jsonb := p_record->'paidHighWater';
  v_recognized_payout jsonb := p_record->'recognizedPayoutSinceBaseline';
  v_observed_at timestamptz;
  v_snapshot_observed_at timestamptz;
  v_family text;
  v_balance_count integer;
  v_distinct_currency_count integer;
  v_existing public.jhadina_affiliate_payout_snapshots%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  if jsonb_typeof(p_record) <> 'object' then
    raise exception 'affiliate payout record must be an object';
  end if;

  if v_id is null
     or v_opportunity_id is null
     or v_provider is null
     or v_account_ref is null then
    raise exception 'affiliate payout record identity is required';
  end if;

  begin
    v_observed_at := nullif(p_record->>'observedAt','')::timestamptz;
    v_snapshot_observed_at := nullif(v_snapshot->>'observedAt','')::timestamptz;
  exception when others then
    raise exception 'affiliate payout observedAt is invalid';
  end;

  if v_observed_at is null then
    raise exception 'affiliate payout observedAt is required';
  end if;

  if coalesce(jsonb_typeof(v_snapshot),'') <> 'object' then
    raise exception 'affiliate payout snapshot is required';
  end if;

  if coalesce(v_snapshot->>'provider','') <> v_provider
     or coalesce(v_snapshot->>'accountRef','') <> v_account_ref then
    raise exception 'affiliate payout snapshot identity mismatch';
  end if;

  if coalesce(v_snapshot->>'sourceSemantics','') <> 'CUMULATIVE_PROVIDER_BALANCES' then
    raise exception 'affiliate payout source semantics are invalid';
  end if;

  if v_snapshot_observed_at is distinct from v_observed_at then
    raise exception 'affiliate payout snapshot observedAt mismatch';
  end if;

  if coalesce((v_snapshot->>'readOnly')::boolean,false) is not true then
    raise exception 'affiliate payout snapshot must be read-only';
  end if;

  if coalesce(jsonb_typeof(v_snapshot->'evidenceRefs'),'') <> 'array'
     or jsonb_array_length(v_snapshot->'evidenceRefs') = 0
     or exists (
       select 1
       from jsonb_array_elements(v_snapshot->'evidenceRefs') as evidence(item)
       where jsonb_typeof(evidence.item) <> 'string'
          or btrim(evidence.item #>> '{}') = ''
     ) then
    raise exception 'affiliate payout snapshot evidenceRefs are invalid';
  end if;

  if coalesce(jsonb_typeof(v_paid_high_water),'') <> 'object' then
    raise exception 'affiliate payout paidHighWater must be an object';
  end if;

  if exists (
    select 1
    from jsonb_each(v_paid_high_water) as high_water(currency,value)
    where nullif(btrim(high_water.currency),'') is null
       or jsonb_typeof(high_water.value) <> 'number'
       or (high_water.value #>> '{}')::numeric < 0
  ) then
    raise exception 'affiliate payout paidHighWater is invalid';
  end if;

  if coalesce(jsonb_typeof(v_recognized_payout),'') <> 'object' then
    raise exception 'affiliate payout recognizedPayoutSinceBaseline must be an object';
  end if;

  if exists (
    select 1
    from jsonb_each(v_recognized_payout) as recognized(currency,value)
    where nullif(btrim(recognized.currency),'') is null
       or jsonb_typeof(recognized.value) <> 'number'
       or (recognized.value #>> '{}')::numeric < 0
  ) then
    raise exception 'affiliate payout recognizedPayoutSinceBaseline is invalid';
  end if;

  if coalesce(jsonb_typeof(v_snapshot->'balances'),'') <> 'array' then
    raise exception 'affiliate payout balances must be an array';
  end if;

  select
    jsonb_array_length(v_snapshot->'balances'),
    count(distinct upper(btrim(balance.value->>'currency')))
  into v_balance_count,v_distinct_currency_count
  from jsonb_array_elements(v_snapshot->'balances') as balance(value);

  if v_balance_count <> v_distinct_currency_count then
    raise exception 'affiliate payout balances contain duplicate currencies';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_snapshot->'balances') as balance(value)
    where jsonb_typeof(balance.value) <> 'object'
       or nullif(btrim(balance.value->>'currency'),'') is null
       or jsonb_typeof(balance.value->'pending') <> 'number'
       or jsonb_typeof(balance.value->'approved') <> 'number'
       or jsonb_typeof(balance.value->'confirmed') <> 'number'
       or jsonb_typeof(balance.value->'available') <> 'number'
       or jsonb_typeof(balance.value->'paid') <> 'number'
       or (balance.value->>'pending')::numeric < 0
       or (balance.value->>'approved')::numeric < 0
       or (balance.value->>'confirmed')::numeric < 0
       or (balance.value->>'available')::numeric < 0
       or (balance.value->>'paid')::numeric < 0
       or coalesce(
         (
           select (high_water.value #>> '{}')::numeric
           from jsonb_each(v_paid_high_water) as high_water(currency,value)
           where upper(btrim(high_water.currency))
             = upper(btrim(balance.value->>'currency'))
         ),
         -1
       ) < (balance.value->>'paid')::numeric
  ) then
    raise exception 'affiliate payout balances or paidHighWater are invalid';
  end if;

  if coalesce(p_record->>'authority','') <> 'AFFILIATE_PAYOUT_SNAPSHOT_ONLY' then
    raise exception 'affiliate payout snapshot authority is invalid';
  end if;

  if coalesce((p_record->>'externalActionAuthorized')::boolean,false) is true
     or coalesce((p_record->>'paymentAuthorized')::boolean,false) is true
     or coalesce((p_record->>'moneyMovementAuthorized')::boolean,false) is true
     or coalesce((v_snapshot->>'externalActionAuthorized')::boolean,false) is true
     or coalesce((v_snapshot->>'paymentAuthorized')::boolean,false) is true
     or coalesce((v_snapshot->>'moneyMovementAuthorized')::boolean,false) is true then
    raise exception 'affiliate payout snapshot cannot grant execution or money authority';
  end if;

  select payload->'metadata'->'sideHustleProfile'->>'family'
  into v_family
  from public.jhadina_opportunities
  where user_id = v_user
    and id = v_opportunity_id;

  if v_family is null then
    raise exception 'affiliate payout opportunity not found';
  end if;

  if v_family <> 'commerce_affiliate' then
    raise exception 'affiliate payout snapshot requires commerce_affiliate opportunity';
  end if;

  select *
  into v_existing
  from public.jhadina_affiliate_payout_snapshots
  where user_id = v_user
    and id = v_id;

  if found then
    if v_existing.opportunity_id <> v_opportunity_id
       or v_existing.provider <> v_provider
       or v_existing.account_ref <> v_account_ref
       or v_existing.payload <> p_record
       or v_existing.observed_at <> v_observed_at then
      raise exception 'affiliate payout snapshot is immutable';
    end if;
    return v_existing.payload;
  end if;

  insert into public.jhadina_affiliate_payout_snapshots(
    user_id,id,opportunity_id,provider,account_ref,payload,observed_at
  ) values (
    v_user,v_id,v_opportunity_id,v_provider,v_account_ref,p_record,v_observed_at
  )
  returning payload into p_record;

  return p_record;
end;
$$;

revoke all on function public.jhadina_affiliate_payout_snapshot_record(jsonb)
  from public,anon;
grant execute on function public.jhadina_affiliate_payout_snapshot_record(jsonb)
  to authenticated,service_role;
