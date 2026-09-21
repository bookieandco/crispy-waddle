-- GROWTH-PROD hardening over the applied 20260921212651/20260921213205 baseline.
-- This migration is additive and preserves the growth_private -> public invoker architecture.

alter table public.jhadina_growth_customer_events
  add column if not exists event_key text,
  add column if not exists brand_id text;

update public.jhadina_growth_customer_events e
set event_key = coalesce(e.event_key, 'legacy:' || e.id::text),
    brand_id = coalesce(e.brand_id, c.brand_id)
from public.jhadina_growth_customers c
where c.id = e.customer_id
  and (e.event_key is null or e.brand_id is null);

alter table public.jhadina_growth_customer_events
  alter column event_key set not null,
  alter column brand_id set not null;

create unique index if not exists jhadina_growth_customer_event_idempotency_idx
  on public.jhadina_growth_customer_events(user_id, source, event_key);

alter table public.jhadina_growth_provider_observations
  add column if not exists observation_key text;

update public.jhadina_growth_provider_observations
set observation_key = coalesce(observation_key, 'legacy:' || id::text)
where observation_key is null;

alter table public.jhadina_growth_provider_observations
  alter column observation_key set not null;

create unique index if not exists jhadina_growth_provider_observation_idempotency_idx
  on public.jhadina_growth_provider_observations(user_id, source, observation_key);

alter table public.jhadina_growth_lifecycle_proposals
  add column if not exists capability text not null default 'consequential.outreach',
  add column if not exists requires_approval boolean not null default true,
  add column if not exists idempotency_key text;

update public.jhadina_growth_lifecycle_proposals
set idempotency_key = coalesce(idempotency_key, 'legacy:' || id::text)
where idempotency_key is null;

alter table public.jhadina_growth_lifecycle_proposals
  alter column idempotency_key set not null;

alter table public.jhadina_growth_lifecycle_proposals
  add constraint jhadina_growth_lifecycle_capability_guard
  check (capability = 'consequential.outreach');

alter table public.jhadina_growth_lifecycle_proposals
  add constraint jhadina_growth_lifecycle_approval_guard
  check (requires_approval = true);

create unique index if not exists jhadina_growth_lifecycle_idempotency_idx
  on public.jhadina_growth_lifecycle_proposals(user_id, idempotency_key);

