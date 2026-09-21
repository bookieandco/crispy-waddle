-- GROWTH-PROD.1 production control plane.
-- Live production version: 20260921212651.
-- Customer identity is opaque to this schema; provider credentials are never stored here.
-- Direct client mutation is denied. Public RPCs are SECURITY INVOKER wrappers;
-- privileged mutations live in the non-exposed growth_private schema and enforce auth.uid().

create schema if not exists growth_private;
revoke all on schema growth_private from public;
grant usage on schema growth_private to authenticated;

create table if not exists public.jhadina_growth_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id text not null,
  customer_key text not null,
  lifecycle_stage text not null default 'prospect'
    check (lifecycle_stage in ('prospect','engaged','lead','customer','repeat_customer','at_risk','churned','vip')),
  acquisition_channel_id text,
  acquisition_campaign_id uuid,
  consent jsonb not null default '{}'::jsonb check (jsonb_typeof(consent)='object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, brand_id, customer_key)
);

create table if not exists public.jhadina_growth_customer_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.jhadina_growth_customers(id) on delete cascade,
  event_type text not null check (event_type in (
    'page_view','product_view','site_search','customization_started','add_to_cart',
    'checkout_started','purchase','email_click','sms_click','social_engagement',
    'social_dm','pricing_view','demo_request','form_submit','refund'
  )),
  product_id text,
  campaign_id uuid,
  value numeric,
  currency text,
  source text not null,
  confidence numeric not null default 0.7 check (confidence >= 0 and confidence <= 1),
  occurred_at timestamptz not null,
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  created_at timestamptz not null default now()
);

create table if not exists public.jhadina_growth_audiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id text not null,
  name text not null,
  kind text not null check (kind in ('seed','lookalike','intent','retargeting','suppression')),
  definition jsonb not null default '{}'::jsonb check (jsonb_typeof(definition)='object'),
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jhadina_growth_audience_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audience_id uuid not null references public.jhadina_growth_audiences(id) on delete cascade,
  customer_id uuid not null references public.jhadina_growth_customers(id) on delete cascade,
  score numeric not null check (score >= 0 and score <= 1),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  created_at timestamptz not null default now(),
  unique (audience_id, customer_id)
);

create table if not exists public.jhadina_growth_paid_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id text not null,
  brand_id text not null,
  name text not null,
  objective text not null,
  channel text not null check (channel in ('meta','google','tiktok','linkedin','reddit','microsoft','pinterest','snapchat','amazon','dv360')),
  provider text not null,
  provider_account_id text not null,
  audience_ids jsonb not null check (jsonb_typeof(audience_ids)='array'),
  creative_ids jsonb not null check (jsonb_typeof(creative_ids)='array'),
  landing_page_id text,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  daily_budget_minor bigint not null check (daily_budget_minor > 0),
  lifetime_budget_minor bigint check (lifetime_budget_minor is null or lifetime_budget_minor >= daily_budget_minor),
  starts_at timestamptz,
  ends_at timestamptz,
  request_fingerprint text not null,
  idempotency_key text not null,
  approval_receipt_id uuid,
  status text not null default 'pending_approval'
    check (status in ('pending_approval','approved','queued','attempting','delivered','failed','ambiguous','cancelled')),
  provider_campaign_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, action_id),
  unique (user_id, idempotency_key)
);

create table if not exists public.jhadina_growth_approval_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.jhadina_growth_paid_campaigns(id) on delete cascade,
  action_id text not null,
  type text not null,
  fingerprint text not null,
  status text not null default 'pending' check (status in ('pending','approved','consumed','expired')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  unique (user_id, action_id),
  unique (campaign_id)
);

alter table public.jhadina_growth_paid_campaigns
  add constraint jhadina_growth_paid_campaign_approval_fk
  foreign key (approval_receipt_id) references public.jhadina_growth_approval_receipts(id);