create or replace function growth_private.create_paid_campaign(
  p_action_id text,
  p_brand_id text,
  p_name text,
  p_objective text,
  p_channel text,
  p_provider text,
  p_provider_account_id text,
  p_audience_ids jsonb,
  p_creative_ids jsonb,
  p_landing_page_id text,
  p_currency text,
  p_daily_budget_minor bigint,
  p_lifetime_budget_minor bigint,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_request_fingerprint text,
  p_idempotency_key text
)
returns public.jhadina_growth_paid_campaigns
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.jhadina_growth_paid_campaigns;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if nullif(trim(p_action_id),'') is null
    or nullif(trim(p_brand_id),'') is null
    or nullif(trim(p_name),'') is null
    or nullif(trim(p_objective),'') is null
    or nullif(trim(p_provider),'') is null
    or nullif(trim(p_provider_account_id),'') is null
    or nullif(trim(p_request_fingerprint),'') is null
    or nullif(trim(p_idempotency_key),'') is null
  then raise exception 'GROWTH_PAID_REQUIRED_FIELDS_MISSING'; end if;
  if p_daily_budget_minor <= 0 then raise exception 'GROWTH_PAID_DAILY_BUDGET_INVALID'; end if;
  if p_lifetime_budget_minor is not null and p_lifetime_budget_minor < p_daily_budget_minor then
    raise exception 'GROWTH_PAID_LIFETIME_BUDGET_INVALID';
  end if;
  if p_currency !~ '^[A-Z]{3}$' then raise exception 'GROWTH_PAID_CURRENCY_INVALID'; end if;
  if jsonb_typeof(p_audience_ids) <> 'array' or jsonb_array_length(p_audience_ids)=0 then
    raise exception 'GROWTH_PAID_AUDIENCE_REQUIRED';
  end if;
  if jsonb_typeof(p_creative_ids) <> 'array' or jsonb_array_length(p_creative_ids)=0 then
    raise exception 'GROWTH_PAID_CREATIVE_REQUIRED';
  end if;
  if jsonb_array_length(p_audience_ids) <> (
    select count(distinct value) from jsonb_array_elements_text(p_audience_ids)
  ) then raise exception 'GROWTH_PAID_DUPLICATE_AUDIENCE'; end if;
  if jsonb_array_length(p_creative_ids) <> (
    select count(distinct value) from jsonb_array_elements_text(p_creative_ids)
  ) then raise exception 'GROWTH_PAID_DUPLICATE_CREATIVE'; end if;

  select * into v_row
  from public.jhadina_growth_paid_campaigns
  where user_id=v_user and idempotency_key=p_idempotency_key;

  if v_row.id is not null then
    if v_row.request_fingerprint <> p_request_fingerprint then
      raise exception 'GROWTH_IDEMPOTENCY_CONFLICT';
    end if;
    return v_row;
  end if;

  insert into public.jhadina_growth_paid_campaigns(
    user_id,action_id,brand_id,name,objective,channel,provider,provider_account_id,
    audience_ids,creative_ids,landing_page_id,currency,daily_budget_minor,lifetime_budget_minor,
    starts_at,ends_at,request_fingerprint,idempotency_key
  ) values (
    v_user,p_action_id,trim(p_brand_id),trim(p_name),trim(p_objective),p_channel,trim(p_provider),trim(p_provider_account_id),
    p_audience_ids,p_creative_ids,p_landing_page_id,p_currency,p_daily_budget_minor,p_lifetime_budget_minor,
    p_starts_at,p_ends_at,p_request_fingerprint,p_idempotency_key
  )
  returning * into v_row;
  return v_row;
end $$;

create or replace function growth_private.request_paid_approval(
  p_campaign_id uuid, p_action_id text, p_fingerprint text, p_expires_at timestamptz
)
returns public.jhadina_growth_approval_receipts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_campaign public.jhadina_growth_paid_campaigns;
  v_receipt public.jhadina_growth_approval_receipts;
  v_expected text;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_expires_at <= now() then raise exception 'GROWTH_APPROVAL_EXPIRY_INVALID'; end if;

  select * into v_campaign
  from public.jhadina_growth_paid_campaigns
  where id=p_campaign_id and user_id=v_user;

  if v_campaign.id is null then raise exception 'GROWTH_PAID_CAMPAIGN_NOT_FOUND'; end if;
  if v_campaign.status <> 'pending_approval' then raise exception 'GROWTH_PAID_CAMPAIGN_NOT_AWAITING_APPROVAL'; end if;

  v_expected := 'growth-paid-publish:v1:' || v_campaign.id::text || ':' || v_campaign.request_fingerprint;
  if p_fingerprint <> v_expected then raise exception 'GROWTH_APPROVAL_FINGERPRINT_MISMATCH'; end if;
  if p_action_id <> v_campaign.action_id then raise exception 'GROWTH_APPROVAL_ACTION_MISMATCH'; end if;

  if v_campaign.approval_receipt_id is not null then
    select * into v_receipt
    from public.jhadina_growth_approval_receipts
    where id=v_campaign.approval_receipt_id and user_id=v_user;
    if v_receipt.id is not null then return v_receipt; end if;
  end if;

  insert into public.jhadina_growth_approval_receipts(
    user_id,campaign_id,action_id,type,fingerprint,expires_at
  ) values (
    v_user,v_campaign.id,p_action_id,'paid-ad.publish',p_fingerprint,p_expires_at
  )
  returning * into v_receipt;

  update public.jhadina_growth_paid_campaigns
  set approval_receipt_id=v_receipt.id,updated_at=now()
  where id=v_campaign.id and user_id=v_user;

  return v_receipt;