create table if not exists public.jhadina_growth_paid_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.jhadina_growth_paid_campaigns(id) on delete cascade,
  approval_receipt_id uuid not null references public.jhadina_growth_approval_receipts(id),
  provider text not null,
  channel text not null,
  provider_account_id text not null,
  operation_intent text not null default 'create_paused_campaign',
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  request_fingerprint text not null,
  idempotency_key text not null,
  status text not null default 'pending' check (status in ('pending','attempting','delivered','failed','ambiguous','cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_operation_id text,
  provider_campaign_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (campaign_id)
);

create table if not exists public.jhadina_growth_provider_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.jhadina_growth_paid_campaigns(id) on delete set null,
  customer_id uuid references public.jhadina_growth_customers(id) on delete set null,
  source text not null,
  observed_at timestamptz not null,
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics)='object'),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.jhadina_growth_lifecycle_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.jhadina_growth_customers(id) on delete cascade,
  action text not null check (action in ('educate','nurture','retarget','welcome','cross_sell','replenish','vip','win_back','suppress')),
  channel text,
  rationale text not null,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','sent','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_growth_customer_owner_idx on public.jhadina_growth_customers(user_id, brand_id, lifecycle_stage);
create index if not exists jhadina_growth_customer_events_idx on public.jhadina_growth_customer_events(user_id, customer_id, occurred_at desc);
create index if not exists jhadina_growth_audiences_idx on public.jhadina_growth_audiences(user_id, brand_id, kind, status);
create index if not exists jhadina_growth_audience_memberships_idx on public.jhadina_growth_audience_memberships(user_id, audience_id, score desc);
create index if not exists jhadina_growth_campaigns_idx on public.jhadina_growth_paid_campaigns(user_id, status, created_at desc);
create index if not exists jhadina_growth_outbox_idx on public.jhadina_growth_paid_outbox(user_id, status, updated_at);
create index if not exists jhadina_growth_observations_idx on public.jhadina_growth_provider_observations(user_id, campaign_id, observed_at desc);
create index if not exists jhadina_growth_lifecycle_idx on public.jhadina_growth_lifecycle_proposals(user_id, customer_id, status);

alter table public.jhadina_growth_customers enable row level security;
alter table public.jhadina_growth_customer_events enable row level security;
alter table public.jhadina_growth_audiences enable row level security;
alter table public.jhadina_growth_audience_memberships enable row level security;
alter table public.jhadina_growth_paid_campaigns enable row level security;
alter table public.jhadina_growth_approval_receipts enable row level security;
alter table public.jhadina_growth_paid_outbox enable row level security;
alter table public.jhadina_growth_provider_observations enable row level security;
alter table public.jhadina_growth_lifecycle_proposals enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'jhadina_growth_customers','jhadina_growth_customer_events','jhadina_growth_audiences',
    'jhadina_growth_audience_memberships','jhadina_growth_paid_campaigns','jhadina_growth_approval_receipts',
    'jhadina_growth_paid_outbox','jhadina_growth_provider_observations','jhadina_growth_lifecycle_proposals'
  ] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      'growth_owner_read_' || t, t
    );
  end loop;
end $$;