end $$;

create or replace function growth_private.enqueue_paid_campaign(p_campaign_id uuid)
returns public.jhadina_growth_paid_outbox
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_campaign public.jhadina_growth_paid_campaigns;
  v_receipt public.jhadina_growth_approval_receipts;
  v_row public.jhadina_growth_paid_outbox;
  v_expected text;
begin
  if v_user is null then raise exception 'authentication required'; end if;

  select * into v_campaign
  from public.jhadina_growth_paid_campaigns
  where id=p_campaign_id and user_id=v_user;

  if v_campaign.id is null then raise exception 'GROWTH_PAID_CAMPAIGN_NOT_FOUND'; end if;

  select * into v_row
  from public.jhadina_growth_paid_outbox
  where user_id=v_user and campaign_id=v_campaign.id;
  if v_row.id is not null then return v_row; end if;

  if v_campaign.status <> 'approved' or v_campaign.approval_receipt_id is null then
    raise exception 'GROWTH_CONSUMED_APPROVAL_REQUIRED';
  end if;

  select * into v_receipt
  from public.jhadina_growth_approval_receipts
  where id=v_campaign.approval_receipt_id
    and user_id=v_user
    and campaign_id=v_campaign.id;

  v_expected := 'growth-paid-publish:v1:' || v_campaign.id::text || ':' || v_campaign.request_fingerprint;
  if v_receipt.id is null
    or v_receipt.status <> 'consumed'
    or v_receipt.type <> 'paid-ad.publish'
    or v_receipt.action_id <> v_campaign.action_id
    or v_receipt.fingerprint <> v_expected
  then raise exception 'GROWTH_CONSUMED_APPROVAL_REQUIRED'; end if;

  insert into public.jhadina_growth_paid_outbox(
    user_id,campaign_id,approval_receipt_id,provider,channel,provider_account_id,
    operation_intent,payload,request_fingerprint,idempotency_key
  ) values (
    v_user,v_campaign.id,v_receipt.id,v_campaign.provider,v_campaign.channel,v_campaign.provider_account_id,
    'create_paused_campaign',
    jsonb_build_object(
      'campaignId',v_campaign.id,
      'brandId',v_campaign.brand_id,
      'name',v_campaign.name,
      'objective',v_campaign.objective,
      'channel',v_campaign.channel,
      'provider',v_campaign.provider,
      'providerAccountId',v_campaign.provider_account_id,
      'audienceIds',v_campaign.audience_ids,
      'creativeIds',v_campaign.creative_ids,
      'landingPageId',v_campaign.landing_page_id,
      'currency',v_campaign.currency,
      'dailyBudgetMinor',v_campaign.daily_budget_minor,
      'lifetimeBudgetMinor',v_campaign.lifetime_budget_minor,
      'startsAt',v_campaign.starts_at,
      'endsAt',v_campaign.ends_at
    ),
    v_campaign.request_fingerprint,
    v_campaign.id::text || ':' || v_campaign.channel || ':' || v_campaign.provider_account_id
  )
  returning * into v_row;

  update public.jhadina_growth_paid_campaigns
  set status='queued',updated_at=now()
  where id=v_campaign.id and user_id=v_user and status='approved';

  return v_row;
end $$;

create or replace function growth_private.resolve_paid_outbox(
  p_outbox_id uuid,
  p_status text,
  p_provider_operation_id text default null,
  p_provider_campaign_id text default null,
  p_error text default null
)
returns public.jhadina_growth_paid_outbox
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.jhadina_growth_paid_outbox;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_status not in ('delivered','failed','ambiguous') then
    raise exception 'GROWTH_PAID_OUTBOX_RESOLUTION_INVALID';
  end if;
  if p_status='delivered' and nullif(trim(p_provider_campaign_id),'') is null then
    raise exception 'GROWTH_PAID_PROVIDER_CAMPAIGN_ID_REQUIRED';
  end if;

  update public.jhadina_growth_paid_outbox
  set status=p_status,
      provider_operation_id=coalesce(p_provider_operation_id,provider_operation_id),
      provider_campaign_id=coalesce(p_provider_campaign_id,provider_campaign_id),
      last_error=p_error,
      updated_at=now()
  where id=p_outbox_id and user_id=v_user and status='attempting'
  returning * into v_row;

  if v_row.id is null then raise exception 'GROWTH_PAID_OUTBOX_NOT_RESOLVABLE'; end if;

  update public.jhadina_growth_paid_campaigns
  set status=p_status,
      provider_campaign_id=coalesce(p_provider_campaign_id,provider_campaign_id),
      last_error=p_error,
      updated_at=now()
  where id=v_row.campaign_id and user_id=v_user;

  return v_row;
end $$;

create or replace function growth_private.record_customer_event(
  p_event_key text,
  p_brand_id text,
  p_customer_key text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_source text,
  p_product_id text default null,
  p_value numeric default null,
  p_currency text default null,
  p_confidence numeric default 0.7,
  p_evidence jsonb default '{}'::jsonb
)
returns public.jhadina_growth_customer_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_customer public.jhadina_growth_customers;
  v_event public.jhadina_growth_customer_events;
  v_purchase_count integer;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if nullif(trim(p_event_key),'') is null
    or nullif(trim(p_brand_id),'') is null
    or nullif(trim(p_customer_key),'') is null
    or nullif(trim(p_event_type),'') is null
    or nullif(trim(p_source),'') is null
  then raise exception 'GROWTH_CUSTOMER_EVENT_REQUIRED_FIELDS_MISSING'; end if;
  if p_confidence < 0 or p_confidence > 1 then raise exception 'confidence out of range'; end if;

  select * into v_event
  from public.jhadina_growth_customer_events
  where user_id=v_user and source=p_source and event_key=p_event_key;
  if v_event.id is not null then return v_event; end if;

  insert into public.jhadina_growth_customers(
    user_id,brand_id,customer_key,first_seen_at,last_seen_at
  ) values (
    v_user,trim(p_brand_id),trim(p_customer_key),p_occurred_at,p_occurred_at
  )
  on conflict(user_id,brand_id,customer_key)
  do update set
    first_seen_at=least(public.jhadina_growth_customers.first_seen_at,excluded.first_seen_at),
    last_seen_at=greatest(public.jhadina_growth_customers.last_seen_at,excluded.last_seen_at),
    updated_at=now()
  returning * into v_customer;

  insert into public.jhadina_growth_customer_events(
    user_id,event_key,brand_id,customer_id,event_type,product_id,value,currency,
    source,confidence,occurred_at,evidence
  ) values (
    v_user,p_event_key,v_customer.brand_id,v_customer.id,p_event_type,p_product_id,p_value,
    case when p_currency is null then null else upper(p_currency) end,
    p_source,p_confidence,p_occurred_at,coalesce(p_evidence,'{}'::jsonb)
  )
  on conflict(user_id,source,event_key)
  do update set event_key=excluded.event_key
  returning * into v_event;

  if p_event_type='purchase' then
    select count(*) into v_purchase_count
    from public.jhadina_growth_customer_events
    where user_id=v_user and customer_id=v_customer.id and event_type='purchase';

    update public.jhadina_growth_customers
    set lifecycle_stage=case when v_purchase_count >= 2 then 'repeat_customer' else 'customer' end,
        updated_at=now()
    where id=v_customer.id and user_id=v_user;
  end if;

  return v_event;
end $$;