create or replace function growth_private.record_customer_event(
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
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if nullif(trim(p_brand_id),'') is null or nullif(trim(p_customer_key),'') is null then
    raise exception 'brand and customer key required';
  end if;
  if p_confidence < 0 or p_confidence > 1 then raise exception 'confidence out of range'; end if;

  insert into public.jhadina_growth_customers(user_id, brand_id, customer_key, last_seen_at)
  values(v_user, trim(p_brand_id), trim(p_customer_key), greatest(now(), p_occurred_at))
  on conflict(user_id, brand_id, customer_key)
  do update set
    last_seen_at = greatest(public.jhadina_growth_customers.last_seen_at, excluded.last_seen_at),
    updated_at = now()
  returning * into v_customer;

  insert into public.jhadina_growth_customer_events(
    user_id, customer_id, event_type, product_id, value, currency, source, confidence, occurred_at, evidence
  ) values (
    v_user, v_customer.id, p_event_type, p_product_id, p_value, p_currency,
    p_source, p_confidence, p_occurred_at, coalesce(p_evidence,'{}'::jsonb)
  )
  returning * into v_event;

  if p_event_type = 'purchase' then
    update public.jhadina_growth_customers
       set lifecycle_stage = case
         when lifecycle_stage in ('customer','repeat_customer','vip') then 'repeat_customer'
         else 'customer'
       end,
       updated_at = now()
     where id = v_customer.id and user_id = v_user;
  end if;

  return v_event;
end;
$$;

create or replace function public.jhadina_growth_record_customer_event(
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
    p_brand_id,p_customer_key,p_event_type,p_occurred_at,p_source,
    p_product_id,p_value,p_currency,p_confidence,p_evidence
  )
$$;

create or replace function growth_private.create_audience(
  p_brand_id text,
  p_name text,
  p_kind text,
  p_definition jsonb
)
returns public.jhadina_growth_audiences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.jhadina_growth_audiences;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  insert into public.jhadina_growth_audiences(user_id,brand_id,name,kind,definition)
  values(v_user,trim(p_brand_id),trim(p_name),p_kind,coalesce(p_definition,'{}'::jsonb))
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.jhadina_growth_create_audience(
  p_brand_id text,
  p_name text,
  p_kind text,
  p_definition jsonb
)
returns public.jhadina_growth_audiences
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.create_audience(p_brand_id,p_name,p_kind,p_definition)
$$;

create or replace function growth_private.add_audience_member(
  p_audience_id uuid,
  p_customer_id uuid,
  p_score numeric,
  p_evidence jsonb
)
returns public.jhadina_growth_audience_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.jhadina_growth_audience_memberships;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_score < 0 or p_score > 1 then raise exception 'score out of range'; end if;
  if not exists(select 1 from public.jhadina_growth_audiences where id=p_audience_id and user_id=v_user) then
    raise exception 'audience not found';
  end if;
  if not exists(select 1 from public.jhadina_growth_customers where id=p_customer_id and user_id=v_user) then
    raise exception 'customer not found';
  end if;

  insert into public.jhadina_growth_audience_memberships(user_id,audience_id,customer_id,score,evidence)
  values(v_user,p_audience_id,p_customer_id,p_score,coalesce(p_evidence,'{}'::jsonb))
  on conflict(audience_id,customer_id)
  do update set score=excluded.score,evidence=excluded.evidence
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.jhadina_growth_add_audience_member(
  p_audience_id uuid,
  p_customer_id uuid,
  p_score numeric,
  p_evidence jsonb
)
returns public.jhadina_growth_audience_memberships
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.add_audience_member(p_audience_id,p_customer_id,p_score,p_evidence)
$$;

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
  if p_daily_budget_minor <= 0 then raise exception 'daily budget invalid'; end if;
  if p_lifetime_budget_minor is not null and p_lifetime_budget_minor < p_daily_budget_minor then
    raise exception 'lifetime budget invalid';
  end if;
  if jsonb_typeof(p_audience_ids) <> 'array' or jsonb_array_length(p_audience_ids)=0 then
    raise exception 'audience required';
  end if;
  if jsonb_typeof(p_creative_ids) <> 'array' or jsonb_array_length(p_creative_ids)=0 then
    raise exception 'creative required';
  end if;

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
    v_user,p_action_id,trim(p_brand_id),trim(p_name),trim(p_objective),p_channel,p_provider,p_provider_account_id,
    p_audience_ids,p_creative_ids,p_landing_page_id,p_currency,p_daily_budget_minor,p_lifetime_budget_minor,
    p_starts_at,p_ends_at,p_request_fingerprint,p_idempotency_key
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.jhadina_growth_create_paid_campaign(
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
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.create_paid_campaign(
    p_action_id,p_brand_id,p_name,p_objective,p_channel,p_provider,p_provider_account_id,
    p_audience_ids,p_creative_ids,p_landing_page_id,p_currency,p_daily_budget_minor,
    p_lifetime_budget_minor,p_starts_at,p_ends_at,p_request_fingerprint,p_idempotency_key
  )
$$;

create or replace function growth_private.request_paid_approval(
  p_campaign_id uuid,
  p_action_id text,
  p_fingerprint text,
  p_expires_at timestamptz
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
  select * into v_campaign
    from public.jhadina_growth_paid_campaigns
   where id=p_campaign_id and user_id=v_user;

  if v_campaign.id is null then raise exception 'campaign not found'; end if;
  if v_campaign.status <> 'pending_approval' then raise exception 'campaign not awaiting approval'; end if;

  v_expected := 'growth-paid-publish:v1:' || v_campaign.id::text || ':' || v_campaign.request_fingerprint;
  if p_fingerprint <> v_expected then raise exception 'GROWTH_APPROVAL_FINGERPRINT_MISMATCH'; end if;
  if p_action_id <> v_campaign.action_id then raise exception 'GROWTH_APPROVAL_ACTION_MISMATCH'; end if;

  insert into public.jhadina_growth_approval_receipts(
    user_id,campaign_id,action_id,type,fingerprint,expires_at
  )
  values(v_user,v_campaign.id,p_action_id,'paid-ad.publish',p_fingerprint,p_expires_at)
  returning * into v_receipt;

  update public.jhadina_growth_paid_campaigns
     set approval_receipt_id=v_receipt.id,updated_at=now()
   where id=v_campaign.id and user_id=v_user;

  return v_receipt;
end;
$$;

create or replace function public.jhadina_growth_request_paid_approval(
  p_campaign_id uuid,
  p_action_id text,
  p_fingerprint text,
  p_expires_at timestamptz
)
returns public.jhadina_growth_approval_receipts
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.request_paid_approval(
    p_campaign_id,p_action_id,p_fingerprint,p_expires_at
  )
$$;

create or replace function growth_private.approve_paid_receipt(
  p_receipt_id uuid
)
returns public.jhadina_growth_approval_receipts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.jhadina_growth_approval_receipts;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  update public.jhadina_growth_approval_receipts
     set status='approved', approved_at=now()
   where id=p_receipt_id and user_id=v_user and status='pending' and expires_at>now()
  returning * into v_row;

  if v_row.id is null then raise exception 'approval receipt unavailable'; end if;
  return v_row;
end;
$$;

create or replace function public.jhadina_growth_approve_paid_receipt(
  p_receipt_id uuid
)
returns public.jhadina_growth_approval_receipts
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.approve_paid_receipt(p_receipt_id)
$$;

create or replace function growth_private.consume_paid_receipt(
  p_receipt_id uuid,
  p_action_id text,
  p_fingerprint text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_ok boolean;
begin
  if v_user is null then return false; end if;

  update public.jhadina_growth_approval_receipts
     set status='consumed', consumed_at=now()
   where id=p_receipt_id
     and user_id=v_user
     and action_id=p_action_id
     and type='paid-ad.publish'
     and fingerprint=p_fingerprint
     and status='approved'
     and expires_at>now()
  returning true into v_ok;

  if v_ok is null then
    update public.jhadina_growth_approval_receipts
       set status='expired'
     where id=p_receipt_id
       and user_id=v_user
       and status='approved'
       and expires_at<=now();
    return false;
  end if;

  update public.jhadina_growth_paid_campaigns
     set status='approved',updated_at=now()
   where approval_receipt_id=p_receipt_id
     and user_id=v_user
     and status='pending_approval';

  return true;
end;
$$;

create or replace function public.jhadina_growth_consume_paid_receipt(
  p_receipt_id uuid,
  p_action_id text,
  p_fingerprint text
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select growth_private.consume_paid_receipt(p_receipt_id,p_action_id,p_fingerprint)
$$;

create or replace function growth_private.enqueue_paid_campaign(
  p_campaign_id uuid
)
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

  if v_campaign.id is null then raise exception 'campaign not found'; end if;
  if v_campaign.approval_receipt_id is null then raise exception 'approval required'; end if;

  select * into v_receipt
    from public.jhadina_growth_approval_receipts
   where id=v_campaign.approval_receipt_id and user_id=v_user;

  v_expected := 'growth-paid-publish:v1:' || v_campaign.id::text || ':' || v_campaign.request_fingerprint;

  if v_receipt.status <> 'consumed'
     or v_receipt.type <> 'paid-ad.publish'
     or v_receipt.fingerprint <> v_expected then
    raise exception 'GROWTH_CONSUMED_APPROVAL_REQUIRED';
  end if;

  insert into public.jhadina_growth_paid_outbox(
    user_id,campaign_id,approval_receipt_id,provider,channel,provider_account_id,
    payload,request_fingerprint,idempotency_key
  ) values (
    v_user,v_campaign.id,v_receipt.id,v_campaign.provider,v_campaign.channel,v_campaign.provider_account_id,
    jsonb_build_object(
      'campaignId',v_campaign.id,
      'brandId',v_campaign.brand_id,
      'name',v_campaign.name,
      'objective',v_campaign.objective,
      'channel',v_campaign.channel,
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
  on conflict(user_id,idempotency_key)
  do update set idempotency_key=excluded.idempotency_key
  returning * into v_row;

  update public.jhadina_growth_paid_campaigns
     set status='queued',updated_at=now()
   where id=v_campaign.id and user_id=v_user and status in ('approved','queued');

  return v_row;
end;
$$;

create or replace function public.jhadina_growth_enqueue_paid_campaign(
  p_campaign_id uuid
)
returns public.jhadina_growth_paid_outbox
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.enqueue_paid_campaign(p_campaign_id)
$$;

create or replace function growth_private.begin_paid_outbox_attempt(
  p_outbox_id uuid
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

  update public.jhadina_growth_paid_outbox
     set status='attempting',
         attempt_count=attempt_count+1,
         last_error=null,
         updated_at=now()
   where id=p_outbox_id
     and user_id=v_user
     and status='pending'
  returning * into v_row;

  if v_row.id is null then raise exception 'outbox job cannot be attempted'; end if;

  update public.jhadina_growth_paid_campaigns
     set status='attempting',updated_at=now()
   where id=v_row.campaign_id and user_id=v_user;

  return v_row;
end;
$$;

create or replace function public.jhadina_growth_begin_paid_outbox_attempt(
  p_outbox_id uuid
)
returns public.jhadina_growth_paid_outbox
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.begin_paid_outbox_attempt(p_outbox_id)
$$;

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
    raise exception 'invalid outbox resolution';
  end if;

  update public.jhadina_growth_paid_outbox
     set status=p_status,
         provider_operation_id=p_provider_operation_id,
         provider_campaign_id=p_provider_campaign_id,
         last_error=p_error,
         updated_at=now()
   where id=p_outbox_id
     and user_id=v_user
     and status='attempting'
  returning * into v_row;

  if v_row.id is null then raise exception 'outbox job is not attempting'; end if;

  update public.jhadina_growth_paid_campaigns
     set status=p_status,
         provider_campaign_id=coalesce(p_provider_campaign_id,provider_campaign_id),
         last_error=p_error,
         updated_at=now()
   where id=v_row.campaign_id and user_id=v_user;

  return v_row;
end;
$$;

create or replace function public.jhadina_growth_resolve_paid_outbox(
  p_outbox_id uuid,
  p_status text,
  p_provider_operation_id text default null,
  p_provider_campaign_id text default null,
  p_error text default null
)
returns public.jhadina_growth_paid_outbox
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.resolve_paid_outbox(
    p_outbox_id,p_status,p_provider_operation_id,p_provider_campaign_id,p_error
  )
$$;

create or replace function growth_private.record_provider_observation(
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
  if p_confidence < 0 or p_confidence > 1 then raise exception 'confidence out of range'; end if;
  if not exists(
    select 1 from public.jhadina_growth_paid_campaigns
    where id=p_campaign_id and user_id=v_user
  ) then
    raise exception 'campaign not found';
  end if;

  insert into public.jhadina_growth_provider_observations(
    user_id,campaign_id,source,observed_at,metrics,evidence,confidence
  )
  values(
    v_user,p_campaign_id,p_source,p_observed_at,
    coalesce(p_metrics,'{}'::jsonb),
    coalesce(p_evidence,'{}'::jsonb),
    p_confidence
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.jhadina_growth_record_provider_observation(
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
    p_campaign_id,p_source,p_observed_at,p_metrics,p_evidence,p_confidence
  )
$$;

revoke all on all functions in schema growth_private from public;
grant execute on function growth_private.record_customer_event(text,text,text,timestamptz,text,text,numeric,text,numeric,jsonb) to authenticated;
grant execute on function growth_private.create_audience(text,text,text,jsonb) to authenticated;
grant execute on function growth_private.add_audience_member(uuid,uuid,numeric,jsonb) to authenticated;
grant execute on function growth_private.create_paid_campaign(text,text,text,text,text,text,text,jsonb,jsonb,text,text,bigint,bigint,timestamptz,timestamptz,text,text) to authenticated;
grant execute on function growth_private.request_paid_approval(uuid,text,text,timestamptz) to authenticated;
grant execute on function growth_private.approve_paid_receipt(uuid) to authenticated;
grant execute on function growth_private.consume_paid_receipt(uuid,text,text) to authenticated;
grant execute on function growth_private.enqueue_paid_campaign(uuid) to authenticated;
grant execute on function growth_private.begin_paid_outbox_attempt(uuid) to authenticated;
grant execute on function growth_private.resolve_paid_outbox(uuid,text,text,text,text) to authenticated;
grant execute on function growth_private.record_provider_observation(uuid,text,timestamptz,jsonb,jsonb,numeric) to authenticated;

revoke execute on function public.jhadina_growth_record_customer_event(text,text,text,timestamptz,text,text,numeric,text,numeric,jsonb) from public, anon;
revoke execute on function public.jhadina_growth_create_audience(text,text,text,jsonb) from public, anon;
revoke execute on function public.jhadina_growth_add_audience_member(uuid,uuid,numeric,jsonb) from public, anon;
revoke execute on function public.jhadina_growth_create_paid_campaign(text,text,text,text,text,text,text,jsonb,jsonb,text,text,bigint,bigint,timestamptz,timestamptz,text,text) from public, anon;
revoke execute on function public.jhadina_growth_request_paid_approval(uuid,text,text,timestamptz) from public, anon;
revoke execute on function public.jhadina_growth_approve_paid_receipt(uuid) from public, anon;
revoke execute on function public.jhadina_growth_consume_paid_receipt(uuid,text,text) from public, anon;
revoke execute on function public.jhadina_growth_enqueue_paid_campaign(uuid) from public, anon;
revoke execute on function public.jhadina_growth_begin_paid_outbox_attempt(uuid) from public, anon;
revoke execute on function public.jhadina_growth_resolve_paid_outbox(uuid,text,text,text,text) from public, anon;
revoke execute on function public.jhadina_growth_record_provider_observation(uuid,text,timestamptz,jsonb,jsonb,numeric) from public, anon;

grant execute on function public.jhadina_growth_record_customer_event(text,text,text,timestamptz,text,text,numeric,text,numeric,jsonb) to authenticated;
grant execute on function public.jhadina_growth_create_audience(text,text,text,jsonb) to authenticated;
grant execute on function public.jhadina_growth_add_audience_member(uuid,uuid,numeric,jsonb) to authenticated;
grant execute on function public.jhadina_growth_create_paid_campaign(text,text,text,text,text,text,text,jsonb,jsonb,text,text,bigint,bigint,timestamptz,timestamptz,text,text) to authenticated;
grant execute on function public.jhadina_growth_request_paid_approval(uuid,text,text,timestamptz) to authenticated;
grant execute on function public.jhadina_growth_approve_paid_receipt(uuid) to authenticated;
grant execute on function public.jhadina_growth_consume_paid_receipt(uuid,text,text) to authenticated;
grant execute on function public.jhadina_growth_enqueue_paid_campaign(uuid) to authenticated;
grant execute on function public.jhadina_growth_begin_paid_outbox_attempt(uuid) to authenticated;
grant execute on function public.jhadina_growth_resolve_paid_outbox(uuid,text,text,text,text) to authenticated;
grant execute on function public.jhadina_growth_record_provider_observation(uuid,text,timestamptz,jsonb,jsonb,numeric) to authenticated;