create or replace function public.jhadina_growth_record_customer_event(
  p_event_key text,
  p_brand_id text,
  p_customer_key text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_source text,
  p_product_id text default null,
  p_value numeric default null,
  p_currency text default null,
  p_confidence numeric default 0.7,
  p_evidence jsonb default '{}'::jsonb
)
returns public.jhadina_growth_customer_events
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.record_customer_event(
    p_event_key,p_brand_id,p_customer_key,p_event_type,p_occurred_at,p_source,
    p_product_id,p_value,p_currency,p_confidence,p_evidence
  )
$$;

create or replace function growth_private.record_provider_observation(
  p_observation_key text,
  p_campaign_id uuid,
  p_source text,
  p_observed_at timestamptz,
  p_metrics jsonb,
  p_evidence jsonb,
  p_confidence numeric default 0.5
)
returns public.jhadina_growth_provider_observations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.jhadina_growth_provider_observations;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if nullif(trim(p_observation_key),'') is null or nullif(trim(p_source),'') is null then
    raise exception 'GROWTH_PROVIDER_OBSERVATION_REQUIRED_FIELDS_MISSING';
  end if;
  if p_confidence < 0 or p_confidence > 1 then raise exception 'confidence out of range'; end if;
  if not exists(
    select 1 from public.jhadina_growth_paid_campaigns
    where id=p_campaign_id and user_id=v_user
  ) then raise exception 'GROWTH_PAID_CAMPAIGN_NOT_FOUND'; end if;

  select * into v_row
  from public.jhadina_growth_provider_observations
  where user_id=v_user and source=p_source and observation_key=p_observation_key;
  if v_row.id is not null then return v_row; end if;

  insert into public.jhadina_growth_provider_observations(
    user_id,observation_key,campaign_id,source,observed_at,metrics,evidence,confidence
  ) values (
    v_user,p_observation_key,p_campaign_id,p_source,p_observed_at,
    coalesce(p_metrics,'{}'::jsonb),coalesce(p_evidence,'{}'::jsonb),p_confidence
  )
  on conflict(user_id,source,observation_key)
  do update set observation_key=excluded.observation_key
  returning * into v_row;

  return v_row;
end $$;

create or replace function public.jhadina_growth_record_provider_observation(
  p_observation_key text,
  p_campaign_id uuid,
  p_source text,
  p_observed_at timestamptz,
  p_metrics jsonb,
  p_evidence jsonb,
  p_confidence numeric default 0.5
)
returns public.jhadina_growth_provider_observations
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.record_provider_observation(
    p_observation_key,p_campaign_id,p_source,p_observed_at,p_metrics,p_evidence,p_confidence
  )
$$;

create or replace function growth_private.propose_lifecycle_action(
  p_customer_id uuid,
  p_action text,
  p_channel text,
  p_rationale text,
  p_idempotency_key text
)
returns public.jhadina_growth_lifecycle_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.jhadina_growth_lifecycle_proposals;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'GROWTH_LIFECYCLE_IDEMPOTENCY_REQUIRED'; end if;
  if not exists(
    select 1 from public.jhadina_growth_customers where id=p_customer_id and user_id=v_user
  ) then raise exception 'GROWTH_CUSTOMER_NOT_FOUND'; end if;

  select * into v_row
  from public.jhadina_growth_lifecycle_proposals
  where user_id=v_user and idempotency_key=p_idempotency_key;
  if v_row.id is not null then return v_row; end if;

  insert into public.jhadina_growth_lifecycle_proposals(
    user_id,customer_id,action,channel,rationale,status,capability,requires_approval,idempotency_key
  ) values (
    v_user,p_customer_id,p_action,p_channel,trim(p_rationale),'draft',
    'consequential.outreach',true,p_idempotency_key
  )
  returning * into v_row;

  return v_row;
end $$;

create or replace function public.jhadina_growth_propose_lifecycle_action(
  p_customer_id uuid,
  p_action text,
  p_channel text,
  p_rationale text,
  p_idempotency_key text
)
returns public.jhadina_growth_lifecycle_proposals
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.propose_lifecycle_action(
    p_customer_id,p_action,p_channel,p_rationale,p_idempotency_key
  )
$$;

create or replace function public.jhadina_growth_runtime_health()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'schemaVersion','GROWTH-PROD-v2',
    'ready',
      to_regclass('public.jhadina_growth_customers') is not null
      and to_regclass('public.jhadina_growth_customer_events') is not null
      and to_regclass('public.jhadina_growth_audiences') is not null
      and to_regclass('public.jhadina_growth_audience_memberships') is not null
      and to_regclass('public.jhadina_growth_paid_campaigns') is not null
      and to_regclass('public.jhadina_growth_approval_receipts') is not null
      and to_regclass('public.jhadina_growth_paid_outbox') is not null
      and to_regclass('public.jhadina_growth_provider_observations') is not null
      and to_regclass('public.jhadina_growth_lifecycle_proposals') is not null,
    'eventIdempotencyReady',
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='jhadina_growth_customer_events' and column_name='event_key'),
    'providerObservationIdempotencyReady',
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='jhadina_growth_provider_observations' and column_name='observation_key'),
    'lifecycleApprovalMetadataReady',
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='jhadina_growth_lifecycle_proposals' and column_name='requires_approval'),
    'socialSchemaReady',
      to_regclass('public.jhadina_social_accounts') is not null
      and to_regclass('public.jhadina_social_publication_proposals') is not null
      and to_regclass('public.jhadina_social_outbox') is not null
  )
$$;

revoke execute on function growth_private.record_customer_event(text,text,text,timestamptz,text,text,numeric,text,numeric,jsonb) from authenticated;
revoke execute on function public.jhadina_growth_record_customer_event(text,text,text,timestamptz,text,text,numeric,text,numeric,jsonb) from authenticated;
revoke execute on function growth_private.record_provider_observation(uuid,text,timestamptz,jsonb,jsonb,numeric) from authenticated;
revoke execute on function public.jhadina_growth_record_provider_observation(uuid,text,timestamptz,jsonb,jsonb,numeric) from authenticated;
revoke execute on function growth_private.propose_lifecycle_action(uuid,text,text,text) from authenticated;
revoke execute on function public.jhadina_growth_propose_lifecycle_action(uuid,text,text,text) from authenticated;

revoke all on function growth_private.record_customer_event(text,text,text,text,timestamptz,text,text,numeric,text,numeric,jsonb) from public;
revoke all on function growth_private.record_provider_observation(text,uuid,text,timestamptz,jsonb,jsonb,numeric) from public;
revoke all on function growth_private.propose_lifecycle_action(uuid,text,text,text,text) from public;

grant execute on function growth_private.record_customer_event(text,text,text,text,timestamptz,text,text,numeric,text,numeric,jsonb) to authenticated;
grant execute on function growth_private.record_provider_observation(text,uuid,text,timestamptz,jsonb,jsonb,numeric) to authenticated;
grant execute on function growth_private.propose_lifecycle_action(uuid,text,text,text,text) to authenticated;

revoke execute on function public.jhadina_growth_record_customer_event(text,text,text,text,timestamptz,text,text,numeric,text,numeric,jsonb) from public, anon;
revoke execute on function public.jhadina_growth_record_provider_observation(text,uuid,text,timestamptz,jsonb,jsonb,numeric) from public, anon;
revoke execute on function public.jhadina_growth_propose_lifecycle_action(uuid,text,text,text,text) from public, anon;
revoke execute on function public.jhadina_growth_runtime_health() from public;

grant execute on function public.jhadina_growth_record_customer_event(text,text,text,text,timestamptz,text,text,numeric,text,numeric,jsonb) to authenticated;
grant execute on function public.jhadina_growth_record_provider_observation(text,uuid,text,timestamptz,jsonb,jsonb,numeric) to authenticated;
grant execute on function public.jhadina_growth_propose_lifecycle_action(uuid,text,text,text,text) to authenticated;
grant execute on function public.jhadina_growth_runtime_health() to anon, authenticated;
